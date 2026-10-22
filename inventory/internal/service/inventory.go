// Package service orquesta los casos de uso de inventory: dominio + store + catalog + outbox.
package service

import (
	"context"
	"crypto/sha256"
	"errors"
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
	ListLots(ctx context.Context, tenantID, productID, warehouseID string, includeEmpty bool) ([]domain.Lot, error)
	DefaultWarehouse(ctx context.Context, tenantID, newID string, now time.Time) (domain.Warehouse, error)
	UpsertWarehouse(ctx context.Context, w domain.Warehouse, create bool) (domain.Warehouse, error)
	ListWarehouses(ctx context.Context, tenantID, newID string, now time.Time) ([]domain.Warehouse, error)
	GetStock(ctx context.Context, tenantID, productID, warehouseID string) (domain.Level, error)
	SetReorderPoint(ctx context.Context, tenantID, warehouseID, productID string, milli int64, now time.Time) error
	ListStock(ctx context.Context, tenantID, warehouseID string, onlyLow bool, after string, limit int) ([]domain.Level, string, error)
	ListMovements(ctx context.Context, tenantID, productID, warehouseID string, from, to time.Time,
		after *store.MovementCursor, limit int) ([]domain.Movement, *store.MovementCursor, error)
	Reserve(ctx context.Context, r domain.Reservation, hash []byte, allowNegative bool, newWarehouseID string,
		now time.Time, events store.EventsFor) (domain.Reservation, error)
	Finish(ctx context.Context, tenantID, id string, to domain.ReservationStatus, actorService string,
		now time.Time, newID func() string, events store.EventsFor) (domain.Reservation, error)
	DueReservations(ctx context.Context, now time.Time, limit int) ([]domain.Reservation, error)
	CreateSupplier(ctx context.Context, sup domain.Supplier, key string, now time.Time) (domain.Supplier, error)
	UpdateSupplier(ctx context.Context, sup domain.Supplier, now time.Time) (domain.Supplier, error)
	ListSuppliers(ctx context.Context, tenantID, after string, limit int) ([]domain.Supplier, string, error)
	CreatePurchaseOrder(ctx context.Context, o domain.PurchaseOrder, key string, hash []byte, createdBy string,
		now time.Time) (domain.PurchaseOrder, error)
	GetPurchaseOrder(ctx context.Context, tenantID, id string) (domain.PurchaseOrder, error)
	ListPurchaseOrders(ctx context.Context, tenantID string, status domain.POStatus, after string, limit int) ([]domain.PurchaseOrder, string, error)
	UpdatePurchaseOrderStatus(ctx context.Context, tenantID, id string, to domain.POStatus, now time.Time) (domain.PurchaseOrder, error)
	PurchaseOrderWarehouse(ctx context.Context, tenantID, id string) (string, error)
	ReorderData(ctx context.Context, tenantID, warehouseID string, now time.Time) ([]store.ReorderRow, error)
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
	_, err := s.trackedProduct(ctx, productID, t)
	return err
}

// trackedProduct valida el producto y dice si controla lotes (F16.4: sus entradas exigen lote).
func (s *Inventory) trackedProduct(ctx context.Context, productID string, t domain.MovementType) (client.Product, error) {
	if _, err := uuid.Parse(productID); err != nil {
		return client.Product{}, domain.ErrProductNotFound
	}
	p, err := s.products.Product(ctx, productID)
	if err != nil {
		return p, err
	}
	if !p.Active && t != domain.Return {
		return p, domain.ErrProductNotFound
	}
	if !p.TracksInventory {
		return p, domain.ErrNotTracked
	}
	return p, nil
}

// lotFields valida el código del lote (si viene) y lo deja en el movimiento.
func lotFields(m *domain.Movement, code string, expires *time.Time, requireLot bool) error {
	if strings.TrimSpace(code) != "" {
		c, err := domain.NormalizeLotCode(code)
		if err != nil {
			return err
		}
		m.LotCode = c
	}
	if expires != nil {
		d := domain.DateOnly(*expires)
		m.LotExpiresOn = &d
	}
	m.RequireLot = requireLot
	return nil
}

func lotHash(code string, expires *time.Time) string {
	if expires == nil {
		return code
	}
	return code + "@" + domain.DateOnly(*expires).Format("2006-01-02")
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
	LotCode        string     // F16.4
	LotExpiresOn   *time.Time // F16.4: al crear el lote en una entrada
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
	p, err := s.trackedProduct(ctx, r.ProductID, r.Type)
	if err != nil {
		return m, err
	}
	if err := lotFields(&m, r.LotCode, r.LotExpiresOn, p.TracksLots && r.DeltaMilli > 0); err != nil {
		return m, err
	}
	res, err := s.store.Apply(ctx, store.Batch{
		TenantID: c.TenantID, IdempotencyKey: r.IdempotencyKey, NewWarehouseID: s.newID(), Now: s.now(),
		RequestHash: requestHash("adjust", r.ProductID, r.WarehouseID, fmt.Sprint(r.DeltaMilli), fmt.Sprint(r.Type),
			m.Reason, r.ReferenceType, r.ReferenceID, lotHash(m.LotCode, m.LotExpiresOn)),
		Movements: []domain.Movement{m},
	}, s.eventsFor)
	if err != nil {
		return m, err
	}
	return res.Movements[0], nil
}

