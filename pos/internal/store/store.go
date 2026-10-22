// Package store implementa la persistencia de pos sobre postgres-db con pgx v5.
//
// Atomicidad (docs/architecture/event-chains.md §1.1): cuando una venta pasa a PAID, en la MISMA
// transacción se asigna el número de recibo, se suma el efectivo al esperado de la sesión, se
// crean las tareas de descuento de existencias y se escribe `SalePaid` en el outbox. O pasa todo o
// no pasa nada.
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

	"plentypay/pos/internal/domain"
)

// Store es el repositorio de pos.
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

// Pool expone el pool (idempotencia y pruebas).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// OutboxEvent es un evento a publicar junto con el cambio.
type OutboxEvent struct {
	ID          string
	TenantID    string
	AggregateID string
	Subject     string
	Payload     []byte
	CreatedAt   time.Time
}

// StockTask es un descuento (SALE) o reposición (RETURN) pendiente de entregar a inventory.
type StockTask struct {
	ID             string
	TenantID       string
	SaleID         string
	LineID         string
	ProductID      string
	QtyMilli       int64
	MovementType   int16
	IdempotencyKey string
	Attempts       int
	CashierID      string
}

func (s *Store) inTenant(ctx context.Context, tenantID string, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set tenant: %w", err)
		}
		return fn(tx)
	})
}

func (s *Store) asSystem(ctx context.Context, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
			return fmt.Errorf("set system role: %w", err)
		}
		return fn(tx)
	})
}

func insertOutbox(ctx context.Context, tx pgx.Tx, e OutboxEvent) error {
	if _, err := tx.Exec(ctx, `INSERT INTO outbox (id, tenant_id, aggregate_id, subject, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, e.ID, e.TenantID, e.AggregateID, e.Subject, e.Payload, e.CreatedAt); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

func isUnique(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && (constraint == "" || pgErr.ConstraintName == constraint)
}

// ── Sesiones de caja ───────────────────────────────────────────────────────────────────────

const sessionCols = `id, tenant_id, terminal_label, cashier_id, status, opening_float, expected_cash,
	coalesce(counted_cash, 0), coalesce(difference_minor, 0), close_notes, currency, opened_at,
	coalesce(closed_at, 'epoch'::timestamptz)`

func scanSession(row pgx.Row) (domain.Session, error) {
	var ss domain.Session
	err := row.Scan(&ss.ID, &ss.TenantID, &ss.TerminalLabel, &ss.CashierID, &ss.Status, &ss.OpeningFloat,
		&ss.ExpectedCash, &ss.CountedCash, &ss.DifferenceMinor, &ss.CloseNotes, &ss.Currency, &ss.OpenedAt, &ss.ClosedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ss, domain.ErrNotFound
	}
	if err != nil {
		return ss, fmt.Errorf("scan session: %w", err)
	}
	ss.Currency = strings.TrimSpace(ss.Currency)
	return ss, nil
}

// OpenSession abre la sesión (R1: la caja no puede tener otra abierta).
func (s *Store) OpenSession(ctx context.Context, ss domain.Session) error {
	err := s.inTenant(ctx, ss.TenantID, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO cash_sessions (id, tenant_id, terminal_label, cashier_id, status,
			opening_float, expected_cash, currency, opened_at) VALUES ($1,$2,$3,$4,'OPEN',$5,$5,$6,$7)`,
			ss.ID, ss.TenantID, ss.TerminalLabel, ss.CashierID, ss.OpeningFloat, ss.Currency, ss.OpenedAt)
		return err
	})
	if isUnique(err, "one_open_session_per_terminal") {
		return domain.ErrSessionOpen
	}
	if err != nil {
		return fmt.Errorf("open session: %w", err)
	}
	return nil
}

