package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
)

// Subjects del outbox que escribe identity (events-and-messaging.md; el relay los publica).
const (
	EventTenantStatusChanged = "pp.identity.tenant.status_changed.v1"
	EventSessionRevoked      = "pp.identity.session.revoked.v1"
	EventRoleChanged         = "pp.identity.role.changed.v1"
	EventMembershipChanged   = "pp.identity.membership.changed.v1"
	EventCapabilitiesChanged = "pp.identity.capabilities.changed.v1"
	EventBranchChanged       = "pp.identity.branch.changed.v1"
)

// Valores de `change` de los eventos del modelo de acceso (identity.proto).
const (
	ChangeCreated     = "CREATED"
	ChangeUpdated     = "UPDATED"
	ChangeArchived    = "ARCHIVED"
	ChangeDeactivated = "DEACTIVATED"
	ChangeReactivated = "REACTIVATED"
	ChangeSuspended   = "SUSPENDED"
	ChangeAccepted    = "ACCEPTED"
	ChangeInvited     = "INVITED"
	ChangeRole        = "ROLE"
	ChangeScope       = "SCOPE"
)

// TenantStore es el contrato de tenants, perfiles, capacidades y sucursales (F08.5, ADR 0018).
type TenantStore interface {
	// CreateTenant crea el negocio en PENDING_REVIEW, asciende al dueno a BUSINESS_OWNER, crea su
	// membresia TENANT, la sucursal matriz 0000 y las capacidades de t.Capabilities, en una transaccion.
	CreateTenant(ctx context.Context, owner *domain.User, t *domain.Tenant) error
	// GetTenant por id (incluye perfil comercial y capacidades).
	GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error)
	// GetTenantByOwner devuelve el tenant del dueno (nil si no tiene).
	GetTenantByOwner(ctx context.Context, userID string) (*domain.Tenant, error)
	// ListTenants pagina por estado (consola de plataforma).
	ListTenants(ctx context.Context, status string, limit int, afterCreatedAt time.Time) ([]domain.Tenant, error)
	// ReviewTenant aplica la transicion y devuelve el estado anterior y el nuevo.
	ReviewTenant(ctx context.Context, tenantID string, approve bool, notes string) (previous, current string, err error)
	// UpdateBusinessProfile guarda verticales y rasgos y reemplaza las capacidades de perfil
	// (VERTICAL/TRAIT) por derived; las MANUAL y PLAN se conservan (R20, regla 4: no borra datos).
	UpdateBusinessProfile(ctx context.Context, tenantID, primaryVertical string, secondaryVerticals []string, traits map[string]bool, derived map[string]string, changedBy string) (*domain.Tenant, error)
	// SetCapabilities enciende o apaga capacidades a mano (source MANUAL).
	SetCapabilities(ctx context.Context, tenantID string, changes map[string]bool, changedBy string) (*domain.Tenant, error)
	// UpsertBranch crea (ID vacio) o edita una sucursal del tenant.
	UpsertBranch(ctx context.Context, b *domain.Branch) (*domain.Branch, error)
	// ListBranches devuelve las sucursales del tenant ordenadas por codigo.
	ListBranches(ctx context.Context, tenantID string, includeInactive bool) ([]domain.Branch, error)
	// SetBranchActive desactiva o reactiva; nunca la ultima activa (ErrCannotDeactivateLastBranch).
	SetBranchActive(ctx context.Context, tenantID, branchID string, active bool) (*domain.Branch, error)
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

// setTenant fija app.tenant_id para que RLS actue como segunda barrera (ADR 0014).
func setTenant(ctx context.Context, tx pgx.Tx, tenantID string) error {
	if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
		return fmt.Errorf("set app.tenant_id: %w", err)
	}
	return nil
}

// setPlatform fija el rol de plataforma para lecturas o escrituras que cruzan tenants
// (resolucion de permisos desde el token, canje de invitacion, outbox).
func setPlatform(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
		return fmt.Errorf("set app.actor_role: %w", err)
	}
	return nil
}