// TransferStock mueve existencias entre dos bodegas: TRANSFER_OUT y TRANSFER_IN en la misma
// transacción (SPEC §4).
func (s *Inventory) TransferStock(ctx context.Context, c Caller, key, productID, from, to string, qty int64, reason, lotCode string) (domain.Movement, domain.Movement, error) {
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
	// F16.4: la salida toma ese lote (o FEFO) y la entrada replica en el destino lo que salió.
	if err := lotFields(&out, lotCode, nil, false); err != nil {
		return out, domain.Movement{}, err
	}
	in := out
	in.ID, in.WarehouseID, in.Type, in.DeltaMilli, in.LotCode = s.newID(), to, domain.TransferIn, qty, ""
	out.ReferenceID, in.ReferenceID = in.ID, out.ID
	res, err := s.store.Apply(ctx, store.Batch{TenantID: c.TenantID, IdempotencyKey: key, NewWarehouseID: s.newID(),
		Now: s.now(), RequestHash: requestHash("transfer", productID, from, to, fmt.Sprint(qty), reason, out.LotCode),
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

// ── Reservas (F16.3) ────────────────────────────────────────────────────────────────────────

// ReserveRequest aparta existencias para un pedido.
type ReserveRequest struct {
	IdempotencyKey string
	WarehouseID    string
	Lines          []domain.ReservationLine
	ReferenceType  string
	ReferenceID    string
	TTLSeconds     int32
	AllowNegative  bool
}

// ReserveStock aparta todas las líneas o ninguna (R4). Solo pos y orders reservan.
func (s *Inventory) ReserveStock(ctx context.Context, c Caller, r ReserveRequest) (domain.Reservation, error) {
	if !domain.SellingServices[c.Service] {
		return domain.Reservation{}, domain.ErrServiceOnly
	}
	ttl := r.TTLSeconds
	if ttl == 0 {
		ttl = domain.DefaultReservationTTL
	}
	if ttl < 1 || ttl > domain.MaxReservationTTL {
		return domain.Reservation{}, domain.ErrInvalidQty
	}
	res := domain.Reservation{ID: s.newID(), TenantID: c.TenantID, WarehouseID: r.WarehouseID, Lines: r.Lines,
		ReferenceType: r.ReferenceType, ReferenceID: r.ReferenceID, IdempotencyKey: r.IdempotencyKey,
		ExpiresAt: s.now().Add(time.Duration(ttl) * time.Second)}
	if err := res.Validate(); err != nil {
		return res, err
	}
	parts := []string{"reserve", r.WarehouseID, r.ReferenceType, r.ReferenceID, fmt.Sprint(ttl), fmt.Sprint(r.AllowNegative)}
	for _, l := range r.Lines {
		if err := s.validateProduct(ctx, l.ProductID, domain.Sale); err != nil {
			return res, err
		}
		parts = append(parts, l.ProductID, fmt.Sprint(l.QtyMilli))
	}
	return s.store.Reserve(ctx, res, requestHash(parts...), r.AllowNegative, s.newID(), s.now(), s.eventsFor)
}

// CommitReservation convierte la reserva en venta (SALE por línea).
func (s *Inventory) CommitReservation(ctx context.Context, c Caller, id string) (domain.Reservation, error) {
	if !domain.SellingServices[c.Service] {
		return domain.Reservation{}, domain.ErrServiceOnly
	}
	return s.store.Finish(ctx, c.TenantID, id, domain.ReservationCommitted, c.Service, s.now(), s.newID, s.eventsFor)
}

// ReleaseReservation devuelve lo apartado.
func (s *Inventory) ReleaseReservation(ctx context.Context, c Caller, id string) (domain.Reservation, error) {
	if !domain.SellingServices[c.Service] {
		return domain.Reservation{}, domain.ErrServiceOnly
	}
	return s.store.Finish(ctx, c.TenantID, id, domain.ReservationReleased, c.Service, s.now(), s.newID, s.eventsFor)
}

// ExpireReservations vence las reservas cuyo TTL pasó (job de 30 s, R4).
func (s *Inventory) ExpireReservations(ctx context.Context, limit int) (int, error) {
	due, err := s.store.DueReservations(ctx, s.now(), limit)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, r := range due {
		if _, err := s.store.Finish(ctx, r.TenantID, r.ID, domain.ReservationExpired, "inventory", s.now(), s.newID, s.eventsFor); err != nil {
			if errors.Is(err, domain.ErrInvalidTransition) {
				continue // otro proceso la cerró entre la lectura y el bloqueo
			}
			return n, err
		}
		n++
	}
	return n, nil
}

// ListLots: lotes de un producto (F16.4).
func (s *Inventory) ListLots(ctx context.Context, tenantID, productID, warehouseID string, includeEmpty bool) ([]domain.Lot, error) {
	return s.store.ListLots(ctx, tenantID, productID, warehouseID, includeEmpty)
}
