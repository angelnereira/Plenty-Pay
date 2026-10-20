// Package store implementa la persistencia de orders sobre postgres-db con pgx v5.
//
// Atomicidad (event-chains §1.1): cada cambio de estado de un pedido escribe, en la MISMA
// transacción, sus sub-pedidos, sus tareas de saga (liberar/confirmar reservas, devolver stock,
// reembolsar) y sus eventos. Ninguna transacción abarca una llamada a otro servicio (como
// payments-core R6): el worker entrega las tareas después, con claves deterministas.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/orders/internal/domain"
)

// Store es el repositorio de orders.
type Store struct {
	pool *pgxpool.Pool
}

// Open conecta el pool (PgBouncer en modo transacción: protocolo simple).
func Open(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

// Close cierra el pool.
func (s *Store) Close() { s.pool.Close() }

// Pool expone el pool (pruebas L2).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// Who es quién lee o escribe: comprador, comercio o el propio servicio.
type Who struct {
	UserID   string
	TenantID string
	System   bool
}

func (s *Store) in(ctx context.Context, w Who, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		role := ""
		if w.System {
			role = "SYSTEM"
		}
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true), set_config('app.tenant_id', $2, true),
			set_config('app.actor_role', $3, true)`, w.UserID, w.TenantID, role); err != nil {
			return fmt.Errorf("set actor: %w", err)
		}
		return fn(tx)
	})
}

var system = Who{System: true}

// OutboxEvent es un evento a publicar junto con el cambio.
type OutboxEvent struct {
	ID          string
	TenantID    string
	AggregateID string
	Subject     string
	Payload     []byte
	CreatedAt   time.Time
}

// Task es un efecto externo de la saga.
type Task struct {
	ID             string
	OrderID        string
	SubOrderID     string
	TenantID       string
	UserID         string
	Kind           string // RELEASE | COMMIT | RETURN | REFUND
	IdempotencyKey string
	Attempts       int
}

func insertOutbox(ctx context.Context, tx pgx.Tx, e OutboxEvent) error {
	if _, err := tx.Exec(ctx, `INSERT INTO outbox (id, tenant_id, aggregate_id, subject, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, e.ID, e.TenantID, e.AggregateID, e.Subject, e.Payload, e.CreatedAt); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

func insertTasks(ctx context.Context, tx pgx.Tx, tasks []Task, now time.Time) error {
	for _, t := range tasks {
		var sub any
		if t.SubOrderID != "" {
			sub = t.SubOrderID
		}
		if _, err := tx.Exec(ctx, `INSERT INTO saga_tasks (id, order_id, sub_order_id, tenant_id, user_id, kind,
			idempotency_key, status, next_attempt_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$8)
			ON CONFLICT (idempotency_key) DO NOTHING`,
			t.ID, t.OrderID, sub, t.TenantID, t.UserID, t.Kind, t.IdempotencyKey, now); err != nil {
			return fmt.Errorf("insert saga task: %w", err)
		}
	}
	return nil
}

// ── Carrito ────────────────────────────────────────────────────────────────────────────────

// Cart lee el carrito del comprador.
func (s *Store) Cart(ctx context.Context, userID string) ([]domain.CartItem, error) {
	var out []domain.CartItem
	err := s.in(ctx, Who{UserID: userID}, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT product_id, tenant_id, qty_milli, unit_price_minor, name, added_at
			FROM cart_items ORDER BY added_at, product_id`)
		if err != nil {
			return fmt.Errorf("read cart: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var it domain.CartItem
			if err := rows.Scan(&it.ProductID, &it.TenantID, &it.QtyMilli, &it.UnitPriceMinor, &it.Name, &it.AddedAt); err != nil {
				return fmt.Errorf("scan cart item: %w", err)
			}
			out = append(out, it)
		}
		return rows.Err()
	})
	return out, err
}

// SetCartItem agrega, cambia (qty > 0) o quita (qty = 0) una línea, respetando los límites.
func (s *Store) SetCartItem(ctx context.Context, userID string, it domain.CartItem) error {
	return s.in(ctx, Who{UserID: userID}, func(tx pgx.Tx) error {
		if it.QtyMilli == 0 {
			_, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE product_id = $1`, it.ProductID)
			if err != nil {
				return fmt.Errorf("remove cart item: %w", err)
			}
			return nil
		}
		if _, err := tx.Exec(ctx, `INSERT INTO cart_items (user_id, product_id, tenant_id, qty_milli, unit_price_minor, name, added_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, product_id) DO UPDATE SET qty_milli = EXCLUDED.qty_milli,
			unit_price_minor = EXCLUDED.unit_price_minor, name = EXCLUDED.name`,
			userID, it.ProductID, it.TenantID, it.QtyMilli, it.UnitPriceMinor, it.Name, it.AddedAt); err != nil {
			return fmt.Errorf("upsert cart item: %w", err)
		}
		var lines, merchants int
		if err := tx.QueryRow(ctx, `SELECT count(*), count(DISTINCT tenant_id) FROM cart_items`).Scan(&lines, &merchants); err != nil {
			return fmt.Errorf("count cart: %w", err)
		}
		if lines > domain.MaxCartLines || merchants > domain.MaxCartMerchants {
			return domain.ErrCartLimit // la transacción se revierte
		}
		return nil
	})
}

