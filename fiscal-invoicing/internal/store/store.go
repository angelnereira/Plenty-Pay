// Package store implementa la persistencia de fiscal-invoicing sobre postgres-db con pgx v5
// (migración 0001_initial). Cada operación fija app.tenant_id (RLS, ADR 0014); el worker de envío al
// PAC y el relay del outbox usan el rol SYSTEM.
package store

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/fiscal-invoicing/internal/domain"
)

// Store es el repositorio de fiscal-invoicing.
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

// OutboxEvent es un evento a publicar junto con el cambio (ADR 0012).
type OutboxEvent struct {
	ID          string
	TenantID    string
	AggregateID string
	Subject     string
	Payload     []byte
	CreatedAt   time.Time
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
	if _, err := tx.Exec(ctx, `
		INSERT INTO outbox (id, tenant_id, aggregate_id, subject, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, e.ID, e.TenantID, e.AggregateID, e.Subject, e.Payload, e.CreatedAt); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

// ── Perfil fiscal ──────────────────────────────────────────────────────────────────────────

const profileCols = `tenant_id, ruc, dv, legal_name, branch_code, point_of_sale_code, pac_provider,
	pac_credentials_secret, certificate_secret_ref, checkout_preference, auto_threshold_minor, environment,
	idempotency_key, updated_at, version`

func scanProfile(row pgx.Row) (domain.Profile, error) {
	var p domain.Profile
	err := row.Scan(&p.TenantID, &p.RUC, &p.DV, &p.LegalName, &p.BranchCode, &p.PointOfSaleCode, &p.PACProvider,
		&p.PACCredentialsSecret, &p.CertificateSecretRef, &p.CheckoutPreference, &p.AutoThresholdMinor, &p.Environment,
		&p.IdempotencyKey, &p.UpdatedAt, &p.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrProfileMissing
	}
	if err != nil {
		return p, fmt.Errorf("scan profile: %w", err)
	}
	return p, nil
}

// GetProfile devuelve el perfil del tenant o domain.ErrProfileMissing.
func (s *Store) GetProfile(ctx context.Context, tenantID string) (domain.Profile, error) {
	var p domain.Profile
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		p, err = scanProfile(tx.QueryRow(ctx, `SELECT `+profileCols+` FROM profiles WHERE tenant_id = $1`, tenantID))
		return err
	})
	return p, err
}

// UpsertProfile crea o reemplaza el perfil y sube su versión. Asegura además la fila de folios del
// punto de facturación para cada tipo de documento (R2).
func (s *Store) UpsertProfile(ctx context.Context, p domain.Profile) (domain.Profile, error) {
	var out domain.Profile
	err := s.inTenant(ctx, p.TenantID, func(tx pgx.Tx) error {
		var err error
		out, err = scanProfile(tx.QueryRow(ctx, `
			INSERT INTO profiles (tenant_id, ruc, dv, legal_name, branch_code, point_of_sale_code, pac_provider,
				pac_credentials_secret, certificate_secret_ref, checkout_preference, auto_threshold_minor, environment,
				idempotency_key, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			ON CONFLICT (tenant_id) DO UPDATE SET ruc = EXCLUDED.ruc, dv = EXCLUDED.dv, legal_name = EXCLUDED.legal_name,
				branch_code = EXCLUDED.branch_code, point_of_sale_code = EXCLUDED.point_of_sale_code,
				pac_provider = EXCLUDED.pac_provider, pac_credentials_secret = EXCLUDED.pac_credentials_secret,
				certificate_secret_ref = EXCLUDED.certificate_secret_ref, checkout_preference = EXCLUDED.checkout_preference,
				auto_threshold_minor = EXCLUDED.auto_threshold_minor, environment = EXCLUDED.environment,
				idempotency_key = EXCLUDED.idempotency_key, updated_at = EXCLUDED.updated_at, version = profiles.version + 1
			RETURNING `+profileCols,
			p.TenantID, p.RUC, p.DV, p.LegalName, p.BranchCode, p.PointOfSaleCode, p.PACProvider, p.PACCredentialsSecret,
			p.CertificateSecretRef, p.CheckoutPreference, p.AutoThresholdMinor, p.Environment, p.IdempotencyKey, p.UpdatedAt))
		if err != nil {
			return err
		}
		for _, doc := range []int{domain.DocFiscalInvoice, domain.DocCreditNote, domain.DocDebitNote} {
			if _, err := tx.Exec(ctx, `INSERT INTO folio_ranges (tenant_id, doc_type, point_of_sale_code)
				VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, p.TenantID, doc, p.PointOfSaleCode); err != nil {
				return fmt.Errorf("ensure folio range: %w", err)
			}
		}
		return nil
	})
	return out, err
}

// ── Folios (R2) ────────────────────────────────────────────────────────────────────────────

// ErrFoliosExhausted indica que se acabó el rango contratado.
var ErrFoliosExhausted = errors.New("rango de folios agotado")

