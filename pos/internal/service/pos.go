// Package service orquesta los casos de uso de pos: dominio + store + catalog + inventory + outbox.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/events"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/store"
)

// Store es lo que el servicio usa de la persistencia.
type Store interface {
	OpenSession(ctx context.Context, ss domain.Session) error
	GetSession(ctx context.Context, tenantID, id string) (domain.Session, error)
	CurrentSession(ctx context.Context, tenantID, cashierID string) (domain.Session, error)
	CloseSession(ctx context.Context, tenantID, id, closedBy string, counted int64, notes string, at time.Time) (domain.Session, error)
	AddCashMovement(ctx context.Context, tenantID string, m domain.CashMovement) (domain.Session, error)
	CreateSale(ctx context.Context, sl domain.Sale) (domain.Sale, error)
	GetSale(ctx context.Context, tenantID, id string) (domain.Sale, error)
	MutateSale(ctx context.Context, tenantID, id string, expectedVersion int32, mutate func(*domain.Sale) error,
		onPaid store.OnPaid, now time.Time) (domain.Sale, error)
	MutateSaleInOpenSession(ctx context.Context, tenantID, id string, mutate func(*domain.Sale) error,
		now time.Time) (domain.Sale, error)
	ApplyPaymentEvent(ctx context.Context, e store.PaymentEvent, onPaid store.OnPaid) (bool, error)
	ListSales(ctx context.Context, tenantID string, f store.SaleFilter) ([]domain.Sale, *store.SaleCursor, error)
	ClaimStockTasks(ctx context.Context, limit int, now time.Time) ([]store.StockTask, error)
	FinishStockTask(ctx context.Context, t store.StockTask, failed bool, cause string, now time.Time) error
	RetryStockTask(ctx context.Context, t store.StockTask, cause string, next time.Time) error
	// F17.11 (R14): configuración de caja.
	Settings(ctx context.Context, tenantID string) (domain.Settings, error)
	SaveSettings(ctx context.Context, tenantID string, st domain.Settings, actorID string, now time.Time) (domain.Settings, error)
}

// Catalog da el precio vigente de un producto.
type Catalog interface {
	Product(ctx context.Context, w client.Who, productID string) (client.Product, error)
}

// Inventory registra los movimientos de venta.
type Inventory interface {
	Move(ctx context.Context, w client.Who, key, saleID, productID string, movementType int16, qtyMilli int64) error
}

// Pos implementa los casos de uso.
type Pos struct {
	store     Store
	catalog   Catalog
	inventory Inventory
	now       func() time.Time
	newID     func() string
	// F17.9: devoluciones (UseRefunds).
	refunds  RefundStore
	stepUp   StepUp
	refunder Refunder
}

// New arma el servicio.
func New(st Store, cat Catalog, inv Inventory, now func() time.Time, newID func() string) *Pos {
	return &Pos{store: st, catalog: cat, inventory: inv, now: now, newID: newID}
}

// NewUUIDv7 es el generador de ids de producción.
func NewUUIDv7() string { return uuid.Must(uuid.NewV7()).String() }

// Actor es quién opera la caja.
type Actor struct {
	TenantID    string
	UserID      string
	RequestID   string
	Permissions map[string]bool
}

func (a Actor) who() client.Who {
	return client.Who{TenantID: a.TenantID, UserID: a.UserID, RequestID: a.RequestID}
}

// ── Sesiones ───────────────────────────────────────────────────────────────────────────────

// OpenSession abre la caja con su fondo inicial (R1).
func (p *Pos) OpenSession(ctx context.Context, a Actor, label string, float int64, currency string) (domain.Session, error) {
	label = strings.TrimSpace(label)
	if label == "" || len(label) > 40 {
		return domain.Session{}, domain.ErrInvalidAmount
	}
	if float < 0 {
		return domain.Session{}, domain.ErrInvalidAmount
	}
	if currency == "" {
		currency = "USD"
	}
	if currency != "USD" && currency != "PAB" {
		return domain.Session{}, domain.ErrInvalidAmount
	}
	ss := domain.Session{ID: p.newID(), TenantID: a.TenantID, TerminalLabel: label, CashierID: a.UserID, Status: "OPEN",
		OpeningFloat: float, ExpectedCash: float, Currency: currency, OpenedAt: p.now()}
	if err := p.store.OpenSession(ctx, ss); err != nil {
		return ss, err
	}
	return ss, nil
}