// ClearCart vacía el carrito.
func (s *Store) ClearCart(ctx context.Context, userID string) error {
	return s.in(ctx, Who{UserID: userID}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM cart_items`); err != nil {
			return fmt.Errorf("clear cart: %w", err)
		}
		return nil
	})
}

// ── Cotizaciones ───────────────────────────────────────────────────────────────────────────

// SaveQuote guarda la cotización que el checkout debe respetar.
func (s *Store) SaveQuote(ctx context.Context, q domain.Quote) error {
	b, err := json.Marshal(q.Merchants)
	if err != nil {
		return fmt.Errorf("encode quote: %w", err)
	}
	return s.in(ctx, Who{UserID: q.BuyerID}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO quotes (id, user_id, merchants, total_minor, currency, expires_at, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`, q.ID, q.BuyerID, string(b), q.TotalMinor, q.Currency, q.ExpiresAt, q.CreatedAt); err != nil {
			return fmt.Errorf("insert quote: %w", err)
		}
		return nil
	})
}

// Quote lee una cotización del comprador.
func (s *Store) Quote(ctx context.Context, userID, id string) (domain.Quote, error) {
	q := domain.Quote{ID: id, BuyerID: userID}
	err := s.in(ctx, Who{UserID: userID}, func(tx pgx.Tx) error {
		var b []byte
		err := tx.QueryRow(ctx, `SELECT merchants, total_minor, currency, expires_at, created_at FROM quotes WHERE id = $1`, id).
			Scan(&b, &q.TotalMinor, &q.Currency, &q.ExpiresAt, &q.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("read quote: %w", err)
		}
		q.Currency = strings.TrimSpace(q.Currency)
		return json.Unmarshal(b, &q.Merchants)
	})
	return q, err
}

// ── Pedidos ────────────────────────────────────────────────────────────────────────────────

const orderCols = `id, user_id, status, currency, total_minor, fulfillment, coalesce(payment_intent_id::text, ''),
	coalesce(payment_id::text, ''), idempotency_key, created_at, updated_at`

const subCols = `id, order_id, tenant_id, user_id, status, fulfillment, lines, total_minor, coalesce(reservation_id::text, ''),
	pickup_code, reject_reason, coalesce(accept_deadline, 'epoch'::timestamptz), created_at, updated_at`

