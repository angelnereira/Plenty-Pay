// Package service orquesta los casos de uso de catalog: dominio + store + infra-management + outbox.
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"plentypay/catalog/internal/client"
	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/events"
	"plentypay/catalog/internal/pb"
	"plentypay/catalog/internal/store"
)

// Store es lo que el servicio usa de la persistencia.
type Store interface {
	CreateProduct(ctx context.Context, p domain.Product, event func(domain.Product) (store.OutboxEvent, error)) error
	UpdateProduct(ctx context.Context, tenantID, id string, expectedVersion int32,
		mutate func(*domain.Product) error, event func(domain.Product) (store.OutboxEvent, error)) (domain.Product, error)
	GetProduct(ctx context.Context, tenantID, id string) (domain.Product, error)
	LookupByBarcode(ctx context.Context, tenantID, barcode string) (domain.Product, error)
	ListProducts(ctx context.Context, tenantID string, f store.ListFilter) ([]domain.Product, *store.Cursor, error)
	UpsertCategory(ctx context.Context, c domain.Category) (domain.Category, error)
	CategoryExists(ctx context.Context, tenantID, id string) (bool, error)
	ListCategories(ctx context.Context, tenantID string) ([]domain.Category, error)
}

// TaxRateSource entrega las tasas legales vigentes (infra-management).
type TaxRateSource interface {
	TaxRates(ctx context.Context, requestID string) (domain.TaxRates, error)
	NamedTaxRates(ctx context.Context, requestID string) ([]client.NamedRate, error)
}

// Catalog implementa los casos de uso.
type Catalog struct {
	store Store
	taxes TaxRateSource
	now   func() time.Time
	newID func() string
}

// New arma el servicio. `now` y `newID` se inyectan (go-standards.md §3.3).
func New(st Store, taxes TaxRateSource, now func() time.Time, newID func() string) *Catalog {
	return &Catalog{store: st, taxes: taxes, now: now, newID: newID}
}

// NewUUIDv7 es el generador de ids de producción.
func NewUUIDv7() string { return uuid.Must(uuid.NewV7()).String() }

// productChanged arma la fila de outbox del evento (ADR 0012).
func (c *Catalog) productChanged(p domain.Product) (store.OutboxEvent, error) {
	msg := &pb.ProductChanged{
		ProductId: p.ID, TenantId: p.TenantID, Status: pb.ProductStatus(p.Status), Name: p.Name,
		CategoryId: p.CategoryID, PriceMinor: p.PriceMinor, Currency: p.Currency,
	}
	b, err := proto.Marshal(msg)
	if err != nil {
		return store.OutboxEvent{}, fmt.Errorf("marshal ProductChanged: %w", err)
	}
	return store.OutboxEvent{
		ID: c.newID(), TenantID: p.TenantID, AggregateID: p.ID, Subject: events.SubjectProductChanged,
		Payload: b, CreatedAt: c.now(),
	}, nil
}

// CreateProduct valida (R1, R2, N-FIS-01) y guarda el producto con su evento.
func (c *Catalog) CreateProduct(ctx context.Context, tenantID, userID, requestID string, p domain.Product, taxSet bool) (domain.Product, error) {
	p.Normalize()
	rates, err := c.taxes.TaxRates(ctx, requestID)
	if err != nil {
		return p, err
	}
	if err := p.Validate(rates, taxSet); err != nil {
		return p, err
	}
	now := c.now()
	p.ID, p.TenantID, p.CreatedBy = c.newID(), tenantID, userID
	p.Status, p.Version, p.CreatedAt, p.UpdatedAt = domain.StatusActive, 1, now, now
	if err := c.store.CreateProduct(ctx, p, c.productChanged); err != nil {
		return p, err
	}
	return p, nil
}

