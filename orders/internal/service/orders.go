// Package service orquesta orders: carrito, cotización, la saga de checkout (R3), la aceptación
// por comercio con SLA (R4), rechazos y cancelaciones con reembolso (R5, R9) y sus compensaciones.
package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"plentypay/orders/internal/client"
	"plentypay/orders/internal/domain"
	"plentypay/orders/internal/events"
	"plentypay/orders/internal/pb"
	"plentypay/orders/internal/store"
)

// Plazos de la saga.
const (
	IntentTTLSeconds   = 900                    // el cobro vence en 15 min
	ReservationTTL     = IntentTTLSeconds + 300 // R3.3: expiración del intent + 5 min
	DefaultAcceptSLA   = 15 * time.Minute       // R4
	StaleWithoutIntent = 2 * time.Minute        // saga cortada antes de crear el cobro
)

// Store es lo que el servicio usa de la persistencia.
type Store interface {
	Cart(ctx context.Context, userID string) ([]domain.CartItem, error)
	SetCartItem(ctx context.Context, userID string, it domain.CartItem) error
	ClearCart(ctx context.Context, userID string) error
	SaveQuote(ctx context.Context, q domain.Quote) error
	Quote(ctx context.Context, userID, id string) (domain.Quote, error)
	CreateOrder(ctx context.Context, o domain.Order) (domain.Order, bool, error)
	SetReservation(ctx context.Context, subID, reservationID string) error
	SetIntent(ctx context.Context, orderID, intentID string) error
	Mutate(ctx context.Context, who store.Who, orderID, eventID string, now time.Time,
		fn func(o *domain.Order) (store.Change, error)) (domain.Order, bool, error)
	OrderBySub(ctx context.Context, who store.Who, subID string) (string, error)
	GetOrder(ctx context.Context, who store.Who, id string) (domain.Order, error)
	ListMyOrders(ctx context.Context, userID string, status domain.OrderStatus, offset, limit int) ([]domain.Order, bool, error)
	ListMerchantSubs(ctx context.Context, tenantID string, status domain.SubStatus, from, to time.Time, offset, limit int) ([]domain.SubOrder, bool, error)
	DueAcceptance(ctx context.Context, now time.Time, limit int) ([]string, error)
	StalePending(ctx context.Context, before time.Time, limit int) ([]store.Stale, error)
	ClaimTasks(ctx context.Context, now time.Time, limit int) ([]store.Task, error)
	FinishTask(ctx context.Context, id string, failed bool, cause string, now time.Time) error
	RetryTask(ctx context.Context, id, cause string, next time.Time) error
}

// Deps son los otros servicios.
type Deps interface {
	MarketplaceProduct(ctx context.Context, buyer, requestID, productID string) (client.Listing, error)
	Reserve(ctx context.Context, tenantID, requestID, key, subOrderID string, lines []client.ReserveLine, ttlSeconds int32) (string, error)
	Commit(ctx context.Context, tenantID, reservationID string) error
	Release(ctx context.Context, tenantID, reservationID string) error
	Return(ctx context.Context, tenantID, key, subOrderID, productID string, qtyMilli int64) error
	CreateIntent(ctx context.Context, buyer, requestID, stepUp, key, orderID, currency string, total int64, rail int32,
		splits []client.Split, ttlSeconds int32) (client.Intent, error)
	GetIntent(ctx context.Context, intentID string) (client.Intent, error)
	Refund(ctx context.Context, key, paymentID, tenantID, reason string) error
}

// Orders implementa los casos de uso.
type Orders struct {
	store     Store
	deps      Deps
	now       func() time.Time
	newID     func() string
	acceptSLA time.Duration
}

// New arma el servicio.
func New(st Store, deps Deps, now func() time.Time, newID func() string, acceptSLA time.Duration) *Orders {
	if acceptSLA <= 0 {
		acceptSLA = DefaultAcceptSLA
	}
	return &Orders{store: st, deps: deps, now: now, newID: newID, acceptSLA: acceptSLA}
}

// NewUUIDv7 es el generador de ids de producción.
func NewUUIDv7() string { return uuid.Must(uuid.NewV7()).String() }