func scanOrder(row pgx.Row) (domain.Order, error) {
	var o domain.Order
	err := row.Scan(&o.ID, &o.BuyerID, &o.Status, &o.Currency, &o.TotalMinor, &o.Fulfillment, &o.PaymentIntentID,
		&o.PaymentID, &o.IdempotencyKey, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, domain.ErrNotFound
	}
	if err != nil {
		return o, fmt.Errorf("scan order: %w", err)
	}
	o.Currency = strings.TrimSpace(o.Currency)
	return o, nil
}

func scanSub(row pgx.Row) (domain.SubOrder, error) {
	var s domain.SubOrder
	var lines []byte
	err := row.Scan(&s.ID, &s.OrderID, &s.TenantID, &s.BuyerID, &s.Status, &s.Fulfillment, &lines, &s.TotalMinor,
		&s.ReservationID, &s.PickupCode, &s.RejectReason, &s.AcceptDeadline, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return s, domain.ErrNotFound
	}
	if err != nil {
		return s, fmt.Errorf("scan sub-order: %w", err)
	}
	return s, json.Unmarshal(lines, &s.Lines)
}

func loadSubs(ctx context.Context, tx pgx.Tx, orderID string, lock bool) ([]domain.SubOrder, error) {
	q := `SELECT ` + subCols + ` FROM sub_orders WHERE order_id = $1 ORDER BY id`
	if lock {
		q += ` FOR UPDATE`
	}
	rows, err := tx.Query(ctx, q, orderID)
	if err != nil {
		return nil, fmt.Errorf("load sub-orders: %w", err)
	}
	defer rows.Close()
	var out []domain.SubOrder
	for rows.Next() {
		s, err := scanSub(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func loadOrder(ctx context.Context, tx pgx.Tx, id string, lock bool) (domain.Order, error) {
	q := `SELECT ` + orderCols + ` FROM orders WHERE id = $1`
	if lock {
		q += ` FOR UPDATE`
	}
	o, err := scanOrder(tx.QueryRow(ctx, q, id))
	if err != nil {
		return o, err
	}
	o.Subs, err = loadSubs(ctx, tx, id, lock)
	return o, err
}

// CreateOrder crea el pedido PENDING_PAYMENT y sus sub-pedidos (R3.2). La misma clave del mismo
// comprador devuelve el pedido existente (aceptación 4: un solo pedido).
func (s *Store) CreateOrder(ctx context.Context, o domain.Order) (domain.Order, bool, error) {
	created := false
	var out domain.Order
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		id := ""
		err := tx.QueryRow(ctx, `SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2`, o.BuyerID, o.IdempotencyKey).Scan(&id)
		if err == nil {
			out, err = loadOrder(ctx, tx, id, false)
			return err
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("find order by key: %w", err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO orders (id, user_id, status, currency, total_minor, fulfillment, idempotency_key,
			created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
			o.ID, o.BuyerID, domain.OrderPendingPayment, o.Currency, o.TotalMinor, o.Fulfillment, o.IdempotencyKey, o.CreatedAt); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return errConcurrentKey
			}
			return fmt.Errorf("insert order: %w", err)
		}
		for _, sub := range o.Subs {
			lines, err := json.Marshal(sub.Lines)
			if err != nil {
				return fmt.Errorf("encode lines: %w", err)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO sub_orders (id, order_id, tenant_id, user_id, status, fulfillment, lines,
				total_minor, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
				sub.ID, o.ID, sub.TenantID, o.BuyerID, domain.SubPendingPayment, o.Fulfillment, string(lines), sub.TotalMinor, o.CreatedAt); err != nil {
				return fmt.Errorf("insert sub-order: %w", err)
			}
		}
		created = true
		out, err = loadOrder(ctx, tx, o.ID, false)
		return err
	})
	if errors.Is(err, errConcurrentKey) {
		return s.CreateOrder(ctx, o)
	}
	return out, created, err
}

var errConcurrentKey = errors.New("idempotency key inserted concurrently")

// SetReservation guarda la reserva de un sub-pedido (R3.3).
func (s *Store) SetReservation(ctx context.Context, subID, reservationID string) error {
	return s.in(ctx, system, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE sub_orders SET reservation_id = $2, updated_at = now() WHERE id = $1 AND reservation_id IS NULL`,
			subID, reservationID); err != nil {
			return fmt.Errorf("set reservation: %w", err)
		}
		return nil
	})
}

// SetIntent guarda el cobro creado (R3.4).
func (s *Store) SetIntent(ctx context.Context, orderID, intentID string) error {
	return s.in(ctx, system, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE orders SET payment_intent_id = $2, updated_at = now() WHERE id = $1 AND payment_intent_id IS NULL`,
			orderID, intentID); err != nil {
			return fmt.Errorf("set intent: %w", err)
		}
		return nil
	})
}

