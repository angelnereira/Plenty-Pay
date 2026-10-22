package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/pos/internal/domain"
)

// RefundRow es una devolución guardada (F17.9).
type RefundRow struct {
	ID          string
	TenantID    string
	SaleID      string
	SessionID   string
	Reason      string
	Restock     bool
	Lines       []domain.RefundLine
	Tenders     []domain.RefundTender
	TotalMinor  int64
	CashMinor   int64
	WalletMinor int64
	Status      string // PENDING (falta el reintegro electrónico) | DONE | FAILED
	Failure     string
	CreatedBy   string
	CreatedAt   time.Time
}

// RefundInput es lo que pide el cajero.
type RefundInput struct {
	TenantID  string
	SaleID    string
	CashierID string
	Key       string
	Hash      []byte
	Lines     []domain.RefundLineRequest
	Reason    string
	Restock   bool
	Now       time.Time
	NewID     func() string

	// Events arma los eventos de la devolución (SaleRefunded) que se escriben en el outbox dentro
	// de la misma transacción (ADR 0012).
	Events func(RefundRow, domain.Sale) ([]OutboxEvent, error)
}

const refundCols = `id, tenant_id, sale_id, session_id, reason, restock, lines, tenders, total_minor, cash_minor,
	wallet_minor, status, failure, created_by, created_at`

func scanRefund(row pgx.Row) (RefundRow, []byte, error) {
	var r RefundRow
	var lines, tenders, hash []byte
	err := row.Scan(&r.ID, &r.TenantID, &r.SaleID, &r.SessionID, &r.Reason, &r.Restock, &lines, &tenders,
		&r.TotalMinor, &r.CashMinor, &r.WalletMinor, &r.Status, &r.Failure, &r.CreatedBy, &r.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, nil, domain.ErrNotFound
	}
	if err != nil {
		return r, nil, fmt.Errorf("scan refund: %w", err)
	}
	if err := json.Unmarshal(lines, &r.Lines); err != nil {
		return r, nil, fmt.Errorf("decode refund lines: %w", err)
	}
	if err := json.Unmarshal(tenders, &r.Tenders); err != nil {
		return r, nil, fmt.Errorf("decode refund tenders: %w", err)
	}
	return r, hash, nil
}