// UpdateFields aplica una máscara de campos (catalog.proto `update_mask`); vacía = todos los
// editables.
func UpdateFields(dst *domain.Product, src domain.Product, mask []string) {
	all := len(mask) == 0
	has := map[string]bool{}
	for _, m := range mask {
		has[m] = true
	}
	set := func(name string) bool { return all || has[name] }
	if set("sku") {
		dst.SKU = src.SKU
	}
	if set("barcode") {
		dst.Barcode = src.Barcode
	}
	if set("name") {
		dst.Name = src.Name
	}
	if set("description") {
		dst.Description = src.Description
	}
	if set("category_id") {
		dst.CategoryID = src.CategoryID
	}
	if set("brand") {
		dst.Brand = src.Brand
	}
	if set("unit_type") {
		dst.UnitType = src.UnitType
	}
	if set("price") {
		dst.PriceMinor, dst.Currency = src.PriceMinor, src.Currency
	}
	if set("tax_rate_bps") {
		dst.TaxRateBps = src.TaxRateBps
	}
	if set("cpbs_code") {
		dst.CPBSCode = src.CPBSCode
	}
	if set("image_object_keys") {
		dst.ImageObjectKeys = src.ImageObjectKeys
	}
	if set("attributes") {
		dst.Attributes = src.Attributes
	}
	if set("tracks_inventory") {
		dst.TracksInventory = src.TracksInventory
	}
}

// UpdateProduct cambia los campos de la máscara. R3: el precio nuevo no toca ventas pasadas
// (pos y orders guardan instantáneas).
func (c *Catalog) UpdateProduct(ctx context.Context, tenantID, requestID string, src domain.Product, mask []string) (domain.Product, error) {
	rates, err := c.taxes.TaxRates(ctx, requestID)
	if err != nil {
		return src, err
	}
	return c.store.UpdateProduct(ctx, tenantID, src.ID, src.Version, func(p *domain.Product) error {
		if p.Status != domain.StatusActive {
			return domain.ErrInvalidTransition
		}
		UpdateFields(p, src, mask)
		p.Normalize()
		if err := p.Validate(rates, true); err != nil {
			return err
		}
		p.UpdatedAt = c.now()
		p.Version++
		return nil
	}, c.productChanged)
}

// ArchiveProduct archiva (nada se borra).
func (c *Catalog) ArchiveProduct(ctx context.Context, tenantID, id string) (domain.Product, error) {
	return c.store.UpdateProduct(ctx, tenantID, id, 0, func(p *domain.Product) error {
		return p.Archive(c.now())
	}, c.productChanged)
}

// GetProduct lee un producto.
func (c *Catalog) GetProduct(ctx context.Context, tenantID, id string) (domain.Product, error) {
	return c.store.GetProduct(ctx, tenantID, id)
}

// LookupByBarcode busca un producto activo por código de barras.
func (c *Catalog) LookupByBarcode(ctx context.Context, tenantID, barcode string) (domain.Product, error) {
	return c.store.LookupByBarcode(ctx, tenantID, barcode)
}

// ListProducts lista con filtros y keyset.
func (c *Catalog) ListProducts(ctx context.Context, tenantID string, f store.ListFilter) ([]domain.Product, *store.Cursor, error) {
	return c.store.ListProducts(ctx, tenantID, f)
}

// UpsertCategory crea (sin id) o renombra (con id existente) una categoría.
func (c *Catalog) UpsertCategory(ctx context.Context, tenantID string, cat domain.Category) (domain.Category, error) {
	now := c.now()
	if cat.ID == "" {
		cat.ID, cat.CreatedAt = c.newID(), now
	} else {
		ok, err := c.store.CategoryExists(ctx, tenantID, cat.ID)
		if err != nil {
			return cat, err
		}
		if !ok {
			return cat, domain.ErrNotFound
		}
	}
	cat.TenantID, cat.UpdatedAt = tenantID, now
	return c.store.UpsertCategory(ctx, cat)
}

// ListCategories lista el árbol.
func (c *Catalog) ListCategories(ctx context.Context, tenantID string) ([]domain.Category, error) {
	return c.store.ListCategories(ctx, tenantID)
}

// ListTaxRates devuelve las tasas de ITBMS vigentes para el editor de productos.
func (c *Catalog) ListTaxRates(ctx context.Context, requestID string) ([]client.NamedRate, error) {
	return c.taxes.NamedTaxRates(ctx, requestID)
}