// Change es lo que un caso de uso decide sobre un pedido bloqueado.
type Change struct {
	Tasks  []Task
	Events []OutboxEvent
	// CancelReason se guarda si el pedido se cancela.
	CancelReason string
}

// Mutate bloquea el pedido y sus sub-pedidos, aplica `fn`, deriva el estado (R8) y guarda todo
// con sus tareas y eventos en UNA transacción. `eventID` no vacío = consumidor idempotente.
func (s *Store) Mutate(ctx context.Context, who Who, orderID, eventID string, now time.Time,
	fn func(o *domain.Order) (Change, error)) (domain.Order, bool, error) {
	applied := false
	var out domain.Order
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		if eventID != "" {
			tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id, processed_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`, eventID, now)
			if err != nil {
				return fmt.Errorf("record processed event: %w", err)
			}
			if tag.RowsAffected() == 0 {
				var err error
				out, err = loadOrder(ctx, tx, orderID, false)
				if errors.Is(err, domain.ErrNotFound) {
					return nil
				}
				return err
			}
		}
		o, err := loadOrder(ctx, tx, orderID, true)
		if err != nil {
			return err
		}
		// Autorización por fila (la transacción corre como SYSTEM para poder escribir).
		if !who.System {
			visible := who.UserID != "" && o.BuyerID == who.UserID
			for _, sub := range o.Subs {
				if who.TenantID != "" && sub.TenantID == who.TenantID {
					visible = true
				}
			}
			if !visible {
				return domain.ErrNotFound
			}
		}
		ch, err := fn(&o)
		if err != nil {
			return err
		}
		o.Recompute()
		o.UpdatedAt = now
		var intent, payment any
		if o.PaymentIntentID != "" {
			intent = o.PaymentIntentID
		}
		if o.PaymentID != "" {
			payment = o.PaymentID
		}
		if _, err := tx.Exec(ctx, `UPDATE orders SET status = $2, payment_intent_id = coalesce(payment_intent_id, $3::uuid),
			payment_id = coalesce(payment_id, $4::uuid), cancel_reason = CASE WHEN $5 <> '' THEN $5 ELSE cancel_reason END,
			updated_at = $6, version = version + 1 WHERE id = $1`, o.ID, o.Status, intent, payment, ch.CancelReason, now); err != nil {
			return fmt.Errorf("update order: %w", err)
		}
		for _, sub := range o.Subs {
			var deadline any
			if !sub.AcceptDeadline.IsZero() && sub.AcceptDeadline.Unix() != 0 {
				deadline = sub.AcceptDeadline
			}
			if _, err := tx.Exec(ctx, `UPDATE sub_orders SET status = $2, pickup_code = $3, reject_reason = $4, accept_deadline = $5,
				updated_at = $6, version = version + 1 WHERE id = $1`, sub.ID, sub.Status, sub.PickupCode, sub.RejectReason, deadline, now); err != nil {
				return fmt.Errorf("update sub-order: %w", err)
			}
		}
		if err := insertTasks(ctx, tx, ch.Tasks, now); err != nil {
			return err
		}
		for _, e := range ch.Events {
			if err := insertOutbox(ctx, tx, e); err != nil {
				return err
			}
		}
		applied = true
		out = o
		return nil
	})
	return out, applied, err
}

// OrderBySub devuelve el id del pedido de un sub-pedido visible para `who`.
func (s *Store) OrderBySub(ctx context.Context, who Who, subID string) (string, error) {
	var id string
	err := s.in(ctx, who, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `SELECT order_id FROM sub_orders WHERE id = $1`, subID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	})
	return id, err
}

// GetOrder lee un pedido visible para `who`.
func (s *Store) GetOrder(ctx context.Context, who Who, id string) (domain.Order, error) {
	var o domain.Order
	err := s.in(ctx, who, func(tx pgx.Tx) error {
		var err error
		o, err = loadOrder(ctx, tx, id, false)
		return err
	})
	return o, err
}

// ListMyOrders pagina los pedidos del comprador (más recientes primero).
func (s *Store) ListMyOrders(ctx context.Context, userID string, status domain.OrderStatus, offset, limit int) ([]domain.Order, bool, error) {
	var out []domain.Order
	err := s.in(ctx, Who{UserID: userID}, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id FROM orders WHERE ($1 = 0 OR status = $1) ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
			int16(status), limit+1, offset)
		if err != nil {
			return fmt.Errorf("list orders: %w", err)
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		rows.Close()
		for _, id := range ids {
			o, err := loadOrder(ctx, tx, id, false)
			if err != nil {
				return err
			}
			out = append(out, o)
		}
		return rows.Err()
	})
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, err
}

// ListMerchantSubs pagina los sub-pedidos del comercio.
func (s *Store) ListMerchantSubs(ctx context.Context, tenantID string, status domain.SubStatus, from, to time.Time, offset, limit int) ([]domain.SubOrder, bool, error) {
	var out []domain.SubOrder
	err := s.in(ctx, Who{TenantID: tenantID}, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+subCols+` FROM sub_orders WHERE tenant_id::text = $1 AND ($2 = 0 OR status = $2)
			AND status <> 1 AND created_at >= $3 AND created_at < $4 ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6`,
			tenantID, int16(status), from, to, limit+1, offset)
		if err != nil {
			return fmt.Errorf("list sub-orders: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			sub, err := scanSub(rows)
			if err != nil {
				return err
			}
			out = append(out, sub)
		}
		return rows.Err()
	})
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, err
}

// ── Jobs ───────────────────────────────────────────────────────────────────────────────────

// DueAcceptance: sub-pedidos esperando aceptación con el plazo vencido (R4).
func (s *Store) DueAcceptance(ctx context.Context, now time.Time, limit int) ([]string, error) {
	var out []string
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT order_id FROM sub_orders WHERE status = 2 AND accept_deadline <= $1
			ORDER BY accept_deadline LIMIT $2`, now, limit)
		if err != nil {
			return fmt.Errorf("due acceptance: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return err
			}
			out = append(out, id)
		}
		return rows.Err()
	})
	return out, err
}