// GetSession lee una sesión.
func (s *Store) GetSession(ctx context.Context, tenantID, id string) (domain.Session, error) {
	var ss domain.Session
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		ss, err = scanSession(tx.QueryRow(ctx, `SELECT `+sessionCols+` FROM cash_sessions WHERE id = $1`, id))
		return err
	})
	return ss, err
}

// CurrentSession es la sesión abierta del cajero (la más reciente).
func (s *Store) CurrentSession(ctx context.Context, tenantID, cashierID string) (domain.Session, error) {
	var ss domain.Session
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		ss, err = scanSession(tx.QueryRow(ctx, `SELECT `+sessionCols+` FROM cash_sessions
			WHERE cashier_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1`, cashierID))
		return err
	})
	return ss, err
}

// CloseSession cierra con el conteo. SALES_PENDING si hay ventas esperando un cobro electrónico.
func (s *Store) CloseSession(ctx context.Context, tenantID, id, closedBy string, counted int64, notes string, at time.Time) (domain.Session, error) {
	var ss domain.Session
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		ss, err = scanSession(tx.QueryRow(ctx, `SELECT `+sessionCols+` FROM cash_sessions WHERE id = $1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		var pending int
		// S-POS-10 e4: ventas por confirmar o estacionadas impiden cerrar (F17.4).
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM sales WHERE session_id = $1 AND status IN ($2, $3)`,
			id, domain.AwaitingPayment, domain.Parked).Scan(&pending); err != nil {
			return fmt.Errorf("count pending sales: %w", err)
		}
		if pending > 0 {
			return domain.ErrSalesPending
		}
		if err := ss.Close(counted, notes, at); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE cash_sessions SET status = 'CLOSED', counted_cash = $2, difference_minor = $3,
			close_notes = $4, closed_at = $5, closed_by = $6 WHERE id = $1`,
			id, ss.CountedCash, ss.DifferenceMinor, ss.CloseNotes, at, closedBy); err != nil {
			return fmt.Errorf("close session: %w", err)
		}
		return nil
	})
	return ss, err
}

// AddCashMovement registra una entrada/salida y ajusta el esperado (R6).
func (s *Store) AddCashMovement(ctx context.Context, tenantID string, m domain.CashMovement) (domain.Session, error) {
	var ss domain.Session
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		ss, err = scanSession(tx.QueryRow(ctx, `SELECT `+sessionCols+` FROM cash_sessions WHERE id = $1 FOR UPDATE`, m.SessionID))
		if err != nil {
			return err
		}
		if ss.Status != "OPEN" {
			return domain.ErrSessionClosed
		}
		if _, err := tx.Exec(ctx, `INSERT INTO cash_movements (id, tenant_id, session_id, direction, amount_minor,
			reason, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			m.ID, tenantID, m.SessionID, m.Direction, m.AmountMinor, strings.TrimSpace(m.Reason), m.CreatedBy, m.CreatedAt); err != nil {
			return fmt.Errorf("insert cash movement: %w", err)
		}
		ss.ExpectedCash += m.Signed()
		if _, err := tx.Exec(ctx, `UPDATE cash_sessions SET expected_cash = $2 WHERE id = $1`, ss.ID, ss.ExpectedCash); err != nil {
			return fmt.Errorf("update expected cash: %w", err)
		}
		return nil
	})
	return ss, err
}

// ── Ventas ─────────────────────────────────────────────────────────────────────────────────

const saleCols = `id, tenant_id, session_id, cashier_id, status, lines, tenders, subtotal_minor, tax_minor,
	total_minor, change_minor, currency, coalesce(receipt_number, 0), client_sale_id, needs_review, created_at,
	updated_at, coalesce(paid_at, 'epoch'::timestamptz), version, park_label, coalesce(parked_at, 'epoch'::timestamptz)`

