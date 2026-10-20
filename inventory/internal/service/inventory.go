// Package service orquesta los casos de uso de inventory: dominio + store + catalog + outbox.
package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"plentypay/inventory/internal/client"
	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/events"
	"plentypay/inventory/internal/pb"
	"plentypay/inventory/internal/store"
)

// Store es lo que el servicio usa de la persistencia.
type Store interface {
	Apply(ctx context.Context, b store.Batch, events store.EventsFor) (store.Applied, error)
	DefaultWarehouse(ctx context.Context, tenantID, newID string, now time.Time) (domain.Warehouse, error)
	UpsertWarehouse(ctx context.Context, w domain.Warehouse, create bool) (domain.Warehouse, error)
	ListWarehouses(ctx context.Context, tenantID, newID string, now time.Time) ([]domain.Warehouse, error)
	GetStock(ctx context.Context, tenantID, productID, warehouseID string) (domain.Level, error)
	SetReorderPoint(ctx context.Context, tenantID, warehouseID, productID string, milli int64, now time.Time) error
	ListStock(ctx context.Context, tenantID, warehouseID string, onlyLow bool, after string, limit int) ([]domain.Level, string, error)
	ListMovements(ctx context.Context, tenantID, productID, warehouseID string, from, to time.Time,
		after *store.MovementCursor, limit int) ([]domain.Movement, *store.MovementCursor, error)
}

// Products valida productos contra catalog.
type Products interface {
	Product(ctx context.Context, productID string) (client.Product, error)
}

// Inventory implementa los casos de uso.
type Inventory struct {
	store    Store
	products Products
	now      func() time.Time
	newID    func() string
}

// New arma el servicio.
func New(st Store, products Products, now func() time.Time, newID func() string) *Inventory {
	return &Inventory{store: st, products: products, now: now, newID: newID}
}

// NewUUIDv7 es el generador de ids de producción.
func NewUUIDv7() string { return uuid.Must(uuid.NewV7()).String() }

// Caller es quién pide el movimiento.
type Caller struct {
	TenantID string
	UserID   string
	Service  string
}

// eventsFor arma StockChanged por existencia tocada y StockLow si corresponde (R7, R8).
func (s *Inventory) eventsFor(levels []domain.Level, low map[string]bool) ([]store.OutboxEvent, error) {
	var out []store.OutboxEvent
	for _, l := range levels {
		changed, err := proto.Marshal(&pb.StockChanged{ProductId: l.ProductID, WarehouseId: l.WarehouseID,
			TenantId: l.TenantID, OnHandMilli: l.OnHandMilli, AvailableMilli: l.Available()})
		if err != nil {
			return nil, fmt.Errorf("marshal StockChanged: %w", err)
		}
		out = append(out, store.OutboxEvent{ID: s.newID(), TenantID: l.TenantID, AggregateID: l.ProductID,
			Subject: events.SubjectStockChanged, Payload: changed, CreatedAt: s.now()})
		if low[l.WarehouseID+"/"+l.ProductID] {
			b, err := proto.Marshal(&pb.StockLow{ProductId: l.ProductID, WarehouseId: l.WarehouseID, TenantId: l.TenantID,
				AvailableMilli: l.Available(), ReorderPointMilli: l.ReorderPointMilli})
			if err != nil {
				return nil, fmt.Errorf("marshal StockLow: %w", err)
			}
			out = append(out, store.OutboxEvent{ID: s.newID(), TenantID: l.TenantID, AggregateID: l.ProductID,
				Subject: events.SubjectStockLow, Payload: b, CreatedAt: s.now()})
		}
	}
	return out, nil
}

// requestHash identifica el contenido de la petición para detectar una clave reutilizada.
func requestHash(parts ...string) []byte {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return sum[:]
}

// validateProduct: el producto debe existir en el catálogo del comercio, estar activo y llevar
// inventario. Las devoluciones aceptan productos archivados (la mercancía vuelve igual).
func (s *Inventory) validateProduct(ctx context.Context, productID string, t domain.MovementType) error {
	if _, err := uuid.Parse(productID); err != nil {
		return domain.ErrProductNotFound
	}
	p, err := s.products.Product(ctx, productID)
	if err != nil {
		return err
	}
	if !p.Active && t != domain.Return {
		return domain.ErrProductNotFound
	}
	if !p.TracksInventory {
		return domain.ErrNotTracked
	}
	return nil
}

// AdjustRequest es un movimiento manual o de venta/devolución.
type AdjustRequest struct {
	IdempotencyKey string
	ProductID      string
	WarehouseID    string
	DeltaMilli     int64
	Type           domain.MovementType
	Reason         string
	ReferenceType  string
	ReferenceID    string
}

