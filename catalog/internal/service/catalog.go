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
		// Una edición del producto no cambia su publicación: viaja la que tiene (R4).
		ListedInMarketplace: p.Listed,
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

// ── Marketplace (F15.4–F15.5) ───────────────────────────────────────────────────────────────

// MarketStore es lo que el marketplace usa de la persistencia.
type MarketStore interface {
	TenantStatus(ctx context.Context, tenantID string) (int16, bool, error)
	ApplyTenantStatus(ctx context.Context, eventID, tenantID string, status int16, at time.Time,
		event func(domain.Product) (store.OutboxEvent, error)) (bool, error)
	ApplyStock(ctx context.Context, eventID, tenantID, productID, warehouseID string, availableMilli int64, at time.Time) (bool, error)
	SetListing(ctx context.Context, l domain.Listing, check func(domain.Product) error,
		event func(domain.Product) (store.OutboxEvent, error)) (domain.Listing, error)
	Listing(ctx context.Context, tenantID, productID string) (domain.Listing, error)
	UpsertStorefront(ctx context.Context, sf domain.Storefront) error
	Storefront(ctx context.Context, tenantID string) (domain.Storefront, error)
	SearchMarketplace(ctx context.Context, f store.MarketFilter) ([]domain.MarketItem, bool, error)
	MarketplaceProduct(ctx context.Context, productID string) (domain.MarketItem, error)
}

// TenantDirectory es identity (respaldo de la proyección).
type TenantDirectory interface {
	TenantStatus(ctx context.Context, requestID, tenantID string) (int16, error)
}

// Market implementa listados, vitrina y búsqueda.
type Market struct {
	*Catalog
	market  MarketStore
	tenants TenantDirectory
}

// NewMarket arma el marketplace sobre el catálogo.
func NewMarket(c *Catalog, ms MarketStore, tenants TenantDirectory) *Market {
	return &Market{Catalog: c, market: ms, tenants: tenants}
}

func (m *Market) changed(listed bool) func(domain.Product) (store.OutboxEvent, error) {
	return func(p domain.Product) (store.OutboxEvent, error) {
		e, err := m.productChanged(p)
		if err != nil {
			return e, err
		}
		msg := &pb.ProductChanged{ProductId: p.ID, TenantId: p.TenantID, Status: pb.ProductStatus(p.Status), Name: p.Name,
			CategoryId: p.CategoryID, PriceMinor: p.PriceMinor, Currency: p.Currency, ListedInMarketplace: listed}
		b, err := proto.Marshal(msg)
		if err != nil {
			return e, fmt.Errorf("marshal ProductChanged: %w", err)
		}
		e.Payload = b
		return e, nil
	}
}

// TenantStatus: proyección; si nunca llegó un evento, identity, y se guarda como dato (R4).
func (m *Market) TenantStatus(ctx context.Context, requestID, tenantID string) (int16, error) {
	st, ok, err := m.market.TenantStatus(ctx, tenantID)
	if err != nil || ok {
		return st, err
	}
	st, err = m.tenants.TenantStatus(ctx, requestID, tenantID)
	if err != nil {
		return 0, err
	}
	if _, err := m.market.ApplyTenantStatus(ctx, "", tenantID, st, m.now(), m.changed(false)); err != nil {
		return 0, err
	}
	return st, nil
}

// SetListing publica o despublica (SPEC SetListing; R4).
func (m *Market) SetListing(ctx context.Context, tenantID, requestID string, l domain.Listing) (domain.Listing, error) {
	st, err := m.TenantStatus(ctx, requestID, tenantID)
	if err != nil {
		return l, err
	}
	l.TenantID, l.UpdatedAt = tenantID, m.now()
	return m.market.SetListing(ctx, l, func(p domain.Product) error { return l.CanPublish(p, st) }, m.changed(l.Listed))
}

// Listing lee la publicación de un producto.
func (m *Market) Listing(ctx context.Context, tenantID, productID string) (domain.Listing, error) {
	return m.market.Listing(ctx, tenantID, productID)
}

// UpdateStorefront guarda la vitrina; publicarla exige negocio ACTIVE.
func (m *Market) UpdateStorefront(ctx context.Context, tenantID, requestID string, sf domain.Storefront) (domain.Storefront, error) {
	if err := sf.Validate(); err != nil {
		return sf, err
	}
	if sf.Published {
		st, err := m.TenantStatus(ctx, requestID, tenantID)
		if err != nil {
			return sf, err
		}
		if st != domain.TenantActive {
			return sf, domain.ErrTenantNotActive
		}
	}
	sf.TenantID, sf.UpdatedAt = tenantID, m.now()
	if err := m.market.UpsertStorefront(ctx, sf); err != nil {
		return sf, err
	}
	return sf, nil
}

// Storefront lee la vitrina; `verified` = negocio ACTIVE.
func (m *Market) Storefront(ctx context.Context, requestID, tenantID string) (domain.Storefront, bool, error) {
	sf, err := m.market.Storefront(ctx, tenantID)
	if err != nil {
		return sf, false, err
	}
	st, err := m.TenantStatus(ctx, requestID, tenantID)
	if err != nil {
		return sf, false, err
	}
	return sf, st == domain.TenantActive, nil
}

// Search busca en el marketplace (R7).
func (m *Market) Search(ctx context.Context, f store.MarketFilter) ([]domain.MarketItem, bool, error) {
	if !domain.MarketSort[f.Sort] {
		return nil, false, domain.ErrInvalidCategory
	}
	return m.market.SearchMarketplace(ctx, f)
}

// MarketplaceProduct lee un producto publicado.
func (m *Market) MarketplaceProduct(ctx context.Context, productID string) (domain.MarketItem, error) {
	return m.market.MarketplaceProduct(ctx, productID)
}

// HandleTenantStatus aplica identity.TenantStatusChanged (consumidor).
func (m *Market) HandleTenantStatus(ctx context.Context, eventID, tenantID string, status int16) (bool, error) {
	return m.market.ApplyTenantStatus(ctx, eventID, tenantID, status, m.now(), m.changed(false))
}

// HandleStock aplica inventory.StockChanged (consumidor, R5).
func (m *Market) HandleStock(ctx context.Context, eventID, tenantID, productID, warehouseID string, available int64) (bool, error) {
	return m.market.ApplyStock(ctx, eventID, tenantID, productID, warehouseID, available, m.now())
}