func scanSale(row pgx.Row) (domain.Sale, error) {
	var sl domain.Sale
	var lines, tenders []byte
	err := row.Scan(&sl.ID, &sl.TenantID, &sl.SessionID, &sl.CashierID, &sl.Status, &lines, &tenders,
		&sl.SubtotalMinor, &sl.TaxMinor, &sl.TotalMinor, &sl.ChangeMinor, &sl.Currency, &sl.ReceiptNumber,
		&sl.ClientSaleID, &sl.NeedsReview, &sl.CreatedAt, &sl.UpdatedAt, &sl.PaidAt, &sl.Version, &sl.ParkLabel, &sl.ParkedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return sl, domain.ErrNotFound
	}
	if err != nil {
		return sl, fmt.Errorf("scan sale: %w", err)
	}
	sl.Currency = strings.TrimSpace(sl.Currency)
	if err := json.Unmarshal(lines, &sl.Lines); err != nil {
		return sl, fmt.Errorf("decode lines: %w", err)
	}
	if err := json.Unmarshal(tenders, &sl.Tenders); err != nil {
		return sl, fmt.Errorf("decode tenders: %w", err)
	}
	return sl, nil
}

// CreateSale abre una venta dentro de una sesión abierta del cajero (R1). Un `client_sale_id`
// repetido devuelve la venta existente (reintento del dispositivo).
func (s *Store) CreateSale(ctx context.Context, sl domain.Sale) (domain.Sale, error) {
	var out domain.Sale
	err := s.inTenant(ctx, sl.TenantID, func(tx pgx.Tx) error {
		if sl.ClientSaleID != "" {
			prev, err := scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE client_sale_id = $1`, sl.ClientSaleID))
			if err == nil {
				out = prev
				return nil
			}
			if !errors.Is(err, domain.ErrNotFound) {
				return err
			}
		}
		ss, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionCols+` FROM cash_sessions WHERE id = $1`, sl.SessionID))
		if err != nil {
			return err
		}
		if ss.Status != "OPEN" {
			return domain.ErrSessionClosed
		}
		if ss.CashierID != sl.CashierID {
			return domain.ErrNotYourSession
		}
		sl.Currency = ss.Currency
		out, err = scanSale(tx.QueryRow(ctx, `INSERT INTO sales (id, tenant_id, session_id, cashier_id, status, currency,
			client_sale_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING `+saleCols,
			sl.ID, sl.TenantID, sl.SessionID, sl.CashierID, domain.Open, sl.Currency, sl.ClientSaleID, sl.CreatedAt))
		return err
	})
	return out, err
}

// GetSale lee una venta.
func (s *Store) GetSale(ctx context.Context, tenantID, id string) (domain.Sale, error) {
	var sl domain.Sale
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		sl, err = scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1`, id))
		return err
	})
	return sl, err
}

// OnPaid arma los efectos de una venta recién pagada: eventos y tareas de stock.
type OnPaid func(domain.Sale) ([]OutboxEvent, []StockTask, error)

// MutateSale bloquea la venta, aplica `mutate` y guarda. Si la venta pasa a PAID aplica en la misma
// transacción recibo, efectivo esperado, tareas de stock y eventos. `expectedVersion` > 0 activa
// el bloqueo optimista.
func (s *Store) MutateSale(ctx context.Context, tenantID, id string, expectedVersion int32,
	mutate func(*domain.Sale) error, onPaid OnPaid, now time.Time) (domain.Sale, error) {
	var out domain.Sale
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		sl, err := scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		if expectedVersion > 0 && sl.Version != expectedVersion {
			return domain.ErrVersionConflict
		}
		out, err = saveSale(ctx, tx, sl, mutate, onPaid, now)
		return err
	})
	return out, err
}