// AllocateNumber reserva el siguiente número del (tenant, tipo, punto) dentro de tx. La fila queda
// bloqueada hasta el fin de la transacción: dos emisiones simultáneas reciben números distintos y
// consecutivos, y un rollback no deja huecos porque el número no se consumió.
func AllocateNumber(ctx context.Context, tx pgx.Tx, tenantID string, docType int, pos string) (int64, error) {
	var n int64
	var last *int64
	err := tx.QueryRow(ctx, `SELECT next_number, last_number FROM folio_ranges
		WHERE tenant_id = $1 AND doc_type = $2 AND point_of_sale_code = $3 FOR UPDATE`, tenantID, docType, pos).Scan(&n, &last)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, domain.ErrProfileMissing
	}
	if err != nil {
		return 0, fmt.Errorf("lock folio range: %w", err)
	}
	if last != nil && n > *last {
		return 0, ErrFoliosExhausted
	}
	if _, err := tx.Exec(ctx, `UPDATE folio_ranges SET next_number = next_number + 1
		WHERE tenant_id = $1 AND doc_type = $2 AND point_of_sale_code = $3`, tenantID, docType, pos); err != nil {
		return 0, fmt.Errorf("advance folio: %w", err)
	}
	return n, nil
}

// AllocateNumberTx asigna un número en su propia transacción (pruebas L2 de R2).
func (s *Store) AllocateNumberTx(ctx context.Context, tenantID string, docType int, pos string) (int64, error) {
	var n int64
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		n, err = AllocateNumber(ctx, tx, tenantID, docType, pos)
		return err
	})
	return n, err
}

// FolioStatus son los folios restantes del tipo factura en el punto del perfil. remaining = -1
// cuando no hay tope contratado.
type FolioStatus struct {
	Next      int64
	Last      *int64
	Remaining int64
}

// GetFolioStatus lee el rango de facturas del punto de facturación.
func (s *Store) GetFolioStatus(ctx context.Context, tenantID, pos string) (FolioStatus, error) {
	var st FolioStatus
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `SELECT next_number, last_number FROM folio_ranges
			WHERE tenant_id = $1 AND doc_type = $2 AND point_of_sale_code = $3`, tenantID, domain.DocFiscalInvoice, pos).
			Scan(&st.Next, &st.Last)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrProfileMissing
		}
		return err
	})
	st.Remaining = -1
	if st.Last != nil {
		st.Remaining = max(*st.Last-st.Next+1, 0)
	}
	return st, err
}

// ── Contribuyentes frecuentes ──────────────────────────────────────────────────────────────

const taxpayerCols = `id, tenant_id, tax_id_type, tax_id, check_digit, legal_name, email, created_at, updated_at, address, location_code`

func scanTaxpayer(row pgx.Row) (domain.Taxpayer, error) {
	var t domain.Taxpayer
	err := row.Scan(&t.ID, &t.TenantID, &t.TaxIDType, &t.TaxID, &t.CheckDigit, &t.LegalName, &t.Email, &t.CreatedAt, &t.UpdatedAt, &t.Address, &t.Location)
	if errors.Is(err, pgx.ErrNoRows) {
		return t, domain.ErrNotFound
	}
	if err != nil {
		return t, fmt.Errorf("scan taxpayer: %w", err)
	}
	return t, nil
}

// UpsertTaxpayer crea o actualiza por (tenant, tax_id): el mismo RUC no se duplica.
func (s *Store) UpsertTaxpayer(ctx context.Context, t domain.Taxpayer) (domain.Taxpayer, error) {
	var out domain.Taxpayer
	err := s.inTenant(ctx, t.TenantID, func(tx pgx.Tx) error {
		var err error
		out, err = scanTaxpayer(tx.QueryRow(ctx, `
			INSERT INTO taxpayers (id, tenant_id, tax_id_type, tax_id, check_digit, legal_name, email, created_at, updated_at,
				address, location_code)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
			ON CONFLICT (tenant_id, tax_id) DO UPDATE SET tax_id_type = EXCLUDED.tax_id_type, check_digit = EXCLUDED.check_digit,
				legal_name = EXCLUDED.legal_name, email = EXCLUDED.email, updated_at = EXCLUDED.updated_at,
				address = EXCLUDED.address, location_code = EXCLUDED.location_code
			RETURNING `+taxpayerCols,
			t.ID, t.TenantID, t.TaxIDType, t.TaxID, t.CheckDigit, t.LegalName, t.Email, t.UpdatedAt, t.Address, t.Location))
		return err
	})
	return out, err
}

// SearchTaxpayers busca por nombre o identificación (prefijo, sin distinguir mayúsculas), ordenado por
// nombre con cursor opaco.
func (s *Store) SearchTaxpayers(ctx context.Context, tenantID, query string, limit int, cursor string) ([]domain.Taxpayer, string, error) {
	afterName, afterID, err := decodeCursor(cursor)
	if err != nil {
		return nil, "", domain.ErrInvalidRequest
	}
	pattern := escapeLike(strings.TrimSpace(query)) + "%"
	var out []domain.Taxpayer
	err = s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+taxpayerCols+` FROM taxpayers
			WHERE (legal_name ILIKE $1 OR tax_id ILIKE $1)
			  AND ($2 = '' OR (lower(legal_name), id::text) > (lower($2), $3))
			ORDER BY lower(legal_name), id LIMIT $4`, pattern, afterName, afterID, limit+1)
		if err != nil {
			return fmt.Errorf("search taxpayers: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			t, err := scanTaxpayer(rows)
			if err != nil {
				return err
			}
			out = append(out, t)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(out) > limit {
		out = out[:limit]
		last := out[len(out)-1]
		next = encodeCursor(last.LegalName, last.ID)
	}
	return out, next, nil
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func encodeCursor(a, b string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(a + "\x00" + b))
}

func decodeCursor(c string) (string, string, error) {
	if c == "" {
		return "", "", nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return "", "", err
	}
	a, b, ok := strings.Cut(string(raw), "\x00")
	if !ok {
		return "", "", errors.New("cursor inválido")
	}
	return a, b, nil
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