// RefundByKey devuelve la devolución ya hecha con esa clave (reintento) y su venta.
func (s *Store) RefundByKey(ctx context.Context, tenantID, key string, hash []byte) (*RefundRow, domain.Sale, error) {
	var out *RefundRow
	var sale domain.Sale
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		r, h, err := scanRefund(tx.QueryRow(ctx, `SELECT `+refundCols+`, request_hash FROM refunds WHERE idempotency_key = $1`, key))
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if !bytes.Equal(h, hash) {
			return domain.ErrKeyReused
		}
		out = &r
		sale, err = scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1`, r.SaleID))
		return err
	})
	return out, sale, err
}

// Refund aplica una devolución en UNA transacción (F17.9, R9): bloquea la venta y la caja abierta
// del cajero que devuelve, actualiza las líneas y el estado de la venta, guarda la devolución, saca
// el efectivo de esa caja (salida y esperado), y deja las tareas de reingreso a inventario (RETURN)
// y de reintegro al saldo PlentyPay. Nada queda a medias: o todo o nada.
func (s *Store) Refund(ctx context.Context, in RefundInput) (RefundRow, domain.Sale, error) {
	var out RefundRow
	var sale domain.Sale
	err := s.inTenant(ctx, in.TenantID, func(tx pgx.Tx) error {
		sl, err := scanSale(tx.QueryRow(ctx, `SELECT `+saleCols+` FROM sales WHERE id = $1 FOR UPDATE`, in.SaleID))
		if err != nil {
			return err
		}
		var sessionID, status string
		err = tx.QueryRow(ctx, `SELECT id, status FROM cash_sessions WHERE cashier_id = $1 AND status = 'OPEN' FOR UPDATE`,
			in.CashierID).Scan(&sessionID, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrSessionClosed // se devuelve desde una caja abierta (de ahí sale el efectivo)
		}
		if err != nil {
			return fmt.Errorf("lock refunding session: %w", err)
		}
		var plan domain.Refund
		sale, err = saveSale(ctx, tx, sl, func(s *domain.Sale) error {
			var perr error
			plan, perr = s.PlanRefund(in.Lines, in.Reason, in.Restock)
			return perr
		}, func(domain.Sale) ([]OutboxEvent, []StockTask, error) { return nil, nil, nil }, in.Now)
		if err != nil {
			return err
		}
		out = RefundRow{ID: in.NewID(), TenantID: in.TenantID, SaleID: in.SaleID, SessionID: sessionID,
			Reason: plan.Reason, Restock: plan.Restock, Lines: plan.Lines, Tenders: plan.Tenders,
			TotalMinor: plan.TotalMinor, CashMinor: plan.CashMinor, WalletMinor: plan.WalletMinor,
			Status: "DONE", CreatedBy: in.CashierID, CreatedAt: in.Now}
		if plan.WalletMinor > 0 {
			out.Status = "PENDING"
		}
		lines, err := json.Marshal(out.Lines)
		if err != nil {
			return fmt.Errorf("encode refund lines: %w", err)
		}
		tenders, err := json.Marshal(out.Tenders)
		if err != nil {
			return fmt.Errorf("encode refund tenders: %w", err)
		}
		var doneAt any
		if out.Status == "DONE" {
			doneAt = in.Now
		}
		if _, err := tx.Exec(ctx, `INSERT INTO refunds (id, tenant_id, sale_id, session_id, reason, restock, lines, tenders,
				total_minor, cash_minor, wallet_minor, status, idempotency_key, request_hash, created_by, created_at, done_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
			out.ID, in.TenantID, in.SaleID, sessionID, out.Reason, out.Restock, string(lines), string(tenders),
			out.TotalMinor, out.CashMinor, out.WalletMinor, out.Status, in.Key, in.Hash, in.CashierID, in.Now, doneAt); err != nil {
			if isUnique(err, "refunds_tenant_id_idempotency_key_key") {
				return errConcurrentRefund
			}
			return fmt.Errorf("insert refund: %w", err)
		}
		if out.CashMinor > 0 {
			receipt := ""
			if sl.ReceiptNumber > 0 {
				receipt = fmt.Sprintf(" %08d", sl.ReceiptNumber)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO cash_movements (id, tenant_id, session_id, direction, amount_minor,
					reason, created_by, created_at) VALUES ($1,$2,$3,'OUT',$4,$5,$6,$7)`,
				in.NewID(), in.TenantID, sessionID, out.CashMinor, strings.TrimSpace("Devolución de la venta"+receipt),
				in.CashierID, in.Now); err != nil {
				return fmt.Errorf("insert refund cash out: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE cash_sessions SET expected_cash = expected_cash - $2 WHERE id = $1`,
				sessionID, out.CashMinor); err != nil {
				return fmt.Errorf("refund cash expected: %w", err)
			}
		}
		if out.Restock {
			for _, l := range out.Lines {
				if !l.TracksInventory {
					continue
				}
				if _, err := tx.Exec(ctx, `INSERT INTO stock_tasks (id, tenant_id, sale_id, line_id, product_id, qty_milli,
						movement_type, idempotency_key, status, next_attempt_at, created_at)
					VALUES ($1,$2,$3,$4,$5,$6,6,$7,'PENDING',$8,$8)`,
					in.NewID(), in.TenantID, in.SaleID, l.LineID, l.ProductID, l.QtyMilli,
					"refund:"+out.ID+":"+l.LineID, in.Now); err != nil {
					return fmt.Errorf("insert return stock task: %w", err)
				}
			}
		}
		for _, t := range out.Tenders {
			if t.Rail != domain.RailWallet {
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO refund_tasks (id, tenant_id, refund_id, sale_id, payment_intent_id,
					amount_minor, idempotency_key, status, next_attempt_at, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$8)`,
				in.NewID(), in.TenantID, out.ID, in.SaleID, t.PaymentIntentID, t.AmountMinor,
				"posrefund:"+out.ID+":"+t.TenderID, in.Now); err != nil {
				return fmt.Errorf("insert refund task: %w", err)
			}
		}
		if in.Events != nil {
			evs, err := in.Events(out, sale)
			if err != nil {
				return err
			}
			for _, e := range evs {
				if err := insertOutbox(ctx, tx, e); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if errors.Is(err, errConcurrentRefund) {
		// Otro reintento con la misma clave ganó: se responde lo que guardó.
		r, sl, rerr := s.RefundByKey(ctx, in.TenantID, in.Key, in.Hash)
		if rerr != nil {
			return out, sale, rerr
		}
		if r != nil {
			return *r, sl, nil
		}
	}
	return out, sale, err
}

var errConcurrentRefund = errors.New("refund key inserted concurrently")

// RefundTask es un reintegro pendiente al saldo PlentyPay.
type RefundTask struct {
	ID              string
	TenantID        string
	RefundID        string
	SaleID          string
	PaymentIntentID string
	AmountMinor     int64
	IdempotencyKey  string
	Reason          string
	Attempts        int
	CashierID       string
}

// RefundLease es el turno de un trabajador sobre una tarea antes de que otro la retome.
const RefundLease = time.Minute

// ClaimRefundTasks toma tareas vencidas con SKIP LOCKED y las arrienda.
func (s *Store) ClaimRefundTasks(ctx context.Context, limit int, now time.Time) ([]RefundTask, error) {
	var out []RefundTask
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT t.id, t.tenant_id, t.refund_id, t.sale_id, t.payment_intent_id, t.amount_minor,
				t.idempotency_key, r.reason, t.attempts, r.created_by
			FROM refund_tasks t JOIN refunds r ON r.id = t.refund_id
			WHERE t.status = 'PENDING' AND t.next_attempt_at <= $1
			ORDER BY t.next_attempt_at LIMIT $2 FOR UPDATE OF t SKIP LOCKED`, now, limit)
		if err != nil {
			return fmt.Errorf("claim refund tasks: %w", err)
		}
		for rows.Next() {
			var t RefundTask
			if err := rows.Scan(&t.ID, &t.TenantID, &t.RefundID, &t.SaleID, &t.PaymentIntentID, &t.AmountMinor,
				&t.IdempotencyKey, &t.Reason, &t.Attempts, &t.CashierID); err != nil {
				rows.Close()
				return fmt.Errorf("scan refund task: %w", err)
			}
			out = append(out, t)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for _, t := range out {
			if _, err := tx.Exec(ctx, `UPDATE refund_tasks SET next_attempt_at = $2, attempts = attempts + 1 WHERE id = $1`,
				t.ID, now.Add(RefundLease)); err != nil {
				return fmt.Errorf("lease refund task: %w", err)
			}
		}
		return nil
	})
	return out, err
}