// Buyer es quien compra.
type Buyer struct {
	UserID    string
	RequestID string
}

// ── Carrito ────────────────────────────────────────────────────────────────────────────────

// SetCartItem agrega o cambia un producto con la instantánea vigente; qty = 0 lo quita (R2).
func (s *Orders) SetCartItem(ctx context.Context, b Buyer, productID string, qtyMilli int64) ([]domain.CartItem, error) {
	if qtyMilli < 0 || qtyMilli > domain.MaxQtyMilli {
		return nil, domain.ErrInvalidQty
	}
	if qtyMilli == 0 {
		if err := s.store.SetCartItem(ctx, b.UserID, domain.CartItem{ProductID: productID}); err != nil {
			return nil, err
		}
		return s.store.Cart(ctx, b.UserID)
	}
	if _, err := uuid.Parse(productID); err != nil {
		return nil, domain.ErrListingUnavailable
	}
	l, err := s.deps.MarketplaceProduct(ctx, b.UserID, b.RequestID, productID)
	if errors.Is(err, client.ErrNotFound) {
		return nil, domain.ErrListingUnavailable
	}
	if err != nil {
		return nil, err
	}
	if err := s.store.SetCartItem(ctx, b.UserID, domain.CartItem{ProductID: l.ProductID, TenantID: l.TenantID, QtyMilli: qtyMilli,
		UnitPriceMinor: l.PriceMinor, Name: l.Name, AddedAt: s.now()}); err != nil {
		return nil, err
	}
	return s.store.Cart(ctx, b.UserID)
}

// Cart lee el carrito.
func (s *Orders) Cart(ctx context.Context, b Buyer) ([]domain.CartItem, error) {
	return s.store.Cart(ctx, b.UserID)
}

// ClearCart vacía el carrito.
func (s *Orders) ClearCart(ctx context.Context, b Buyer) error {
	return s.store.ClearCart(ctx, b.UserID)
}

// ── Cotización ─────────────────────────────────────────────────────────────────────────────

// price arma la cotización con precios, nombres y disponibilidad VIGENTES (nunca los del carrito).
func (s *Orders) price(ctx context.Context, b Buyer, items []domain.CartItem, fulfillment int16) (domain.Quote, error) {
	q := domain.Quote{ID: s.newID(), BuyerID: b.UserID, Currency: "USD", CreatedAt: s.now(), ExpiresAt: s.now().Add(domain.QuoteTTL)}
	by := map[string]int{}
	for _, it := range items {
		l, err := s.deps.MarketplaceProduct(ctx, b.UserID, b.RequestID, it.ProductID)
		if errors.Is(err, client.ErrNotFound) {
			return q, domain.ErrListingUnavailable
		}
		if err != nil {
			return q, err
		}
		if l.Currency != "USD" {
			return q, domain.ErrListingUnavailable
		}
		if fulfillment == 2 && !l.Pickup {
			return q, domain.ErrListingUnavailable
		}
		i, ok := by[l.TenantID]
		if !ok {
			i = len(q.Merchants)
			by[l.TenantID] = i
			q.Merchants = append(q.Merchants, domain.MerchantQuote{TenantID: l.TenantID, MerchantName: l.MerchantName})
		}
		line := domain.Line{ProductID: l.ProductID, Name: l.Name, QtyMilli: it.QtyMilli, UnitPriceMinor: l.PriceMinor,
			TaxRateBps: l.TaxRateBps, TracksInventory: l.TracksInventory}
		if err := line.Price(); err != nil {
			return q, err
		}
		q.Merchants[i].Lines = append(q.Merchants[i].Lines, line)
		if !l.InStock {
			q.Merchants[i].Unavailable = append(q.Merchants[i].Unavailable, l.ProductID)
		}
	}
	return q, q.Sum()
}