// GetSession lee una sesión; sin id, la sesión abierta del cajero.
func (p *Pos) GetSession(ctx context.Context, a Actor, id string) (domain.Session, error) {
	if id == "" {
		return p.store.CurrentSession(ctx, a.TenantID, a.UserID)
	}
	return p.store.GetSession(ctx, a.TenantID, id)
}

// CloseSession arquea la caja: diferencia = contado − esperado (reporte Z).
func (p *Pos) CloseSession(ctx context.Context, a Actor, id string, counted int64, notes string) (domain.Session, error) {
	return p.store.CloseSession(ctx, a.TenantID, id, a.UserID, counted, notes, p.now())
}

// RecordCashMovement registra una entrada o salida de efectivo con motivo.
func (p *Pos) RecordCashMovement(ctx context.Context, a Actor, sessionID, direction string, amount int64, reason string) (domain.Session, error) {
	m := domain.CashMovement{ID: p.newID(), SessionID: sessionID, Direction: strings.ToUpper(direction), AmountMinor: amount,
		Reason: reason, CreatedBy: a.UserID, CreatedAt: p.now()}
	if err := m.Validate(); err != nil {
		return domain.Session{}, err
	}
	return p.store.AddCashMovement(ctx, a.TenantID, m)
}

// ── Ventas ─────────────────────────────────────────────────────────────────────────────────

// CreateSale abre una venta en la sesión del cajero.
func (p *Pos) CreateSale(ctx context.Context, a Actor, sessionID, clientSaleID string) (domain.Sale, error) {
	now := p.now()
	return p.store.CreateSale(ctx, domain.Sale{ID: p.newID(), TenantID: a.TenantID, SessionID: sessionID, CashierID: a.UserID,
		ClientSaleID: strings.TrimSpace(clientSaleID), CreatedAt: now, UpdatedAt: now})
}

// LineInput es lo que el cajero agrega: producto, cantidad y descuento.
type LineInput struct {
	ProductID     string
	QtyMilli      int64
	DiscountMinor int64
}

// UpdateSale reemplaza las líneas: cada precio, nombre y tasa salen del catálogo vigente (el
// cliente nunca fija el precio) y quedan como instantánea. R3: descuentos requieren permiso.
func (p *Pos) UpdateSale(ctx context.Context, a Actor, saleID string, expectedVersion int32, inputs []LineInput) (domain.Sale, error) {
	if len(inputs) > 200 {
		return domain.Sale{}, domain.ErrInvalidLine
	}
	lines := make([]domain.Line, 0, len(inputs))
	currency := ""
	// R3 + R14: el tope de descuento sin supervisor sale de la configuración de caja.
	var settings *domain.Settings
	for _, in := range inputs {
		if in.DiscountMinor > 0 && !a.Permissions["pos:discount:apply"] && settings == nil {
			st, err := p.store.Settings(ctx, a.TenantID)
			if err != nil {
				return domain.Sale{}, err
			}
			settings = &st
		}
		if _, err := uuid.Parse(in.ProductID); err != nil {
			return domain.Sale{}, client.ErrProductNotFound
		}
		prod, err := p.catalog.Product(ctx, a.who(), in.ProductID)
		if err != nil {
			return domain.Sale{}, err
		}
		if !prod.Active {
			return domain.Sale{}, domain.ErrProductInactive
		}
		if currency == "" {
			currency = prod.Currency
		} else if currency != prod.Currency {
			return domain.Sale{}, domain.ErrInvalidLine
		}
		l := domain.Line{ID: p.newID(), ProductID: prod.ID, Description: prod.Name, QtyMilli: in.QtyMilli,
			UnitPriceMinor: prod.PriceMinor, DiscountMinor: in.DiscountMinor, TaxRateBps: prod.TaxRateBps,
			TracksInventory: prod.TracksInventory}
		if err := l.Price(); err != nil {
			return domain.Sale{}, err
		}
		if settings != nil && !a.Permissions["pos:discount:apply"] {
			ok, err := settings.DiscountWithinLimit(l)
			if err != nil {
				return domain.Sale{}, err
			}
			if !ok {
				return domain.Sale{}, ErrDiscountNotAllowed
			}
		}
		lines = append(lines, l)
	}
	return p.store.MutateSale(ctx, a.TenantID, saleID, expectedVersion, func(s *domain.Sale) error {
		if s.CashierID != a.UserID {
			return domain.ErrNotYourSession
		}
		if err := s.Editable(); err != nil {
			return err
		}
		if currency != "" && currency != s.Currency {
			return domain.ErrInvalidLine
		}
		s.Lines = lines
		return s.Recalculate()
	}, p.onPaid, p.now())
}

