package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
)

// TenantStore es el contrato de tenants que usa el servicio (F08.5).
type TenantStore interface {
	// CreateTenant crea el negocio en PENDING_REVIEW, asciende al dueno a
	// BUSINESS_OWNER y registra las claves KYB, todo en una transaccion.
	CreateTenant(ctx context.Context, owner *domain.User, t *domain.Tenant) error
	// GetTenant por id (miembro o plataforma).
	GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error)
	// GetTenantByOwner devuelve el tenant del dueno (nil si no tiene).
	GetTenantByOwner(ctx context.Context, userID string) (*domain.Tenant, error)
	// ListTenants pagina por estado (consola de plataforma).
	ListTenants(ctx context.Context, status string, limit int, afterCreatedAt time.Time) ([]domain.Tenant, error)
	// ReviewTenant aplica la transicion y devuelve el tenant con su estado
	// anterior (para el evento). Si approve/notes no cambian nada, error.
	ReviewTenant(ctx context.Context, tenantID string, approve bool, notes string) (previous, current string, err error)
	// OutboxPending lista eventos sin publicar en orden de creacion.
	OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error)
	// OutboxMarkPublished marca el evento como publicado (ack de NATS).
	OutboxMarkPublished(ctx context.Context, id string) error
}

// OutboxEvent es una fila del outbox lista para publicar.
type OutboxEvent struct {
	ID          string
	EventType   string
	AggregateID string
	TenantID    string
	Payload     []byte
	CreatedAt   time.Time
}

// PostgresTenantStore implementa TenantStore sobre postgres-db.
type PostgresTenantStore struct {
	pool *pgxpool.Pool
}

// Compila-time: cumple la interfaz.
var _ TenantStore = (*PostgresTenantStore)(nil)

// NewPostgresTenantStore envuelve un pool ya conectado.
func NewPostgresTenantStore(pool *pgxpool.Pool) *PostgresTenantStore {
	return &PostgresTenantStore{pool: pool}
}

func (s *PostgresTenantStore) CreateTenant(ctx context.Context, owner *domain.User, t *domain.Tenant) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	t.CreatedAt = now

	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// El dueno es el usuario del contexto y actua sobre SU tenant: RLS
		// valida con app.user_id y app.tenant_id (el tenant que se esta creando).
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, owner.ID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, t.ID); err != nil {
			return fmt.Errorf("set app.tenant_id: %w", err)
		}
		// dominio-model.md 3.2: como maximo un tenant por dueno (indice unico).
		var existing string
		err := tx.QueryRow(ctx, `SELECT id::text FROM tenants WHERE owner_id = $1::uuid`, owner.ID).Scan(&existing)
		if err == nil {
			return domain.ErrTenantAlreadyExists
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("check owner tenant: %w", err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO tenants (id, legal_name, trade_name, tax_id, dv, status, country, review_notes, owner_id, created_at, updated_at)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $10)`,
			t.ID, t.LegalName, t.TradeName, t.TaxID, t.DV, domain.TenantPendingReview,
			t.Country, t.ReviewNotes, owner.ID, now)
		if err != nil {
			if isTaxIDTakenViolation(err) {
				return domain.ErrTaxIDTaken
			}
			return fmt.Errorf("insert tenant: %w", err)
		}

		// El dueno pasa a BUSINESS_OWNER con su tenant (R6/CreateBusiness).
		_, err = tx.Exec(ctx, `UPDATE users SET role = 'BUSINESS_OWNER', tenant_id = $1::uuid, updated_at = $2 WHERE id = $3::uuid`,
			t.ID, now, owner.ID)
		if err != nil {
			return fmt.Errorf("promote owner: %w", err)
		}

		for _, k := range t.Documents {
			if _, err := tx.Exec(ctx, `INSERT INTO tenant_kyb_documents (tenant_id, object_key) VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING`, t.ID, k); err != nil {
				return fmt.Errorf("insert kyb document: %w", err)
			}
		}

		// El alta tambien es un cambio de estado que los consumidores necesitan
		// (payments-core rechaza tenants no ACTIVE): evento con previo vacio.
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID:        uuid.NewString(),
			EventType: "pp.identity.tenant.status_changed.v1",
			// El agregado es el tenant; el tenant_id del sobre es el mismo.
			AggregateID: t.ID,
			TenantID:    t.ID,
			Payload:     tenantStatusPayload(t.ID, domain.TenantPendingReview, ""),
			CreatedAt:   now,
		})
	})
}

func (s *PostgresTenantStore) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	var t domain.Tenant
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, tenantSelect+` WHERE id = $1::uuid`, tenantID).Scan(&t.ID, &t.LegalName, &t.TradeName, &t.TaxID, &t.DV, &t.Status, &t.Country, &t.ReviewNotes, &t.OwnerID, &t.CreatedAt)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrTenantNotFound
		}
		return nil, fmt.Errorf("get tenant: %w", err)
	}
	return &t, nil
}

func (s *PostgresTenantStore) GetTenantByOwner(ctx context.Context, userID string) (*domain.Tenant, error) {
	var t domain.Tenant
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, tenantSelect+` WHERE owner_id = $1::uuid`, userID).Scan(&t.ID, &t.LegalName, &t.TradeName, &t.TaxID, &t.DV, &t.Status, &t.Country, &t.ReviewNotes, &t.OwnerID, &t.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrTenantNotFound
		}
		return err
	})
	if err != nil {
		if errors.Is(err, domain.ErrTenantNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (s *PostgresTenantStore) ListTenants(ctx context.Context, status string, limit int, afterCreatedAt time.Time) ([]domain.Tenant, error) {
	rows, err := s.pool.Query(ctx, tenantSelect+`
		WHERE ($1 = '' OR status = $1) AND created_at < $2
		ORDER BY created_at DESC LIMIT $3`, status, afterCreatedAt, limit)
	if err != nil {
		return nil, fmt.Errorf("list tenants: %w", err)
	}
	defer rows.Close()
	return scanTenants(rows)
}

// ReviewTenant aplica la transicion y escribe el evento en la MISMA transaccion
// (ADR 0012): un cambio de estado = una fila de outbox, nunca dos.
func (s *PostgresTenantStore) ReviewTenant(ctx context.Context, tenantID string, approve bool, notes string) (string, string, error) {
	var previous, current string
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// La revision es operacion de plataforma (R: platform:tenants:review).
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT status FROM tenants WHERE id = $1::uuid FOR UPDATE`, tenantID).Scan(&previous); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrTenantNotFound
			}
			return fmt.Errorf("load tenant for review: %w", err)
		}
		next, err := domain.NextStatus(previous, approve)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE tenants SET status = $2, review_notes = $3, updated_at = now() WHERE id = $1::uuid`,
			tenantID, next, notes); err != nil {
			return fmt.Errorf("update tenant status: %w", err)
		}
		current = next
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID:          uuid.NewString(),
			EventType:   "pp.identity.tenant.status_changed.v1",
			AggregateID: tenantID,
			TenantID:    tenantID,
			Payload:     tenantStatusPayload(tenantID, next, previous),
			CreatedAt:   time.Now().UTC(),
		})
	})
	if err != nil {
		return "", "", err
	}
	return previous, current, nil
}

func (s *PostgresTenantStore) OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	// El relay es operacion de plataforma (no hereda el contexto del handler).
	var out []OutboxEvent
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id::text, event_type, aggregate_id::text, coalesce(tenant_id::text, ''), payload, created_at
			FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT $1`, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e OutboxEvent
			if err := rows.Scan(&e.ID, &e.EventType, &e.AggregateID, &e.TenantID, &e.Payload, &e.CreatedAt); err != nil {
				return fmt.Errorf("scan outbox: %w", err)
			}
			out = append(out, e)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("outbox pending: %w", err)
	}
	return out, nil
}