// QuoteCheckout cotiza el carrito. Hoy solo retiro en tienda: la entrega a domicilio necesita
// logistics (F18).
func (s *Orders) QuoteCheckout(ctx context.Context, b Buyer, fulfillment int16) (domain.Quote, error) {
	if fulfillment == 1 {
		return domain.Quote{}, domain.ErrDeliveryUnavailable
	}
	items, err := s.store.Cart(ctx, b.UserID)
	if err != nil {
		return domain.Quote{}, err
	}
	if len(items) == 0 {
		return domain.Quote{}, domain.ErrEmptyCart
	}
	q, err := s.price(ctx, b, items, 2)
	if err != nil {
		return q, err
	}
	return q, s.store.SaveQuote(ctx, q)
}

// ── Saga de checkout (R3) ──────────────────────────────────────────────────────────────────

// CheckoutRequest es lo que confirma el comprador.
type CheckoutRequest struct {
	IdempotencyKey string
	QuoteID        string
	Fulfillment    int16
	Rail           int32
	StepUp         string
}

func (s *Orders) subChanged(o domain.Order, sub domain.SubOrder) (store.OutboxEvent, error) {
	b, err := proto.Marshal(&pb.SubOrderStatusChanged{SubOrderId: sub.ID, OrderId: o.ID, MerchantTenantId: sub.TenantID,
		Status: pb.SubOrderStatus(sub.Status), BuyerUserId: o.BuyerID})
	if err != nil {
		return store.OutboxEvent{}, fmt.Errorf("marshal SubOrderStatusChanged: %w", err)
	}
	return store.OutboxEvent{ID: s.newID(), TenantID: sub.TenantID, AggregateID: sub.ID, Subject: events.SubjectSubOrderStatus,
		Payload: b, CreatedAt: s.now()}, nil
}

func (s *Orders) task(o domain.Order, sub domain.SubOrder, kind, key string) store.Task {
	return store.Task{ID: s.newID(), OrderID: o.ID, SubOrderID: sub.ID, TenantID: sub.TenantID, UserID: o.BuyerID, Kind: kind, IdempotencyKey: key}
}

// cancelUnpaid cancela un pedido sin cobro y libera lo reservado (compensación de R3).
func (s *Orders) cancelUnpaid(ctx context.Context, orderID, eventID, reason string) (domain.Order, error) {
	o, _, err := s.store.Mutate(ctx, store.Who{System: true}, orderID, eventID, s.now(), func(o *domain.Order) (store.Change, error) {
		ch := store.Change{CancelReason: reason}
		if o.Status != domain.OrderPendingPayment {
			return ch, nil // ya pagado o ya cancelado: nada que compensar aquí
		}
		for i := range o.Subs {
			sub := &o.Subs[i]
			sub.Status = domain.SubCancelled
			if sub.ReservationID != "" {
				ch.Tasks = append(ch.Tasks, s.task(*o, *sub, "RELEASE", "release:"+sub.ID))
			}
		}
		return ch, nil
	})
	return o, err
}