func (s *PostgresTenantStore) CreateTenant(ctx context.Context, owner *domain.User, t *domain.Tenant) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if t.CreatedAt.IsZero() {
		t.CreatedAt = now
	}
	if t.SecondaryVerticals == nil {
		t.SecondaryVerticals = []string{}
	}
	traitsJSON, err := marshalTraits(t.TraitOverrides)
	if err != nil {
		return err
	}
	branchName := strings.TrimSpace(t.BranchName)
	if branchName == "" {
		branchName = "Casa Matriz"
	}
	branchID := uuid.NewString()

	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, owner.ID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		if err := setTenant(ctx, tx, t.ID); err != nil {
			return err
		}
		var existing string
		err := tx.QueryRow(ctx, `SELECT id::text FROM tenants WHERE owner_id = $1::uuid`, owner.ID).Scan(&existing)
		if err == nil {
			return domain.ErrTenantAlreadyExists
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("check owner tenant: %w", err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO tenants (id, legal_name, trade_name, tax_id, dv, status, country, review_notes, owner_id,
			                     primary_vertical, secondary_verticals, trait_overrides, plan_code, version, created_at, updated_at)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11, $12::jsonb, $13, 1, $14, $14)`,
			t.ID, t.LegalName, t.TradeName, t.TaxID, t.DV, domain.TenantPendingReview,
			t.Country, t.ReviewNotes, owner.ID, t.PrimaryVertical, t.SecondaryVerticals, traitsJSON, t.PlanCode, t.CreatedAt)
		if err != nil {
			if isTaxIDTakenViolation(err) {
				return domain.ErrTaxIDTaken
			}
			return fmt.Errorf("insert tenant: %w", err)
		}
		t.Status, t.Version = domain.TenantPendingReview, 1

		// El dueno pasa a BUSINESS_OWNER con su tenant (R6/CreateBusiness).
		if _, err := tx.Exec(ctx, `UPDATE users SET role = 'BUSINESS_OWNER', tenant_id = $1::uuid, updated_at = $2 WHERE id = $3::uuid`,
			t.ID, now, owner.ID); err != nil {
			return fmt.Errorf("promote owner: %w", err)
		}
		// Membresia de dueno con alcance TENANT (ADR 0018).
		if _, err := tx.Exec(ctx, `
			INSERT INTO memberships (id, user_id, tenant_id, base_role, scope, status, created_at, updated_at)
			VALUES ($1::uuid, $2::uuid, $3::uuid, 'BUSINESS_OWNER', 'TENANT', 'ACTIVE', $4, $4)`,
			uuid.NewString(), owner.ID, t.ID, now); err != nil {
			return fmt.Errorf("insert owner membership: %w", err)
		}
		// Sucursal matriz con codigo DGI 0000 (R24).
		if _, err := tx.Exec(ctx, `
			INSERT INTO branches (id, tenant_id, code, name, active, version, created_at, updated_at)
			VALUES ($1::uuid, $2::uuid, '0000', $3, true, 1, $4, $4)`,
			branchID, t.ID, branchName, now); err != nil {
			return fmt.Errorf("insert headquarters branch: %w", err)
		}
		for _, c := range t.Capabilities {
			if _, err := tx.Exec(ctx, `
				INSERT INTO tenant_capabilities (tenant_id, capability, enabled, source, changed_by, changed_at)
				VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6)`,
				t.ID, c.Capability, c.Enabled, c.Source, owner.ID, now); err != nil {
				return fmt.Errorf("insert tenant capability %s: %w", c.Capability, err)
			}
		}
		for _, k := range t.Documents {
			if _, err := tx.Exec(ctx, `INSERT INTO tenant_kyb_documents (tenant_id, object_key) VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING`, t.ID, k); err != nil {
				return fmt.Errorf("insert kyb document: %w", err)
			}
		}
		branchEvent, err := branchChangedPayload(t.ID, branchID, ChangeCreated)
		if err != nil {
			return err
		}
		statusEvent, err := tenantStatusPayload(t.ID, domain.TenantPendingReview, "")
		if err != nil {
			return err
		}
		return writeOutboxTx(ctx, tx,
			OutboxEvent{ID: uuid.NewString(), EventType: EventTenantStatusChanged, AggregateID: t.ID, TenantID: t.ID, Payload: statusEvent, CreatedAt: now},
			OutboxEvent{ID: uuid.NewString(), EventType: EventBranchChanged, AggregateID: branchID, TenantID: t.ID, Payload: branchEvent, CreatedAt: now},
		)
	})
}

func (s *PostgresTenantStore) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	var t domain.Tenant
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		return loadTenantTx(ctx, tx, `WHERE id = $1::uuid`, tenantID, &t)
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
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		return loadTenantTx(ctx, tx, `WHERE owner_id = $1::uuid`, userID, &t)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get tenant by owner: %w", err)
	}
	return &t, nil
}

func (s *PostgresTenantStore) ListTenants(ctx context.Context, status string, limit int, afterCreatedAt time.Time) ([]domain.Tenant, error) {
	var out []domain.Tenant
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, tenantSelect+`
			WHERE ($1 = '' OR status = $1) AND created_at < $2
			ORDER BY created_at DESC LIMIT $3`, status, afterCreatedAt, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var t domain.Tenant
			if err := scanTenant(rows, &t); err != nil {
				return err
			}
			out = append(out, t)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("list tenants: %w", err)
	}
	return out, nil
}

// ReviewTenant aplica la transicion y escribe el evento en la MISMA transaccion
// (ADR 0012): un cambio de estado = una fila de outbox, nunca dos.
func (s *PostgresTenantStore) ReviewTenant(ctx context.Context, tenantID string, approve bool, notes string) (string, string, error) {
	var previous, current string
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
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
		payload, err := tenantStatusPayload(tenantID, next, previous)
		if err != nil {
			return err
		}
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID: uuid.NewString(), EventType: EventTenantStatusChanged, AggregateID: tenantID, TenantID: tenantID,
			Payload: payload, CreatedAt: time.Now().UTC(),
		})
	})
	if err != nil {
		return "", "", err
	}
	return previous, current, nil
}

func (s *PostgresTenantStore) UpdateBusinessProfile(ctx context.Context, tenantID, primaryVertical string, secondaryVerticals []string, traits map[string]bool, derived map[string]string, changedBy string) (*domain.Tenant, error) {
	if secondaryVerticals == nil {
		secondaryVerticals = []string{}
	}
	traitsJSON, err := marshalTraits(traits)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	err = pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// La politica de tenants solo deja actualizar al dueno o a plataforma; el servicio ya
		// verifico admin:business:manage y cada sentencia filtra por tenant_id.
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		before, err := enabledCapabilitiesTx(ctx, tx, tenantID)
		if err != nil {
			return err
		}
		var version int32
		err = tx.QueryRow(ctx, `
			UPDATE tenants
			SET primary_vertical = $2, secondary_verticals = $3, trait_overrides = $4::jsonb, version = version + 1, updated_at = $5
			WHERE id = $1::uuid
			RETURNING version`,
			tenantID, primaryVertical, secondaryVerticals, traitsJSON, now).Scan(&version)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrTenantNotFound
			}
			return fmt.Errorf("update business profile: %w", err)
		}
		// Las capacidades de perfil se recalculan; las MANUAL (decision del dueno) y PLAN se respetan.
		if _, err := tx.Exec(ctx, `DELETE FROM tenant_capabilities WHERE tenant_id = $1::uuid AND source IN ('VERTICAL', 'TRAIT')`, tenantID); err != nil {
			return fmt.Errorf("clear profile capabilities: %w", err)
		}
		for _, capKey := range sortedKeys(derived) {
			if _, err := tx.Exec(ctx, `
				INSERT INTO tenant_capabilities (tenant_id, capability, enabled, source, changed_by, changed_at)
				VALUES ($1::uuid, $2, true, $3, NULLIF($4, '')::uuid, $5)
				ON CONFLICT (tenant_id, capability) DO NOTHING`,
				tenantID, capKey, derived[capKey], changedBy, now); err != nil {
				return fmt.Errorf("insert derived capability %s: %w", capKey, err)
			}
		}
		return writeCapabilitiesChangedTx(ctx, tx, tenantID, before, version, now)
	})
	if err != nil {
		return nil, err
	}
	return s.GetTenant(ctx, tenantID)
}

func (s *PostgresTenantStore) SetCapabilities(ctx context.Context, tenantID string, changes map[string]bool, changedBy string) (*domain.Tenant, error) {
	now := time.Now().UTC()
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// La politica de tenants solo deja actualizar al dueno o a plataforma; el servicio ya
		// verifico admin:business:manage y cada sentencia filtra por tenant_id.
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		before, err := enabledCapabilitiesTx(ctx, tx, tenantID)
		if err != nil {
			return err
		}
		var version int32
		if err := tx.QueryRow(ctx, `UPDATE tenants SET version = version + 1, updated_at = $2 WHERE id = $1::uuid RETURNING version`,
			tenantID, now).Scan(&version); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrTenantNotFound
			}
			return fmt.Errorf("bump tenant version: %w", err)
		}
		for _, capKey := range sortedKeys(changes) {
			if _, err := tx.Exec(ctx, `
				INSERT INTO tenant_capabilities (tenant_id, capability, enabled, source, changed_by, changed_at)
				VALUES ($1::uuid, $2, $3, 'MANUAL', NULLIF($4, '')::uuid, $5)
				ON CONFLICT (tenant_id, capability)
				DO UPDATE SET enabled = EXCLUDED.enabled, source = 'MANUAL', changed_by = EXCLUDED.changed_by, changed_at = EXCLUDED.changed_at`,
				tenantID, capKey, changes[capKey], changedBy, now); err != nil {
				return fmt.Errorf("set capability %s: %w", capKey, err)
			}
		}
		return writeCapabilitiesChangedTx(ctx, tx, tenantID, before, version, now)
	})
	if err != nil {
		return nil, err
	}
	return s.GetTenant(ctx, tenantID)
}

func (s *PostgresTenantStore) UpsertBranch(ctx context.Context, b *domain.Branch) (*domain.Branch, error) {
	now := time.Now().UTC()
	out := *b
	if out.OpeningHoursJSON == "" {
		out.OpeningHoursJSON = "{}"
	}
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, out.TenantID); err != nil {
			return err
		}
		change := ChangeUpdated
		var err error
		if out.ID == "" {
			change = ChangeCreated
			out.ID = uuid.NewString()
			err = tx.QueryRow(ctx, `
				INSERT INTO branches (id, tenant_id, code, name, address, latitude_e6, longitude_e6, opening_hours_json, active, version, created_at, updated_at)
				VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, true, 1, $9, $9)
				RETURNING active, version, created_at, updated_at`,
				out.ID, out.TenantID, out.Code, out.Name, out.Address, out.LatitudeE6, out.LongitudeE6, out.OpeningHoursJSON, now).
				Scan(&out.Active, &out.Version, &out.CreatedAt, &out.UpdatedAt)
		} else {
			err = tx.QueryRow(ctx, `
				UPDATE branches
				SET code = $3, name = $4, address = $5, latitude_e6 = $6, longitude_e6 = $7, opening_hours_json = $8,
				    version = version + 1, updated_at = $9
				WHERE id = $1::uuid AND tenant_id = $2::uuid
				RETURNING active, version, created_at, updated_at`,
				out.ID, out.TenantID, out.Code, out.Name, out.Address, out.LatitudeE6, out.LongitudeE6, out.OpeningHoursJSON, now).
				Scan(&out.Active, &out.Version, &out.CreatedAt, &out.UpdatedAt)
		}
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrBranchNotFound
			}
			if isBranchCodeTakenViolation(err) {
				return domain.ErrBranchCodeTaken
			}
			return fmt.Errorf("upsert branch: %w", err)
		}
		payload, err := branchChangedPayload(out.TenantID, out.ID, change)
		if err != nil {
			return err
		}
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID: uuid.NewString(), EventType: EventBranchChanged, AggregateID: out.ID, TenantID: out.TenantID, Payload: payload, CreatedAt: now,
		})
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *PostgresTenantStore) ListBranches(ctx context.Context, tenantID string, includeInactive bool) ([]domain.Branch, error) {
	var out []domain.Branch
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, branchSelect+`
			WHERE tenant_id = $1::uuid AND ($2 OR active)
			ORDER BY code`, tenantID, includeInactive)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var b domain.Branch
			if err := scanBranch(rows, &b); err != nil {
				return err
			}
			out = append(out, b)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("list branches: %w", err)
	}
	return out, nil
}

func (s *PostgresTenantStore) SetBranchActive(ctx context.Context, tenantID, branchID string, active bool) (*domain.Branch, error) {
	var out domain.Branch
	now := time.Now().UTC()
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		// Bloquea todas las sucursales del tenant: dos desactivaciones simultaneas no pueden dejarlo sin ninguna.
		if _, err := tx.Exec(ctx, `SELECT id FROM branches WHERE tenant_id = $1::uuid FOR UPDATE`, tenantID); err != nil {
			return fmt.Errorf("lock branches: %w", err)
		}
		if err := scanBranch(tx.QueryRow(ctx, branchSelect+` WHERE id = $1::uuid AND tenant_id = $2::uuid`, branchID, tenantID), &out); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrBranchNotFound
			}
			return fmt.Errorf("load branch: %w", err)
		}
		if out.Active == active {
			return nil // sin cambio: idempotente, no escribe evento
		}
		if !active {
			var activeCount int
			if err := tx.QueryRow(ctx, `SELECT count(*) FROM branches WHERE tenant_id = $1::uuid AND active`, tenantID).Scan(&activeCount); err != nil {
				return fmt.Errorf("count active branches: %w", err)
			}
			if activeCount <= 1 {
				return domain.ErrCannotDeactivateLastBranch
			}
		}
		if err := tx.QueryRow(ctx, `
			UPDATE branches SET active = $3, version = version + 1, updated_at = $4
			WHERE id = $1::uuid AND tenant_id = $2::uuid
			RETURNING active, version, updated_at`,
			branchID, tenantID, active, now).Scan(&out.Active, &out.Version, &out.UpdatedAt); err != nil {
			return fmt.Errorf("update branch active: %w", err)
		}
		change := ChangeDeactivated
		if active {
			change = ChangeReactivated
		}
		payload, err := branchChangedPayload(tenantID, branchID, change)
		if err != nil {
			return err
		}
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID: uuid.NewString(), EventType: EventBranchChanged, AggregateID: branchID, TenantID: tenantID, Payload: payload, CreatedAt: now,
		})
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *PostgresTenantStore) OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	var out []OutboxEvent
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
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
	var affected int64
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
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

// ── Lectura de filas ──────────────────────────────────────────────────────────

const tenantSelect = `SELECT id::text, legal_name, trade_name, tax_id, dv, status, country, review_notes, owner_id::text,
	primary_vertical, secondary_verticals, trait_overrides::text, plan_code, version, created_at
	FROM tenants `

func scanTenant(row pgx.Row, t *domain.Tenant) error {
	var traitsRaw string
	if err := row.Scan(&t.ID, &t.LegalName, &t.TradeName, &t.TaxID, &t.DV, &t.Status, &t.Country, &t.ReviewNotes, &t.OwnerID,
		&t.PrimaryVertical, &t.SecondaryVerticals, &traitsRaw, &t.PlanCode, &t.Version, &t.CreatedAt); err != nil {
		return err
	}
	t.TraitOverrides = map[string]bool{}
	if err := json.Unmarshal([]byte(traitsRaw), &t.TraitOverrides); err != nil {
		return fmt.Errorf("decode trait_overrides of tenant %s: %w", t.ID, err)
	}
	return nil
}

func loadTenantTx(ctx context.Context, tx pgx.Tx, where, arg string, t *domain.Tenant) error {
	if err := scanTenant(tx.QueryRow(ctx, tenantSelect+where, arg), t); err != nil {
		return err
	}
	caps, err := loadCapabilitiesTx(ctx, tx, t.ID)
	if err != nil {
		return err
	}
	t.Capabilities = caps
	return nil
}

const branchSelect = `SELECT id::text, tenant_id::text, code, name, address, latitude_e6, longitude_e6, opening_hours_json,
	active, version, created_at, updated_at FROM branches `

func scanBranch(row pgx.Row, b *domain.Branch) error {
	return row.Scan(&b.ID, &b.TenantID, &b.Code, &b.Name, &b.Address, &b.LatitudeE6, &b.LongitudeE6, &b.OpeningHoursJSON,
		&b.Active, &b.Version, &b.CreatedAt, &b.UpdatedAt)
}

func loadCapabilitiesTx(ctx context.Context, tx pgx.Tx, tenantID string) ([]domain.CapabilityState, error) {
	rows, err := tx.Query(ctx, `
		SELECT capability, enabled, source FROM tenant_capabilities
		WHERE tenant_id = $1::uuid ORDER BY capability`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("load capabilities: %w", err)
	}
	defer rows.Close()
	var out []domain.CapabilityState
	for rows.Next() {
		var cs domain.CapabilityState
		if err := rows.Scan(&cs.Capability, &cs.Enabled, &cs.Source); err != nil {
			return nil, fmt.Errorf("scan capability: %w", err)
		}
		out = append(out, cs)
	}
	return out, rows.Err()
}

func enabledCapabilitiesTx(ctx context.Context, tx pgx.Tx, tenantID string) (map[string]bool, error) {
	caps, err := loadCapabilitiesTx(ctx, tx, tenantID)
	if err != nil {
		return nil, err
	}
	out := map[string]bool{}
	for _, c := range caps {
		if c.Enabled {
			out[c.Capability] = true
		}
	}
	return out, nil
}

// writeCapabilitiesChangedTx compara las capacidades encendidas antes y despues y, si cambio
// algo, escribe CapabilitiesChanged con lo encendido y lo apagado (ADR 0012).
func writeCapabilitiesChangedTx(ctx context.Context, tx pgx.Tx, tenantID string, before map[string]bool, version int32, now time.Time) error {
	after, err := enabledCapabilitiesTx(ctx, tx, tenantID)
	if err != nil {
		return err
	}
	enabled, disabled := []string{}, []string{}
	for c := range after {
		if !before[c] {
			enabled = append(enabled, c)
		}
	}
	for c := range before {
		if !after[c] {
			disabled = append(disabled, c)
		}
	}
	if len(enabled) == 0 && len(disabled) == 0 {
		return nil
	}
	sort.Strings(enabled)
	sort.Strings(disabled)
	payload, err := json.Marshal(map[string]any{
		"tenant_id": tenantID, "enabled": enabled, "disabled": disabled, "version": version,
	})
	if err != nil {
		return fmt.Errorf("marshal capabilities changed: %w", err)
	}
	return writeOutboxTx(ctx, tx, OutboxEvent{
		ID: uuid.NewString(), EventType: EventCapabilitiesChanged, AggregateID: tenantID, TenantID: tenantID, Payload: payload, CreatedAt: now,
	})
}

// writeOutboxTx inserta los eventos dentro de la transaccion del efecto (ADR 0012). Pasa a rol de
// plataforma (la politica del outbox lo exige): debe ser lo ultimo que haga la transaccion.
func writeOutboxTx(ctx context.Context, tx pgx.Tx, events ...OutboxEvent) error {
	if err := setPlatform(ctx, tx); err != nil {
		return err
	}
	for _, e := range events {
		if _, err := tx.Exec(ctx, `INSERT INTO outbox (id, event_type, aggregate_id, tenant_id, payload, created_at)
			VALUES ($1::uuid, $2, $3::uuid, NULLIF($4, '')::uuid, $5, $6)`,
			e.ID, e.EventType, e.AggregateID, e.TenantID, e.Payload, e.CreatedAt); err != nil {
			return fmt.Errorf("insert outbox %s: %w", e.EventType, err)
		}
	}
	return nil
}

func tenantStatusPayload(tenantID, status, previous string) ([]byte, error) {
	b, err := json.Marshal(map[string]any{
		"tenant_id":       tenantID,
		"status":          status,
		"previous_status": strings.TrimSpace(previous),
	})
	if err != nil {
		return nil, fmt.Errorf("marshal tenant status: %w", err)
	}
	return b, nil
}

func branchChangedPayload(tenantID, branchID, change string) ([]byte, error) {
	b, err := json.Marshal(map[string]any{"tenant_id": tenantID, "branch_id": branchID, "change": change})
	if err != nil {
		return nil, fmt.Errorf("marshal branch changed: %w", err)
	}
	return b, nil
}

func marshalTraits(traits map[string]bool) (string, error) {
	if traits == nil {
		return "{}", nil
	}
	b, err := json.Marshal(traits)
	if err != nil {
		return "", fmt.Errorf("marshal trait overrides: %w", err)
	}
	return string(b), nil
}

func sortedKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// isTaxIDTakenViolation detecta 23505 sobre el indice unico del RUC (R17).
func isTaxIDTakenViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return strings.Contains(pgErr.ConstraintName, "tax_id")
}

// isBranchCodeTakenViolation detecta 23505 sobre el indice unico (tenant, code).
func isBranchCodeTakenViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return pgErr.ConstraintName == "branches_tenant_code_uidx"
}