// ErrDiscountNotAllowed: el descuento pasa el tope de la caja y el cajero no tiene
// `pos:discount:apply` (SPEC R3, R14).
var ErrDiscountNotAllowed = errors.New("discount requires pos:discount:apply")

// Checkout cobra la venta (R4). El efectivo queda cobrado al instante; la billetera queda
// PENDIENTE hasta que payments-core publique el cobro con `reference = {sale, id}`.
func (p *Pos) Checkout(ctx context.Context, a Actor, saleID string, tenders []domain.Tender) (domain.Sale, error) {
	// R14: un medio desactivado en la configuración de caja no se acepta (rige en la venta siguiente).
	st, err := p.store.Settings(ctx, a.TenantID)
	if err != nil {
		return domain.Sale{}, err
	}
	for i := range tenders {
		if !st.RailEnabled(tenders[i].Rail) && (tenders[i].Rail == domain.RailCash || tenders[i].Rail == domain.RailWallet) {
			return domain.Sale{}, domain.ErrRailNotSupported
		}
		tenders[i].ID = p.newID()
	}
	return p.store.MutateSale(ctx, a.TenantID, saleID, 0, func(s *domain.Sale) error {
		if s.CashierID != a.UserID {
			return domain.ErrNotYourSession
		}
		return s.PrepareCheckout(tenders)
	}, p.onPaid, p.now())
}

// VoidSale anula una venta sin cobros electrónicos (R8).
func (p *Pos) VoidSale(ctx context.Context, a Actor, saleID, reason string) (domain.Sale, error) {
	return p.store.MutateSale(ctx, a.TenantID, saleID, 0, func(s *domain.Sale) error {
		return s.Void(reason)
	}, p.onPaid, p.now())
}

// ParkSale estaciona una venta (F17.4): solo el cajero de la sesión, con la caja abierta. No toca
// inventario: una venta de caja descuenta existencias al pagarse (stock_tasks), nunca al estacionarse.
func (p *Pos) ParkSale(ctx context.Context, a Actor, saleID, label string) (domain.Sale, error) {
	now := p.now()
	return p.store.MutateSaleInOpenSession(ctx, a.TenantID, saleID, func(s *domain.Sale) error {
		if s.CashierID != a.UserID {
			return domain.ErrNotYourSession
		}
		return s.Park(label, now)
	}, now)
}

// ResumeSale retoma una venta estacionada de la sesión del cajero (F17.4).
func (p *Pos) ResumeSale(ctx context.Context, a Actor, saleID string) (domain.Sale, error) {
	return p.store.MutateSaleInOpenSession(ctx, a.TenantID, saleID, func(s *domain.Sale) error {
		if s.CashierID != a.UserID {
			return domain.ErrNotYourSession
		}
		return s.Resume()
	}, p.now())
}

// GetSale lee una venta.
func (p *Pos) GetSale(ctx context.Context, a Actor, id string) (domain.Sale, error) {
	return p.store.GetSale(ctx, a.TenantID, id)
}

// ListSales es el historial; sin rango, los últimos 30 días.
func (p *Pos) ListSales(ctx context.Context, a Actor, f store.SaleFilter) ([]domain.Sale, *store.SaleCursor, error) {
	if f.To.IsZero() {
		f.To = p.now().Add(time.Minute)
	}
	if f.From.IsZero() {
		f.From = f.To.AddDate(0, 0, -30)
	}
	return p.store.ListSales(ctx, a.TenantID, f)
}

