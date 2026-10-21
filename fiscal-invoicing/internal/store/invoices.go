package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/fiscal-invoicing/internal/domain"
)

// lineJSON es la forma de una línea en invoices.lines (SPEC §3).
type lineJSON struct {
	Description     string `json:"description"`
	CPBSCode        string `json:"cpbs_code,omitempty"`
	UnitMeasureCode string `json:"unit_measure_code,omitempty"`
	QuantityMilli   int64  `json:"qty_milli"`
	UnitPriceMinor  int64  `json:"unit_price_minor"`
	DiscountMinor   int64  `json:"discount_minor"`
	TaxRateBps      int64  `json:"tax_rate_bps"`
	BaseMinor       int64  `json:"base_minor"`
	TaxMinor        int64  `json:"tax_minor"`
	TotalMinor      int64  `json:"total_minor"`
}

type customerJSON struct {
	TaxIDType  string `json:"tax_id_type"`
	TaxID      string `json:"tax_id"`
	CheckDigit string `json:"check_digit,omitempty"`
	LegalName  string `json:"legal_name"`
	Email      string `json:"email,omitempty"`
}

func linesToJSON(ls []domain.Line) ([]byte, error) {
	out := make([]lineJSON, len(ls))
	for i, l := range ls {
		out[i] = lineJSON(l)
	}
	return json.Marshal(out)
}

func linesFromJSON(b []byte) ([]domain.Line, error) {
	var in []lineJSON
	if err := json.Unmarshal(b, &in); err != nil {
		return nil, err
	}
	out := make([]domain.Line, len(in))
	for i, l := range in {
		out[i] = domain.Line(l)
	}
	return out, nil
}

const invoiceCols = `i.id, i.tenant_id, i.doc_type, i.status, i.environment, i.point_of_sale_code, coalesce(i.number, 0),
	coalesce(i.cufe, ''), coalesce(i.qr_url, ''), coalesce(i.related_invoice_id::text, ''), i.source_type, i.source_id,
	i.customer_snapshot, i.lines, i.subtotal_minor, i.tax_minor, i.total_minor, i.currency, i.payment_methods,
	i.document_date, i.legal_param_version, coalesce(i.reason, ''), i.pac_attempts, i.next_attempt_at,
	coalesce(i.last_error, ''), coalesce(i.rejection_reason, ''), i.idempotency_key, i.request_hash, i.issued_at,
	i.created_at, i.updated_at`

func scanInvoice(row pgx.Row, extra ...any) (domain.Invoice, error) {
	var (
		inv                       domain.Invoice
		customer, lines, payments []byte
	)
	dest := []any{&inv.ID, &inv.TenantID, &inv.DocType, &inv.Status, &inv.Environment, &inv.PointOfSaleCode, &inv.Number,
		&inv.CUFE, &inv.QR, &inv.RelatedInvoiceID, &inv.SourceType, &inv.SourceID, &customer, &lines,
		&inv.Totals.SubtotalMinor, &inv.Totals.TaxMinor, &inv.Totals.TotalMinor, &inv.Currency, &payments,
		&inv.DocumentDate, &inv.LegalParamVersion, &inv.Reason, &inv.PacAttempts, &inv.NextAttemptAt, &inv.LastError,
		&inv.RejectionReason, &inv.IdempotencyKey, &inv.RequestHash, &inv.IssuedAt, &inv.CreatedAt, &inv.UpdatedAt}
	err := row.Scan(append(dest, extra...)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return inv, domain.ErrNotFound
	}
	if err != nil {
		return inv, fmt.Errorf("scan invoice: %w", err)
	}
	if inv.Lines, err = linesFromJSON(lines); err != nil {
		return inv, fmt.Errorf("decode lines: %w", err)
	}
	if err := json.Unmarshal(payments, &inv.PaymentMethods); err != nil {
		return inv, fmt.Errorf("decode payment methods: %w", err)
	}
	if len(customer) > 0 && string(customer) != "null" {
		var c customerJSON
		if err := json.Unmarshal(customer, &c); err != nil {
			return inv, fmt.Errorf("decode customer: %w", err)
		}
		inv.Customer = &domain.Taxpayer{TaxIDType: c.TaxIDType, TaxID: c.TaxID, CheckDigit: c.CheckDigit, LegalName: c.LegalName, Email: c.Email}
	}
	return inv, nil
}