// FinishRefundTask cierra una tarea (DONE o FAILED con el motivo) y, si ya no quedan pendientes,
// la devolución: DONE si todas salieron, FAILED con el primer motivo si alguna falló.
func (s *Store) FinishRefundTask(ctx context.Context, t RefundTask, failed bool, cause string, now time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		st := "DONE"
		if failed {
			st = "FAILED"
		}
		if _, err := tx.Exec(ctx, `UPDATE refund_tasks SET status = $2, last_error = $3, done_at = $4 WHERE id = $1`,
			t.ID, st, cause, now); err != nil {
			return fmt.Errorf("finish refund task: %w", err)
		}
		var pending, failedN int
		var firstErr string
		if err := tx.QueryRow(ctx, `SELECT count(*) FILTER (WHERE status = 'PENDING'), count(*) FILTER (WHERE status = 'FAILED'),
				coalesce(min(last_error) FILTER (WHERE status = 'FAILED'), '')
			FROM refund_tasks WHERE refund_id = $1`, t.RefundID).Scan(&pending, &failedN, &firstErr); err != nil {
			return fmt.Errorf("refund tasks summary: %w", err)
		}
		if pending > 0 {
			return nil
		}
		final, failure := "DONE", ""
		if failedN > 0 {
			final, failure = "FAILED", firstErr
			if _, err := tx.Exec(ctx, `UPDATE sales SET needs_review = true WHERE id = $1`, t.SaleID); err != nil {
				return fmt.Errorf("mark sale for review: %w", err)
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE refunds SET status = $2, failure = $3, done_at = $4 WHERE id = $1`,
			t.RefundID, final, failure, now); err != nil {
			return fmt.Errorf("close refund: %w", err)
		}
		return nil
	})
}

// RetryRefundTask reprograma una tarea tras un fallo pasajero.
func (s *Store) RetryRefundTask(ctx context.Context, t RefundTask, cause string, next time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE refund_tasks SET next_attempt_at = $2, last_error = $3 WHERE id = $1`,
			t.ID, next, cause); err != nil {
			return fmt.Errorf("retry refund task: %w", err)
		}
		return nil
	})
}

// RefundsOfSale lista las devoluciones de una venta, de la más antigua a la más reciente.
func (s *Store) RefundsOfSale(ctx context.Context, tenantID, saleID string) ([]RefundRow, error) {
	var out []RefundRow
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+refundCols+`, request_hash FROM refunds WHERE sale_id = $1 ORDER BY created_at`, saleID)
		if err != nil {
			return fmt.Errorf("list refunds: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			r, _, err := scanRefund(rows)
			if err != nil {
				return err
			}
			out = append(out, r)
		}
		return rows.Err()
	})
	return out, err
}