// MutateSaleInOpenSession es MutateSale para transiciones que solo valen con la caja abierta
// (estacionar y retomar, F17.4). Bloquea la venta y luego su sesión FOR SHARE: el cierre toma la
// sesión FOR UPDATE y cuenta las estacionadas, así que una venta no queda estacionada en una caja
// cerrada. Si `mutate` responde ErrNoChange (reintento) devuelve la venta sin escribir.
func (s *Store) MutateSaleInOpenSession(ctx context.Context, tenantID, id string, mutate func(*domain.Sale) error,
	now time.Time) (domain.Sale, error) {
	var out domain.Sale
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		sl, err := scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		var status string
		if err := tx.QueryRow(ctx, `SELECT status FROM cash_sessions WHERE id = $1 FOR SHARE`, sl.SessionID).
			Scan(&status); err != nil {
			return fmt.Errorf("lock session of sale: %w", err)
		}
		if status != "OPEN" {
			return domain.ErrSessionClosed
		}
		probe := sl
		switch err := mutate(&probe); {
		case errors.Is(err, domain.ErrNoChange):
			out = sl
			return nil
		case err != nil:
			return err
		}
		out, err = saveSale(ctx, tx, sl, mutate, func(domain.Sale) ([]OutboxEvent, []StockTask, error) {
			return nil, nil, nil
		}, now)
		return err
	})
	return out, err
}

func saveSale(ctx context.Context, tx pgx.Tx, sl domain.Sale, mutate func(*domain.Sale) error, onPaid OnPaid, now time.Time) (domain.Sale, error) {
	wasPaid := sl.Status == domain.Paid
	if err := mutate(&sl); err != nil {
		return sl, err
	}
	sl.UpdatedAt = now
	sl.Version++
	if !wasPaid && sl.Status == domain.Paid {
		sl.PaidAt = now
		if err := tx.QueryRow(ctx, `INSERT INTO receipt_counters (tenant_id, last) VALUES ($1, 1)
			ON CONFLICT (tenant_id) DO UPDATE SET last = receipt_counters.last + 1 RETURNING last`, sl.TenantID).
			Scan(&sl.ReceiptNumber); err != nil {
			return sl, fmt.Errorf("next receipt number: %w", err)
		}
		if cash := sl.CashInSale(); cash > 0 {
			if _, err := tx.Exec(ctx, `UPDATE cash_sessions SET expected_cash = expected_cash + $2 WHERE id = $1`,
				sl.SessionID, cash); err != nil {
				return sl, fmt.Errorf("add sale cash: %w", err)
			}
		}
		evs, tasks, err := onPaid(sl)
		if err != nil {
			return sl, err
		}
		for _, t := range tasks {
			if _, err := tx.Exec(ctx, `INSERT INTO stock_tasks (id, tenant_id, sale_id, line_id, product_id, qty_milli,
				movement_type, idempotency_key, status, next_attempt_at, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9,$9)`,
				t.ID, sl.TenantID, sl.ID, t.LineID, t.ProductID, t.QtyMilli, t.MovementType, t.IdempotencyKey, now); err != nil {
				return sl, fmt.Errorf("insert stock task: %w", err)
			}
		}
		for _, e := range evs {
			if err := insertOutbox(ctx, tx, e); err != nil {
				return sl, err
			}
		}
	}
	lines, err := json.Marshal(sl.Lines)
	if err != nil {
		return sl, fmt.Errorf("encode lines: %w", err)
	}
	tenders, err := json.Marshal(sl.Tenders)
	if err != nil {
		return sl, fmt.Errorf("encode tenders: %w", err)
	}
	var paidAt any
	if !sl.PaidAt.IsZero() && sl.PaidAt.Unix() != 0 {
		paidAt = sl.PaidAt
	}
	var receipt any
	if sl.ReceiptNumber > 0 {
		receipt = sl.ReceiptNumber
	}
	var parkedAt any
	if !sl.ParkedAt.IsZero() && sl.ParkedAt.Unix() != 0 {
		parkedAt = sl.ParkedAt
	}
	if _, err := tx.Exec(ctx, `UPDATE sales SET status=$2, lines=$3, tenders=$4, subtotal_minor=$5, tax_minor=$6,
		total_minor=$7, change_minor=$8, receipt_number=$9, needs_review=$10, updated_at=$11, paid_at=$12, version=$13,
		park_label=$14, parked_at=$15
		WHERE id = $1`, sl.ID, sl.Status, string(lines), string(tenders), sl.SubtotalMinor, sl.TaxMinor, sl.TotalMinor,
		sl.ChangeMinor, receipt, sl.NeedsReview, sl.UpdatedAt, paidAt, sl.Version, sl.ParkLabel, parkedAt); err != nil {
		return sl, fmt.Errorf("update sale: %w", err)
	}
	return sl, nil
}