// CreateInvoice guarda el documento ya calculado, con su número (R2), en estado QUEUED. Idempotente:
// la misma clave con el mismo contenido devuelve el documento original; con otro contenido,
// ErrIdempotencyReused. Un segundo documento del mismo tipo para el mismo origen devuelve el
// existente (R6). created=false indica que no se creó nada nuevo.
func (s *Store) CreateInvoice(ctx context.Context, inv domain.Invoice) (domain.Invoice, bool, error) {
	var (
		out     domain.Invoice
		created bool
	)
	err := s.inTenant(ctx, inv.TenantID, func(tx pgx.Tx) error {
		prev, err := scanInvoice(tx.QueryRow(ctx, `SELECT `+invoiceCols+` FROM invoices i
			WHERE i.tenant_id = $1 AND i.idempotency_key = $2`, inv.TenantID, inv.IdempotencyKey))
		switch {
		case err == nil:
			if !bytes.Equal(prev.RequestHash, inv.RequestHash) {
				return domain.ErrIdempotencyReused
			}
			out = prev
			return nil
		case !errors.Is(err, domain.ErrNotFound):
			return err
		}
		prev, err = scanInvoice(tx.QueryRow(ctx, `SELECT `+invoiceCols+` FROM invoices i
			WHERE i.tenant_id = $1 AND i.source_type = $2 AND i.source_id = $3 AND i.doc_type = $4`,
			inv.TenantID, inv.SourceType, inv.SourceID, inv.DocType))
		switch {
		case err == nil:
			out = prev
			return nil
		case !errors.Is(err, domain.ErrNotFound):
			return err
		}
		if inv.RelatedInvoiceID != "" {
			if err := checkRelated(ctx, tx, inv); err != nil {
				return err
			}
		}
		if inv.Number, err = AllocateNumber(ctx, tx, inv.TenantID, inv.DocType, inv.PointOfSaleCode); err != nil {
			return err
		}
		lines, err := linesToJSON(inv.Lines)
		if err != nil {
			return fmt.Errorf("encode lines: %w", err)
		}
		payments, err := json.Marshal(inv.PaymentMethods)
		if err != nil {
			return fmt.Errorf("encode payment methods: %w", err)
		}
		// Las columnas jsonb viajan como texto: con el protocolo simple un []byte llega como bytea.
		var customer any
		if inv.Customer != nil {
			c := inv.Customer
			b, err := json.Marshal(customerJSON{c.TaxIDType, c.TaxID, c.CheckDigit, c.LegalName, c.Email})
			if err != nil {
				return fmt.Errorf("encode customer: %w", err)
			}
			customer = string(b)
		}
		out, err = scanInvoice(tx.QueryRow(ctx, `
			INSERT INTO invoices AS i (id, tenant_id, doc_type, status, environment, point_of_sale_code, number,
				related_invoice_id, source_type, source_id, customer_snapshot, lines, subtotal_minor, tax_minor, total_minor,
				currency, payment_methods, document_date, legal_param_version, reason, next_attempt_at,
				idempotency_key, request_hash, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::uuid, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17::jsonb, $18,
				$19, NULLIF($20, ''), $21, $22, $23, $21, $21)
			RETURNING `+invoiceCols,
			inv.ID, inv.TenantID, inv.DocType, domain.StatusQueued, inv.Environment, inv.PointOfSaleCode, inv.Number,
			inv.RelatedInvoiceID, inv.SourceType, inv.SourceID, customer, string(lines), inv.Totals.SubtotalMinor, inv.Totals.TaxMinor,
			inv.Totals.TotalMinor, inv.Currency, string(payments), inv.DocumentDate, inv.LegalParamVersion, inv.Reason,
			inv.CreatedAt, inv.IdempotencyKey, inv.RequestHash))
		created = err == nil
		return err
	})
	return out, created, err
}