// Checkout ejecuta la saga. Repetirla con la misma clave devuelve el mismo pedido (aceptación 4).
func (s *Orders) Checkout(ctx context.Context, b Buyer, r CheckoutRequest) (domain.Order, error) {
	if r.Fulfillment == 1 {
		return domain.Order{}, domain.ErrDeliveryUnavailable
	}
	if r.Rail != 0 && r.Rail != 1 {
		return domain.Order{}, ErrRailNotSupported
	}
	quoted, err := s.store.Quote(ctx, b.UserID, r.QuoteID)
	if err != nil {
		return domain.Order{}, err
	}
	// 1. Recotizar: si el total cambió, PRICE_CHANGED sin efectos.
	items, err := s.store.Cart(ctx, b.UserID)
	if err != nil {
		return domain.Order{}, err
	}
	now, err := s.price(ctx, b, items, 2)
	if err != nil {
		return domain.Order{}, err
	}
	if now.TotalMinor != quoted.TotalMinor || len(now.Merchants) != len(quoted.Merchants) {
		return domain.Order{}, domain.ErrPriceChanged
	}
	for _, m := range now.Merchants {
		if !m.AllInStock {
			return domain.Order{}, domain.ErrOutOfStock
		}
	}
	// 2. Pedido + sub-pedidos en una transacción local.
	o := domain.Order{ID: s.newID(), BuyerID: b.UserID, Currency: now.Currency, TotalMinor: now.TotalMinor, Fulfillment: 2,
		IdempotencyKey: r.IdempotencyKey, CreatedAt: s.now()}
	for _, m := range now.Merchants {
		o.Subs = append(o.Subs, domain.SubOrder{ID: s.newID(), TenantID: m.TenantID, Lines: m.Lines, TotalMinor: m.TotalMinor})
	}
	o, _, err = s.store.CreateOrder(ctx, o)
	if err != nil {
		return o, err
	}
	// Un reintento con la misma clave retoma la saga donde quedó (reservas y cobro son
	// idempotentes por su clave); un pedido ya cobrado o cerrado se devuelve tal cual.
	if o.PaymentIntentID != "" || o.Status != domain.OrderPendingPayment {
		return o, nil
	}
	// 3. Reservas por comercio (solo líneas que llevan inventario).
	for i, sub := range o.Subs {
		if sub.ReservationID != "" {
			continue
		}
		var lines []client.ReserveLine
		for _, l := range sub.Lines {
			if l.TracksInventory {
				lines = append(lines, client.ReserveLine{ProductID: l.ProductID, QtyMilli: l.QtyMilli})
			}
		}
		if len(lines) == 0 {
			continue
		}
		res, err := s.deps.Reserve(ctx, sub.TenantID, b.RequestID, "order:"+sub.ID, sub.ID, lines, ReservationTTL)
		if err != nil {
			if _, cerr := s.cancelUnpaid(ctx, o.ID, "", "reserve_failed"); cerr != nil {
				return o, errors.Join(err, cerr)
			}
			var rej *client.Rejected
			if errors.As(err, &rej) && rej.Reason == "OUT_OF_STOCK" {
				return o, domain.ErrOutOfStock
			}
			return o, err
		}
		if err := s.store.SetReservation(ctx, sub.ID, res); err != nil {
			return o, err
		}
		o.Subs[i].ReservationID = res
	}
	// 4. UN cobro con un split por comercio.
	var splits []client.Split
	for _, sub := range o.Subs {
		splits = append(splits, client.Split{TenantID: sub.TenantID, SubOrderID: sub.ID, AmountMinor: sub.TotalMinor})
	}
	intent, err := s.deps.CreateIntent(ctx, b.UserID, b.RequestID, r.StepUp, "order:"+o.ID, o.ID, o.Currency, o.TotalMinor, 1, splits, IntentTTLSeconds)
	if err != nil {
		var rej *client.Rejected
		if errors.As(err, &rej) && rej.Reason != "STEP_UP_REQUIRED" && rej.Reason != "STEP_UP_INVALID" {
			// "No" definitivo (límites, comercio inactivo…): se compensa ya.
			if _, cerr := s.cancelUnpaid(ctx, o.ID, "", "payment_rejected:"+rej.Reason); cerr != nil {
				return o, errors.Join(err, cerr)
			}
		}
		// Falta la confirmación fuerte (el comprador reintenta con su token y la misma clave) o la
		// respuesta fue ambigua: el pedido queda pendiente y, si nunca obtiene su cobro, el job de
		// recuperación lo cancela y libera las reservas.
		return o, err
	}
	if err := s.store.SetIntent(ctx, o.ID, intent.ID); err != nil {
		return o, err
	}
	o.PaymentIntentID = intent.ID
	return o, nil
}

// ErrRailNotSupported: hoy el marketplace cobra solo con saldo PlentyPay.
var ErrRailNotSupported = errors.New("rail not supported")

// ── Eventos de pagos ───────────────────────────────────────────────────────────────────────