// onPaid: SalePaid al outbox y una tarea de stock por línea que lleva inventario.
func (p *Pos) onPaid(s domain.Sale) ([]store.OutboxEvent, []store.StockTask, error) {
	msg := &pb.SalePaid{SaleId: s.ID, TenantId: s.TenantID, CashierUserId: s.CashierID,
		Total: &pb.Money{AmountMinor: s.TotalMinor, Currency: s.Currency}}
	var tasks []store.StockTask
	for _, l := range s.Lines {
		msg.Lines = append(msg.Lines, &pb.SaleLine{LineId: l.ID, ProductId: l.ProductID, Description: l.Description,
			QuantityMilli: l.QtyMilli, UnitPrice: &pb.Money{AmountMinor: l.UnitPriceMinor, Currency: s.Currency},
			Discount: &pb.Money{AmountMinor: l.DiscountMinor, Currency: s.Currency}, TaxRateBps: l.TaxRateBps,
			LineTotal: &pb.Money{AmountMinor: l.LineTotalMinor, Currency: s.Currency}})
		if l.TracksInventory {
			tasks = append(tasks, store.StockTask{ID: p.newID(), LineID: l.ID, ProductID: l.ProductID, QtyMilli: l.QtyMilli,
				MovementType: int16(pb.MovementType_MOVEMENT_TYPE_SALE), IdempotencyKey: "sale:" + s.ID + ":" + l.ID})
		}
	}
	b, err := proto.Marshal(msg)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal SalePaid: %w", err)
	}
	return []store.OutboxEvent{{ID: p.newID(), TenantID: s.TenantID, AggregateID: s.ID, Subject: events.SubjectSalePaid,
		Payload: b, CreatedAt: p.now()}}, tasks, nil
}

// HandlePayment aplica un cobro electrónico resuelto (consumidor de PP_PAYMENTS).
func (p *Pos) HandlePayment(ctx context.Context, e store.PaymentEvent) (bool, error) {
	e.Processed = p.now()
	return p.store.ApplyPaymentEvent(ctx, e, p.onPaid)
}

// StockBackoff de los reintentos hacia inventory (30 s, 1, 2, 5, 15 min y luego cada 30 min).
var StockBackoff = []time.Duration{30 * time.Second, time.Minute, 2 * time.Minute, 5 * time.Minute, 15 * time.Minute, 30 * time.Minute}

// StockOutcome resume una vuelta del worker.
type StockOutcome struct{ Done, Retried, Failed int }

// DeliverStock entrega a inventory las tareas vencidas. Un rechazo definitivo (producto borrado,
// sin inventario) marca la venta para revisión; una caída de inventory reintenta con backoff.
func (p *Pos) DeliverStock(ctx context.Context, limit int, report func(store.StockTask, error)) (StockOutcome, error) {
	var out StockOutcome
	tasks, err := p.store.ClaimStockTasks(ctx, limit, p.now())
	if err != nil {
		return out, err
	}
	for _, t := range tasks {
		err := p.inventory.Move(ctx, client.Who{TenantID: t.TenantID, UserID: t.CashierID}, t.IdempotencyKey, t.SaleID,
			t.ProductID, t.MovementType, t.QtyMilli)
		switch {
		case err == nil:
			if ferr := p.store.FinishStockTask(ctx, t, false, "", p.now()); ferr != nil {
				return out, ferr
			}
			out.Done++
		case errors.Is(err, client.ErrUnavailable):
			i := t.Attempts - 1
			if i < 0 {
				i = 0
			}
			if i >= len(StockBackoff) {
				i = len(StockBackoff) - 1
			}
			if rerr := p.store.RetryStockTask(ctx, t, err.Error(), p.now().Add(StockBackoff[i])); rerr != nil {
				return out, rerr
			}
			report(t, err)
			out.Retried++
		default:
			if ferr := p.store.FinishStockTask(ctx, t, true, err.Error(), p.now()); ferr != nil {
				return out, ferr
			}
			report(t, err)
			out.Failed++
		}
	}
	return out, nil
}

// ── Configuración de caja (F17.11, R14) ────────────────────────────────────────────────────

// Settings devuelve la configuración vigente del comercio (o la de por defecto).
func (p *Pos) Settings(ctx context.Context, a Actor) (domain.Settings, error) {
	return p.store.Settings(ctx, a.TenantID)
}

// UpdateSettings valida y guarda con la versión que el cliente leyó.
func (p *Pos) UpdateSettings(ctx context.Context, a Actor, st domain.Settings) (domain.Settings, error) {
	st = st.Normalize()
	if err := st.Validate(); err != nil {
		return st, err
	}
	return p.store.SaveSettings(ctx, a.TenantID, st, a.UserID, p.now())
}