// Stale es un pedido sin pagar viejo: sin cobro (la saga se cortó) o con un cobro que ya debió
// resolverse.
type Stale struct {
	OrderID  string
	UserID   string
	IntentID string
}

// StalePending lista pedidos PENDING_PAYMENT creados antes de `before`.
func (s *Store) StalePending(ctx context.Context, before time.Time, limit int) ([]Stale, error) {
	var out []Stale
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, user_id, coalesce(payment_intent_id::text, '') FROM orders
			WHERE status = 1 AND created_at < $1 ORDER BY created_at LIMIT $2`, before, limit)
		if err != nil {
			return fmt.Errorf("stale pending: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var st Stale
			if err := rows.Scan(&st.OrderID, &st.UserID, &st.IntentID); err != nil {
				return err
			}
			out = append(out, st)
		}
		return rows.Err()
	})
	return out, err
}

// TaskLease es lo que dura el turno de un worker sobre una tarea.
const TaskLease = time.Minute

// ClaimTasks toma tareas vencidas con SKIP LOCKED y las arrienda.
func (s *Store) ClaimTasks(ctx context.Context, now time.Time, limit int) ([]Task, error) {
	var out []Task
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `UPDATE saga_tasks SET attempts = attempts + 1, next_attempt_at = $1::timestamptz + interval '1 minute'
			WHERE id IN (SELECT id FROM saga_tasks WHERE status = 'PENDING' AND next_attempt_at <= $1
			             ORDER BY next_attempt_at LIMIT $2 FOR UPDATE SKIP LOCKED)
			RETURNING id, order_id, coalesce(sub_order_id::text, ''), tenant_id, user_id, kind, idempotency_key, attempts`, now, limit)
		if err != nil {
			return fmt.Errorf("claim tasks: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var t Task
			if err := rows.Scan(&t.ID, &t.OrderID, &t.SubOrderID, &t.TenantID, &t.UserID, &t.Kind, &t.IdempotencyKey, &t.Attempts); err != nil {
				return err
			}
			out = append(out, t)
		}
		return rows.Err()
	})
	return out, err
}

// FinishTask cierra la tarea (DONE o FAILED definitivo).
func (s *Store) FinishTask(ctx context.Context, id string, failed bool, cause string, now time.Time) error {
	return s.in(ctx, system, func(tx pgx.Tx) error {
		st := "DONE"
		if failed {
			st = "FAILED"
		}
		if _, err := tx.Exec(ctx, `UPDATE saga_tasks SET status = $2, last_error = $3, done_at = $4 WHERE id = $1`, id, st, cause, now); err != nil {
			return fmt.Errorf("finish task: %w", err)
		}
		return nil
	})
}

// RetryTask reprograma con backoff.
func (s *Store) RetryTask(ctx context.Context, id, cause string, next time.Time) error {
	return s.in(ctx, system, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE saga_tasks SET next_attempt_at = $2, last_error = $3 WHERE id = $1`, id, next, cause); err != nil {
			return fmt.Errorf("retry task: %w", err)
		}
		return nil
	})
}