// PaymentCaptured (R3.6): pedido PAID, sub-pedidos esperando aceptación con su plazo, reservas
// confirmadas y eventos, en una transacción. Un cobro que llega sobre un pedido ya cancelado se
// reembolsa entero (nunca queda dinero cobrado sin pedido).
func (s *Orders) PaymentCaptured(ctx context.Context, eventID, orderID, paymentID string) error {
	_, _, err := s.store.Mutate(ctx, store.Who{System: true}, orderID, eventID, s.now(), func(o *domain.Order) (store.Change, error) {
		var ch store.Change
		if o.Paid() {
			return ch, nil
		}
		o.PaymentID = paymentID
		if o.Status == domain.OrderCancelled {
			for _, sub := range o.Subs {
				ch.Tasks = append(ch.Tasks, s.task(*o, sub, "REFUND", "late-payment-refund:"+sub.ID))
			}
			return ch, nil
		}
		// Lo comprado sale del carrito en la misma transacción que el pago (nunca antes: un
		// reintento con step-up recotiza el mismo carrito).
		ch.ClearCart = true
		var merchants []string
		for i := range o.Subs {
			sub := &o.Subs[i]
			sub.Status = domain.SubAwaitingAcceptance
			sub.AcceptDeadline = s.now().Add(s.acceptSLA)
			if sub.ReservationID != "" {
				ch.Tasks = append(ch.Tasks, s.task(*o, *sub, "COMMIT", "commit:"+sub.ID))
			}
			e, err := s.subChanged(*o, *sub)
			if err != nil {
				return ch, err
			}
			ch.Events = append(ch.Events, e)
			merchants = append(merchants, sub.TenantID)
		}
		b, err := proto.Marshal(&pb.OrderPaid{OrderId: o.ID, BuyerUserId: o.BuyerID,
			GrandTotal: &pb.Money{AmountMinor: o.TotalMinor, Currency: o.Currency}, MerchantTenantIds: merchants})
		if err != nil {
			return ch, fmt.Errorf("marshal OrderPaid: %w", err)
		}
		ch.Events = append(ch.Events, store.OutboxEvent{ID: s.newID(), TenantID: o.BuyerID, AggregateID: o.ID,
			Subject: events.SubjectOrderPaid, Payload: b, CreatedAt: s.now()})
		return ch, nil
	})
	if errors.Is(err, domain.ErrNotFound) {
		return nil // la referencia no es un pedido de este servicio
	}
	return err
}

// PaymentFailed (R3.7): cancela y libera las reservas.
func (s *Orders) PaymentFailed(ctx context.Context, eventID, orderID string) error {
	_, err := s.cancelUnpaid(ctx, orderID, eventID, "payment_failed")
	if errors.Is(err, domain.ErrNotFound) {
		return nil
	}
	return err
}

// ── Comercio ───────────────────────────────────────────────────────────────────────────────

// Merchant es quien atiende un sub-pedido.
type Merchant struct {
	TenantID string
	UserID   string
}

// lose rechaza o cancela un sub-pedido pagado: reembolso de su split y, si sus reservas ya se
// confirmaron como venta, devolución de existencias (R5).
func (s *Orders) lose(o *domain.Order, sub *domain.SubOrder, to domain.SubStatus, reason string, ch *store.Change) error {
	if !sub.Status.CanTransition(to) {
		return domain.ErrInvalidTransition
	}
	committed := sub.Status != domain.SubAwaitingAcceptance || sub.ReservationID != ""
	sub.Status, sub.RejectReason = to, reason
	if o.Paid() {
		ch.Tasks = append(ch.Tasks, s.task(*o, *sub, "REFUND", "suborder-reject:"+sub.ID))
	}
	if committed {
		for _, l := range sub.Lines {
			if l.TracksInventory {
				ch.Tasks = append(ch.Tasks, store.Task{ID: s.newID(), OrderID: o.ID, SubOrderID: sub.ID, TenantID: sub.TenantID,
					UserID: o.BuyerID, Kind: "RETURN", IdempotencyKey: "return:" + sub.ID + ":" + l.ProductID})
			}
		}
	}
	e, err := s.subChanged(*o, *sub)
	if err != nil {
		return err
	}
	ch.Events = append(ch.Events, e)
	return nil
}