// AdjustStock registra un movimiento (SPEC §4). Idempotente por clave dentro del tenant.
func (s *Inventory) AdjustStock(ctx context.Context, c Caller, r AdjustRequest) (domain.Movement, error) {
	m := domain.Movement{ID: s.newID(), WarehouseID: r.WarehouseID, ProductID: r.ProductID, Type: r.Type,
		DeltaMilli: r.DeltaMilli, Reason: strings.TrimSpace(r.Reason), ReferenceType: r.ReferenceType,
		ReferenceID: r.ReferenceID, ActorUserID: c.UserID, ActorService: c.Service}
	if err := m.Validate(); err != nil {
		return m, err
	}
	if err := m.AllowedFor(c.Service); err != nil {
		return m, err
	}
	if err := s.validateProduct(ctx, r.ProductID, r.Type); err != nil {
		return m, err
	}
	res, err := s.store.Apply(ctx, store.Batch{
		TenantID: c.TenantID, IdempotencyKey: r.IdempotencyKey, NewWarehouseID: s.newID(), Now: s.now(),
		RequestHash: requestHash("adjust", r.ProductID, r.WarehouseID, fmt.Sprint(r.DeltaMilli), fmt.Sprint(r.Type),
			m.Reason, r.ReferenceType, r.ReferenceID),
		Movements: []domain.Movement{m},
	}, s.eventsFor)
	if err != nil {
		return m, err
	}
	return res.Movements[0], nil
}

// TransferStock mueve existencias entre dos bodegas: TRANSFER_OUT y TRANSFER_IN en la misma
// transacción (SPEC §4).
func (s *Inventory) TransferStock(ctx context.Context, c Caller, key, productID, from, to string, qty int64, reason string) (domain.Movement, domain.Movement, error) {
	if from == "" || to == "" {
		return domain.Movement{}, domain.Movement{}, domain.ErrInvalidWarehouse
	}
	if from == to {
		return domain.Movement{}, domain.Movement{}, domain.ErrSameWarehouse
	}
	if qty <= 0 {
		return domain.Movement{}, domain.Movement{}, domain.ErrInvalidQty
	}
	if err := s.validateProduct(ctx, productID, domain.TransferOut); err != nil {
		return domain.Movement{}, domain.Movement{}, err
	}
	out := domain.Movement{ID: s.newID(), WarehouseID: from, ProductID: productID, Type: domain.TransferOut,
		DeltaMilli: -qty, Reason: reason, ReferenceType: "transfer", ActorUserID: c.UserID, ActorService: c.Service}
	in := out
	in.ID, in.WarehouseID, in.Type, in.DeltaMilli = s.newID(), to, domain.TransferIn, qty
	out.ReferenceID, in.ReferenceID = in.ID, out.ID
	res, err := s.store.Apply(ctx, store.Batch{TenantID: c.TenantID, IdempotencyKey: key, NewWarehouseID: s.newID(),
		Now: s.now(), RequestHash: requestHash("transfer", productID, from, to, fmt.Sprint(qty), reason),
		Movements: []domain.Movement{out, in}}, s.eventsFor)
	if err != nil {
		return out, in, err
	}
	for _, m := range res.Movements {
		if m.Type == domain.TransferOut {
			out = m
		} else {
			in = m
		}
	}
	return out, in, nil
}

// UpsertWarehouse crea (sin id) o edita una bodega.
func (s *Inventory) UpsertWarehouse(ctx context.Context, tenantID string, w domain.Warehouse) (domain.Warehouse, error) {
	if err := w.Validate(); err != nil {
		return w, err
	}
	create := w.ID == ""
	if create {
		w.ID, w.CreatedAt = s.newID(), s.now()
		w.Active = true
	}
	w.TenantID, w.UpdatedAt = tenantID, s.now()
	return s.store.UpsertWarehouse(ctx, w, create)
}

// ListWarehouses lista (y crea la bodega por defecto si no hay).
func (s *Inventory) ListWarehouses(ctx context.Context, tenantID string) ([]domain.Warehouse, error) {
	return s.store.ListWarehouses(ctx, tenantID, s.newID(), s.now())
}

// DefaultWarehouse devuelve la bodega por defecto.
func (s *Inventory) DefaultWarehouse(ctx context.Context, tenantID string) (domain.Warehouse, error) {
	return s.store.DefaultWarehouse(ctx, tenantID, s.newID(), s.now())
}

// GetStock lee la existencia.
func (s *Inventory) GetStock(ctx context.Context, tenantID, productID, warehouseID string) (domain.Level, error) {
	return s.store.GetStock(ctx, tenantID, productID, warehouseID)
}

// ListStock lista existencias.
func (s *Inventory) ListStock(ctx context.Context, tenantID, warehouseID string, onlyLow bool, after string, limit int) ([]domain.Level, string, error) {
	return s.store.ListStock(ctx, tenantID, warehouseID, onlyLow, after, limit)
}

// ListMovements lista el historial; sin rango, los últimos 90 días.
func (s *Inventory) ListMovements(ctx context.Context, tenantID, productID, warehouseID string, from, to time.Time,
	after *store.MovementCursor, limit int) ([]domain.Movement, *store.MovementCursor, error) {
	if to.IsZero() {
		to = s.now().Add(time.Minute)
	}
	if from.IsZero() {
		from = to.AddDate(0, 0, -90)
	}
	return s.store.ListMovements(ctx, tenantID, productID, warehouseID, from, to, after, limit)
}