// PaymentEvent es un cobro electrónico ya resuelto en payments-core.
type PaymentEvent struct {
	EventID   string
	TenantID  string
	SaleID    string
	IntentID  string
	Amount    int64
	Captured  bool
	Processed time.Time
}

// ApplyPaymentEvent marca el medio de billetera de la venta (consumidor idempotente, ADR 0012):
// el event_id se registra en la MISMA transacción que su efecto; un duplicado no hace nada.
func (s *Store) ApplyPaymentEvent(ctx context.Context, e PaymentEvent, onPaid OnPaid) (applied bool, err error) {
	err = s.inTenant(ctx, e.TenantID, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id, tenant_id, processed_at) VALUES ($1, $2, $3)
			ON CONFLICT (event_id) DO NOTHING`, e.EventID, e.TenantID, e.Processed)
		if err != nil {
			return fmt.Errorf("record processed event: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil // ya procesado
		}
		sl, err := scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1 FOR UPDATE`, e.SaleID))
		if errors.Is(err, domain.ErrNotFound) {
			return nil // la referencia no es una venta de este comercio: nada que hacer
		}
		if err != nil {
			return err
		}
		if sl.Status != domain.AwaitingPayment {
			// Cobro tardío sobre una venta anulada o reabierta: queda para revisión del gerente.
			if sl.Status != domain.Paid {
				_, err := saveSale(ctx, tx, sl, func(x *domain.Sale) error { x.NeedsReview = true; return nil }, onPaid, e.Processed)
				applied = err == nil
				return err
			}
			return nil
		}
		_, err = saveSale(ctx, tx, sl, func(x *domain.Sale) error {
			if e.Captured {
				x.CaptureTender(e.IntentID, e.Amount)
			} else {
				x.FailTender()
			}
			return nil
		}, onPaid, e.Processed)
		applied = err == nil
		return err
	})
	return applied, err
}

// SaleCursor es la posición de keyset del historial (más reciente primero).
type SaleCursor struct {
	At time.Time
	ID string
}

// SaleFilter filtra el historial.
type SaleFilter struct {
	SessionID string
	Status    domain.Status
	From, To  time.Time
	After     *SaleCursor
	Limit     int
}