// TaskBacklog: pendientes y antigüedad del más viejo (alerta: compensaciones atascadas).
func (s *Store) TaskBacklog(ctx context.Context, now time.Time) (int64, float64, error) {
	var n int64
	var oldest *time.Time
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*), min(created_at) FROM saga_tasks WHERE status = 'PENDING'`).Scan(&n, &oldest)
	})
	age := 0.0
	if oldest != nil {
		age = now.Sub(*oldest).Seconds()
	}
	return n, age, err
}

// ── Outbox ─────────────────────────────────────────────────────────────────────────────────

// OutboxPending lee eventos sin publicar en orden.
func (s *Store) OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	var out []OutboxEvent
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, tenant_id, aggregate_id, subject, payload, created_at FROM outbox
			WHERE published_at IS NULL ORDER BY created_at, id LIMIT $1`, limit)
		if err != nil {
			return fmt.Errorf("outbox pending: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var e OutboxEvent
			if err := rows.Scan(&e.ID, &e.TenantID, &e.AggregateID, &e.Subject, &e.Payload, &e.CreatedAt); err != nil {
				return fmt.Errorf("scan outbox: %w", err)
			}
			out = append(out, e)
		}
		return rows.Err()
	})
	return out, err
}

// OutboxMarkPublished marca publicado tras el ack.
func (s *Store) OutboxMarkPublished(ctx context.Context, id string, at time.Time) error {
	return s.in(ctx, system, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = $2 WHERE id = $1`, id, at); err != nil {
			return fmt.Errorf("mark outbox published: %w", err)
		}
		return nil
	})
}

// OutboxBacklog cuenta lo pendiente.
func (s *Store) OutboxBacklog(ctx context.Context) (int64, error) {
	var n int64
	err := s.in(ctx, system, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL`).Scan(&n)
	})
	return n, err
}