func (s *Orders) actOnSub(ctx context.Context, m Merchant, subID string, fn func(o *domain.Order, sub *domain.SubOrder, ch *store.Change) error) (domain.SubOrder, error) {
	who := store.Who{TenantID: m.TenantID}
	orderID, err := s.store.OrderBySub(ctx, who, subID)
	if err != nil {
		return domain.SubOrder{}, err
	}
	var out domain.SubOrder
	_, _, err = s.store.Mutate(ctx, who, orderID, "", s.now(), func(o *domain.Order) (store.Change, error) {
		var ch store.Change
		for i := range o.Subs {
			if o.Subs[i].ID != subID {
				continue
			}
			if o.Subs[i].TenantID != m.TenantID {
				return ch, domain.ErrNotFound
			}
			if err := fn(o, &o.Subs[i], &ch); err != nil {
				return ch, err
			}
			out = o.Subs[i]
			return ch, nil
		}
		return ch, domain.ErrNotFound
	})
	return out, err
}

// Accept acepta dentro del plazo (R4).
func (s *Orders) Accept(ctx context.Context, m Merchant, subID string) (domain.SubOrder, error) {
	return s.actOnSub(ctx, m, subID, func(o *domain.Order, sub *domain.SubOrder, ch *store.Change) error {
		if sub.Status == domain.SubAccepted {
			return nil
		}
		if !sub.Status.CanTransition(domain.SubAccepted) {
			return domain.ErrInvalidTransition
		}
		if !s.now().Before(sub.AcceptDeadline) {
			return domain.ErrDeadlinePassed
		}
		sub.Status = domain.SubAccepted
		e, err := s.subChanged(*o, *sub)
		ch.Events = append(ch.Events, e)
		return err
	})
}

// Reject rechaza con motivo; se reembolsa el split (R5).
func (s *Orders) Reject(ctx context.Context, m Merchant, subID, reason string) (domain.SubOrder, error) {
	if reason == "" || len(reason) > 300 {
		return domain.SubOrder{}, domain.ErrReasonRequired
	}
	return s.actOnSub(ctx, m, subID, func(o *domain.Order, sub *domain.SubOrder, ch *store.Change) error {
		if sub.Status == domain.SubRejected {
			return nil
		}
		return s.lose(o, sub, domain.SubRejected, reason, ch)
	})
}