// ListSales es el historial de ventas del comercio.
func (s *Store) ListSales(ctx context.Context, tenantID string, f SaleFilter) ([]domain.Sale, *SaleCursor, error) {
	var out []domain.Sale
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var afterAt any
		afterID := ""
		if f.After != nil {
			afterAt, afterID = f.After.At, f.After.ID
		}
		rows, err := tx.Query(ctx, `SELECT `+saleCols+` FROM sales
			WHERE ($1 = '' OR session_id::text = $1) AND ($2 = 0 OR status = $2)
			  AND created_at >= $3 AND created_at < $4
			  AND ($5::timestamptz IS NULL OR (created_at, id::text) < ($5::timestamptz, $6))
			ORDER BY created_at DESC, id DESC LIMIT $7`,
			f.SessionID, int16(f.Status), f.From, f.To, afterAt, afterID, f.Limit+1)
		if err != nil {
			return fmt.Errorf("list sales: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			sl, err := scanSale(rows)
			if err != nil {
				return err
			}
			out = append(out, sl)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, err
	}
	if len(out) > f.Limit {
		out = out[:f.Limit]
		last := out[len(out)-1]
		return out, &SaleCursor{At: last.CreatedAt, ID: last.ID}, nil
	}
	return out, nil, nil
}

// ── Tareas de stock (worker) ───────────────────────────────────────────────────────────────

// StockLease es lo que dura el turno de un worker sobre una tarea antes de que otro la retome.
const StockLease = time.Minute

// ClaimStockTasks toma tareas vencidas con SKIP LOCKED y las arrienda (sin dos workers sobre la misma).
func (s *Store) ClaimStockTasks(ctx context.Context, limit int, now time.Time) ([]StockTask, error) {
	var out []StockTask
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT t.id, t.tenant_id, t.sale_id, t.line_id, t.product_id, t.qty_milli,
				t.movement_type, t.idempotency_key, t.attempts, s.cashier_id
			FROM stock_tasks t JOIN sales s ON s.id = t.sale_id
			WHERE t.status = 'PENDING' AND t.next_attempt_at <= $1
			ORDER BY t.next_attempt_at LIMIT $2 FOR UPDATE OF t SKIP LOCKED`, now, limit)
		if err != nil {
			return fmt.Errorf("claim stock tasks: %w", err)
		}
		for rows.Next() {
			var t StockTask
			if err := rows.Scan(&t.ID, &t.TenantID, &t.SaleID, &t.LineID, &t.ProductID, &t.QtyMilli, &t.MovementType,
				&t.IdempotencyKey, &t.Attempts, &t.CashierID); err != nil {
				rows.Close()
				return fmt.Errorf("scan stock task: %w", err)
			}
			out = append(out, t)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for _, t := range out {
			if _, err := tx.Exec(ctx, `UPDATE stock_tasks SET next_attempt_at = $2, attempts = attempts + 1 WHERE id = $1`,
				t.ID, now.Add(StockLease)); err != nil {
				return fmt.Errorf("lease stock task: %w", err)
			}
		}
		return nil
	})
	return out, err
}

// FinishStockTask cierra la tarea: DONE, o FAILED (definitivo) con la venta marcada para revisión.
func (s *Store) FinishStockTask(ctx context.Context, t StockTask, failed bool, cause string, now time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		status := "DONE"
		if failed {
			status = "FAILED"
		}
		if _, err := tx.Exec(ctx, `UPDATE stock_tasks SET status = $2, last_error = $3, done_at = $4 WHERE id = $1`,
			t.ID, status, cause, now); err != nil {
			return fmt.Errorf("finish stock task: %w", err)
		}
		if failed {
			if _, err := tx.Exec(ctx, `UPDATE sales SET needs_review = true WHERE id = $1`, t.SaleID); err != nil {
				return fmt.Errorf("flag sale for review: %w", err)
			}
		}
		return nil
	})
}

// RetryStockTask reprograma la tarea con backoff (inventory caído: movimiento diferido, SPEC §7).
func (s *Store) RetryStockTask(ctx context.Context, t StockTask, cause string, next time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE stock_tasks SET next_attempt_at = $2, last_error = $3 WHERE id = $1`,
			t.ID, next, cause); err != nil {
			return fmt.Errorf("retry stock task: %w", err)
		}
		return nil
	})
}

// StockBacklog cuenta tareas pendientes y la más vieja (alerta: ventas pagadas sin descontar stock).
func (s *Store) StockBacklog(ctx context.Context, now time.Time) (int64, float64, error) {
	var n int64
	var oldest *time.Time
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*), min(created_at) FROM stock_tasks WHERE status = 'PENDING'`).Scan(&n, &oldest)
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
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
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
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = $2 WHERE id = $1`, id, at); err != nil {
			return fmt.Errorf("mark outbox published: %w", err)
		}
		return nil
	})
}

// OutboxBacklog cuenta lo pendiente.
func (s *Store) OutboxBacklog(ctx context.Context) (int64, error) {
	var n int64
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL`).Scan(&n)
	})
	return n, err
}