// checkRelated bloquea la factura de referencia y aplica N-FIS-08/R7: debe estar aceptada y la suma de
// notas de crédito no rechazadas, más la nueva, no puede superar su total. El bloqueo hace que dos notas
// simultáneas se evalúen una detrás de otra.
func checkRelated(ctx context.Context, tx pgx.Tx, note domain.Invoice) error {
	var status int
	var total int64
	err := tx.QueryRow(ctx, `SELECT status, total_minor FROM invoices WHERE id::text = $1 AND tenant_id = $2
		AND doc_type = $3 FOR UPDATE`, note.RelatedInvoiceID, note.TenantID, domain.DocFiscalInvoice).Scan(&status, &total)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock related invoice: %w", err)
	}
	if status != domain.StatusAccepted {
		return domain.ErrRelatedNotAccepted
	}
	if note.DocType != domain.DocCreditNote {
		return nil
	}
	var credited int64
	if err := tx.QueryRow(ctx, `SELECT coalesce(sum(total_minor), 0) FROM invoices WHERE related_invoice_id::text = $1
		AND doc_type = $2 AND status <> $3`, note.RelatedInvoiceID, domain.DocCreditNote, domain.StatusRejected).Scan(&credited); err != nil {
		return fmt.Errorf("sum credit notes: %w", err)
	}
	if credited+note.Totals.TotalMinor > total {
		return domain.ErrExceedsOriginal
	}
	return nil
}

// GetInvoice devuelve un documento del tenant (de otro tenant = no existe).
func (s *Store) GetInvoice(ctx context.Context, tenantID, id string) (domain.Invoice, error) {
	var out domain.Invoice
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		out, err = scanInvoice(tx.QueryRow(ctx, `SELECT `+invoiceCols+` FROM invoices i
			WHERE i.id::text = $1 AND i.tenant_id = $2`, id, tenantID))
		return err
	})
	return out, err
}

// ListFilter acota ListInvoices.
type ListFilter struct {
	Status  int
	DocType int
	Limit   int
	Cursor  string
}

// ListInvoices pagina los documentos del tenant, del más reciente al más antiguo.
func (s *Store) ListInvoices(ctx context.Context, tenantID string, f ListFilter) ([]domain.Invoice, string, error) {
	afterAt, afterID, err := decodeCursor(f.Cursor)
	if err != nil {
		return nil, "", domain.ErrInvalidRequest
	}
	var out []domain.Invoice
	err = s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+invoiceCols+` FROM invoices i
			WHERE i.tenant_id = $1 AND ($2 = 0 OR i.status = $2) AND ($3 = 0 OR i.doc_type = $3)
			  AND ($4 = '' OR (i.created_at, i.id::text) < (NULLIF($4, '')::timestamptz, $5))
			ORDER BY i.created_at DESC, i.id DESC LIMIT $6`, tenantID, f.Status, f.DocType, afterAt, afterID, f.Limit+1)
		if err != nil {
			return fmt.Errorf("list invoices: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			inv, err := scanInvoice(rows)
			if err != nil {
				return err
			}
			out = append(out, inv)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(out) > f.Limit {
		out = out[:f.Limit]
		last := out[len(out)-1]
		next = encodeCursor(last.CreatedAt.UTC().Format(time.RFC3339Nano), last.ID)
	}
	return out, next, nil
}

// ClaimDue reserva hasta limit documentos vencidos para enviarlos al PAC (R3). Los marca SENT con un
// plazo (lease): si el worker cae, otro los retoma al vencer. SKIP LOCKED evita que dos workers tomen
// el mismo documento.
func (s *Store) ClaimDue(ctx context.Context, now time.Time, limit int, lease time.Duration) ([]domain.Invoice, error) {
	var out []domain.Invoice
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+invoiceCols+`, p.ruc, p.dv FROM invoices i
			JOIN profiles p ON p.tenant_id = i.tenant_id
			WHERE i.status IN ($1, $2) AND i.next_attempt_at <= $3
			ORDER BY i.next_attempt_at, i.id LIMIT $4 FOR UPDATE OF i SKIP LOCKED`,
			domain.StatusQueued, domain.StatusSent, now, limit)
		if err != nil {
			return fmt.Errorf("claim due invoices: %w", err)
		}
		for rows.Next() {
			var ruc, dv string
			inv, err := scanInvoice(rows, &ruc, &dv)
			if err != nil {
				rows.Close()
				return err
			}
			inv.IssuerRUC, inv.IssuerDV = ruc, dv
			out = append(out, inv)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for i := range out {
			if _, err := tx.Exec(ctx, `UPDATE invoices SET status = $2, pac_attempts = pac_attempts + 1,
				next_attempt_at = $3, updated_at = $4 WHERE id = $1`, out[i].ID, domain.StatusSent, now.Add(lease), now); err != nil {
				return fmt.Errorf("lease invoice: %w", err)
			}
			out[i].Status, out[i].PacAttempts = domain.StatusSent, out[i].PacAttempts+1
		}
		return nil
	})
	return out, err
}