// pickupCode es el código de retiro de 6 dígitos (R6).
func pickupCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("pickup code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// MarkReady: listo para retirar, con su código (R6).
func (s *Orders) MarkReady(ctx context.Context, m Merchant, subID string) (domain.SubOrder, error) {
	return s.actOnSub(ctx, m, subID, func(o *domain.Order, sub *domain.SubOrder, ch *store.Change) error {
		if sub.Status == domain.SubReady {
			return nil
		}
		if !sub.Status.CanTransition(domain.SubReady) {
			return domain.ErrInvalidTransition
		}
		code, err := pickupCode()
		if err != nil {
			return err
		}
		sub.Status, sub.PickupCode = domain.SubReady, code
		e, err := s.subChanged(*o, *sub)
		ch.Events = append(ch.Events, e)
		return err
	})
}

// MarkCompleted: entregado al cliente. Con retiro en tienda exige el código del comprador (R6).
func (s *Orders) MarkCompleted(ctx context.Context, m Merchant, subID, code string) (domain.SubOrder, error) {
	return s.actOnSub(ctx, m, subID, func(o *domain.Order, sub *domain.SubOrder, ch *store.Change) error {
		if sub.Status == domain.SubCompleted {
			return nil
		}
		if !sub.Status.CanTransition(domain.SubCompleted) {
			return domain.ErrInvalidTransition
		}
		if sub.Fulfillment == 2 && subtle.ConstantTimeCompare([]byte(code), []byte(sub.PickupCode)) != 1 {
			return domain.ErrPickupCode
		}
		sub.Status = domain.SubCompleted
		e, err := s.subChanged(*o, *sub)
		ch.Events = append(ch.Events, e)
		return err
	})
}

// ── Comprador ──────────────────────────────────────────────────────────────────────────────

// Cancel (R9): solo si ningún comercio aceptó todavía. Sin pagar: libera; pagado: reembolsa.
func (s *Orders) Cancel(ctx context.Context, b Buyer, orderID string) (domain.Order, error) {
	o, _, err := s.store.Mutate(ctx, store.Who{UserID: b.UserID}, orderID, "", s.now(), func(o *domain.Order) (store.Change, error) {
		ch := store.Change{CancelReason: "buyer"}
		if o.BuyerID != b.UserID {
			return ch, domain.ErrNotFound
		}
		for _, sub := range o.Subs {
			if sub.Status != domain.SubPendingPayment && sub.Status != domain.SubAwaitingAcceptance && !sub.Status.Lost() {
				return ch, domain.ErrInvalidTransition
			}
		}
		for i := range o.Subs {
			sub := &o.Subs[i]
			if sub.Status.Lost() {
				continue
			}
			if !o.Paid() {
				sub.Status = domain.SubCancelled
				if sub.ReservationID != "" {
					ch.Tasks = append(ch.Tasks, s.task(*o, *sub, "RELEASE", "release:"+sub.ID))
				}
				continue
			}
			if err := s.lose(o, sub, domain.SubCancelled, "buyer_cancelled", &ch); err != nil {
				return ch, err
			}
		}
		return ch, nil
	})
	return o, err
}

// GetOrder lee un pedido del comprador o de uno de sus comercios.
func (s *Orders) GetOrder(ctx context.Context, who store.Who, id string) (domain.Order, error) {
	return s.store.GetOrder(ctx, who, id)
}

// ListMyOrders pagina los pedidos del comprador.
func (s *Orders) ListMyOrders(ctx context.Context, b Buyer, status domain.OrderStatus, offset, limit int) ([]domain.Order, bool, error) {
	return s.store.ListMyOrders(ctx, b.UserID, status, offset, limit)
}

// ListMerchantSubs pagina los sub-pedidos del comercio (sin rango: 30 días).
func (s *Orders) ListMerchantSubs(ctx context.Context, m Merchant, status domain.SubStatus, from, to time.Time, offset, limit int) ([]domain.SubOrder, bool, error) {
	if to.IsZero() {
		to = s.now().Add(time.Minute)
	}
	if from.IsZero() {
		from = to.AddDate(0, 0, -30)
	}
	return s.store.ListMerchantSubs(ctx, m.TenantID, status, from, to, offset, limit)
}

// ── Jobs ───────────────────────────────────────────────────────────────────────────────────

// ExpireAcceptance (R4): sub-pedidos sin respuesta a tiempo → REJECTED (ACCEPTANCE_TIMEOUT) con
// reembolso de su split.
func (s *Orders) ExpireAcceptance(ctx context.Context, limit int) (int, error) {
	ids, err := s.store.DueAcceptance(ctx, s.now(), limit)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, id := range ids {
		_, applied, err := s.store.Mutate(ctx, store.Who{System: true}, id, "", s.now(), func(o *domain.Order) (store.Change, error) {
			var ch store.Change
			for i := range o.Subs {
				sub := &o.Subs[i]
				if sub.Status == domain.SubAwaitingAcceptance && !s.now().Before(sub.AcceptDeadline) {
					if err := s.lose(o, sub, domain.SubRejected, "ACCEPTANCE_TIMEOUT", &ch); err != nil {
						return ch, err
					}
				}
			}
			return ch, nil
		})
		if err != nil {
			return n, err
		}
		if applied {
			n++
		}
	}
	return n, nil
}

// RecoverPending cierra pedidos que la saga dejó sin resolver: sin cobro tras 2 min (cortada
// antes de crearlo), o con un cobro que ya venció. Un cobro capturado cuyo evento no llegó se
// aplica aquí (el consumidor lo ignorará después por idempotencia de estado).
func (s *Orders) RecoverPending(ctx context.Context, limit int) (int, error) {
	stale, err := s.store.StalePending(ctx, s.now().Add(-StaleWithoutIntent), limit)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, st := range stale {
		if st.IntentID == "" {
			if _, err := s.cancelUnpaid(ctx, st.OrderID, "", "saga_interrupted"); err != nil {
				return n, err
			}
			n++
			continue
		}
		in, err := s.deps.GetIntent(ctx, st.IntentID)
		if err != nil {
			continue // se reintenta en la siguiente vuelta
		}
		switch in.Status {
		case "PAYMENT_STATUS_CAPTURED":
			if err := s.PaymentCaptured(ctx, "", st.OrderID, in.PaymentID); err != nil {
				return n, err
			}
			n++
		case "PAYMENT_STATUS_FAILED", "PAYMENT_STATUS_CANCELLED", "PAYMENT_STATUS_EXPIRED":
			if _, err := s.cancelUnpaid(ctx, st.OrderID, "", "payment_"+in.Status); err != nil {
				return n, err
			}
			n++
		}
	}
	return n, nil
}

// TaskBackoff de las compensaciones (30 s, 1, 2, 5, 15 min y luego cada 30 min).
var TaskBackoff = []time.Duration{30 * time.Second, time.Minute, 2 * time.Minute, 5 * time.Minute, 15 * time.Minute, 30 * time.Minute}

// TaskOutcome resume una vuelta del worker.
type TaskOutcome struct{ Done, Retried, Failed int }

// RunTasks entrega las tareas vencidas con su clave determinista: un reintento nunca libera,
// confirma, devuelve ni reembolsa dos veces.
func (s *Orders) RunTasks(ctx context.Context, limit int, report func(store.Task, error)) (TaskOutcome, error) {
	var out TaskOutcome
	tasks, err := s.store.ClaimTasks(ctx, s.now(), limit)
	if err != nil {
		return out, err
	}
	for _, t := range tasks {
		err := s.runTask(ctx, t)
		var rej *client.Rejected
		switch {
		case err == nil:
			if ferr := s.store.FinishTask(ctx, t.ID, false, "", s.now()); ferr != nil {
				return out, ferr
			}
			out.Done++
		case errors.As(err, &rej) && rej.Reason == "INVALID_STATE_TRANSITION" && (t.Kind == "RELEASE" || t.Kind == "COMMIT"):
			// La reserva ya está en su estado final (vencida o liberada): nada más que hacer.
			if ferr := s.store.FinishTask(ctx, t.ID, false, rej.Reason, s.now()); ferr != nil {
				return out, ferr
			}
			out.Done++
		case errors.Is(err, client.ErrUnavailable) || errors.As(err, &rej):
			// Caído o rechazado por ahora (p. ej. el comercio sin saldo para reembolsar): reintento.
			i := t.Attempts - 1
			if i < 0 {
				i = 0
			}
			if i >= len(TaskBackoff) {
				i = len(TaskBackoff) - 1
			}
			if rerr := s.store.RetryTask(ctx, t.ID, err.Error(), s.now().Add(TaskBackoff[i])); rerr != nil {
				return out, rerr
			}
			report(t, err)
			out.Retried++
		default:
			if ferr := s.store.FinishTask(ctx, t.ID, true, err.Error(), s.now()); ferr != nil {
				return out, ferr
			}
			report(t, err)
			out.Failed++
		}
	}
	return out, nil
}

func (s *Orders) runTask(ctx context.Context, t store.Task) error {
	o, err := s.store.GetOrder(ctx, store.Who{System: true}, t.OrderID)
	if err != nil {
		return err
	}
	var sub *domain.SubOrder
	for i := range o.Subs {
		if o.Subs[i].ID == t.SubOrderID {
			sub = &o.Subs[i]
		}
	}
	if sub == nil {
		return domain.ErrNotFound
	}
	switch t.Kind {
	case "RELEASE":
		return s.deps.Release(ctx, sub.TenantID, sub.ReservationID)
	case "COMMIT":
		return s.deps.Commit(ctx, sub.TenantID, sub.ReservationID)
	case "REFUND":
		return s.deps.Refund(ctx, t.IdempotencyKey, o.PaymentID, sub.TenantID, "orders:"+sub.Status.String())
	case "RETURN":
		for _, l := range sub.Lines {
			if "return:"+sub.ID+":"+l.ProductID == t.IdempotencyKey {
				return s.deps.Return(ctx, sub.TenantID, t.IdempotencyKey, sub.ID, l.ProductID, l.QtyMilli)
			}
		}
		return domain.ErrNotFound
	}
	return fmt.Errorf("unknown task kind %q", t.Kind)
}