func (s *PostgresTenantStore) OutboxMarkPublished(ctx context.Context, id string) error {
	// Como plataforma: el relay no hereda el contexto del handler que escribio.
	// Sin este rol, RLS bloquea el UPDATE en silencio y el evento se republica.
	var affected int64
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `UPDATE outbox SET published_at = now() WHERE id = $1::uuid`, id)
		if err != nil {
			return err
		}
		affected = tag.RowsAffected()
		return nil
	})
	if err != nil {
		return fmt.Errorf("mark published: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("mark published: el evento %s no estaba pendiente", id)
	}
	return nil
}

const tenantSelect = `SELECT id::text, legal_name, trade_name, tax_id, dv, status, country, review_notes, owner_id::text, created_at FROM tenants`

func scanTenants(rows pgx.Rows) ([]domain.Tenant, error) {
	var out []domain.Tenant
	for rows.Next() {
		var t domain.Tenant
		if err := rows.Scan(&t.ID, &t.LegalName, &t.TradeName, &t.TaxID, &t.DV, &t.Status, &t.Country, &t.ReviewNotes, &t.OwnerID, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan tenant: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// writeOutboxTx inserta el evento dentro de la transaccion del efecto (ADR 0012).
func writeOutboxTx(ctx context.Context, tx pgx.Tx, e OutboxEvent) error {
	if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO outbox (id, event_type, aggregate_id, tenant_id, payload, created_at)
		VALUES ($1::uuid, $2, $3::uuid, NULLIF($4, '')::uuid, $5, $6)`,
		e.ID, e.EventType, e.AggregateID, e.TenantID, e.Payload, e.CreatedAt)
	return err
}

// tenantStatusPayload serializa TenantStatusChanged (JSON provisional hasta el
// relay, que empaqueta el EventEnvelope del contrato).
func tenantStatusPayload(tenantID, status, previous string) []byte {
	previous = strings.TrimSpace(previous)
	b, _ := json.Marshal(map[string]any{
		"tenant_id":       tenantID,
		"status":          status,
		"previous_status": previous,
	})
	return b
}

// isTaxIDTakenViolation detecta 23505 sobre el indice unico del RUC (R17).
func isTaxIDTakenViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return strings.Contains(pgErr.ConstraintName, "tax_id")
}