// MarkAccepted guarda la autorización del PAC y su evento en la misma transacción (ADR 0012).
func (s *Store) MarkAccepted(ctx context.Context, id, cufe, qr string, at time.Time, ev OutboxEvent) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE invoices SET status = $2, cufe = $3, qr_url = $4, issued_at = $5,
			next_attempt_at = NULL, last_error = NULL, updated_at = $5 WHERE id = $1 AND status = $6`,
			id, domain.StatusAccepted, cufe, qr, at, domain.StatusSent)
		if err != nil {
			return fmt.Errorf("mark accepted: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return nil // otro worker ya lo resolvió: el evento no se duplica
		}
		if err := voidIfFullyCredited(ctx, tx, id, at); err != nil {
			return err
		}
		return insertOutbox(ctx, tx, ev)
	})
}

// voidIfFullyCredited aplica R7: cuando las notas de crédito aceptadas suman el total de la factura,
// la factura pasa a VOIDED (domain-model §8.8). El disparador de N-FIS-08 solo permite ese cambio.
func voidIfFullyCredited(ctx context.Context, tx pgx.Tx, noteID string, at time.Time) error {
	var related *string
	var docType int
	if err := tx.QueryRow(ctx, `SELECT related_invoice_id::text, doc_type FROM invoices WHERE id = $1`, noteID).Scan(&related, &docType); err != nil {
		return fmt.Errorf("load accepted document: %w", err)
	}
	if docType != domain.DocCreditNote || related == nil {
		return nil
	}
	if _, err := tx.Exec(ctx, `UPDATE invoices o SET status = $2, updated_at = $3
		WHERE o.id::text = $1 AND o.status = $4 AND o.total_minor = (
			SELECT coalesce(sum(n.total_minor), 0) FROM invoices n
			WHERE n.related_invoice_id = o.id AND n.doc_type = $5 AND n.status = $4)`,
		*related, domain.StatusVoided, at, domain.StatusAccepted, domain.DocCreditNote); err != nil {
		return fmt.Errorf("void fully credited invoice: %w", err)
	}
	return nil
}

// MarkRejected guarda el rechazo del PAC y su evento.
func (s *Store) MarkRejected(ctx context.Context, id, reason string, at time.Time, ev OutboxEvent) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE invoices SET status = $2, rejection_reason = $3, next_attempt_at = NULL,
			updated_at = $4 WHERE id = $1 AND status = $5`, id, domain.StatusRejected, reason, at, domain.StatusSent)
		if err != nil {
			return fmt.Errorf("mark rejected: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return nil
		}
		return insertOutbox(ctx, tx, ev)
	})
}

// Reschedule devuelve el documento a la cola tras un fallo transitorio (R3, N-FIS-09).
func (s *Store) Reschedule(ctx context.Context, id string, next time.Time, lastError string, at time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE invoices SET status = $2, next_attempt_at = $3, last_error = $4, updated_at = $5
			WHERE id = $1 AND status = $6`, id, domain.StatusQueued, next, lastError, at, domain.StatusSent); err != nil {
			return fmt.Errorf("reschedule invoice: %w", err)
		}
		return nil
	})
}

// PendingAgeSeconds es la edad del documento pendiente más antiguo (alerta si > 1 h, R3).
func (s *Store) PendingAgeSeconds(ctx context.Context, now time.Time) (float64, error) {
	var age float64
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT coalesce(extract(epoch FROM $1::timestamptz - min(created_at)), 0)
			FROM invoices WHERE status IN ($2, $3)`, now, domain.StatusQueued, domain.StatusSent).Scan(&age)
	})
	return age, err
}
