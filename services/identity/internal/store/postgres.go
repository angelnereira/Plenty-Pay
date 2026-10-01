// Implementación PostgreSQL de los backends de identity: Storage (ADR-0010:
// sqlc type-safe), SessionBackend (hash de token, no token en claro) y
// Auditor (append-only). Unicidad/duplicados se resuelven leyendo el código
// de error PG 23505 + nombre de constraint — fail secure.
package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/authz"
	db "plentypay.dev/services/identity/internal/db"
)

// --- helpers ---

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

// pgDup clasifica un error de unicidad por constraint.
func pgDup(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" && pgErr.ConstraintName == constraint
	}
	return false
}

func pgTS(t time.Time) pgtype.Timestamptz     { return pgtype.Timestamptz{Time: t, Valid: true} }
func tsFromPg(t pgtype.Timestamptz) time.Time { return t.Time }
func pgText(s string) pgtype.Text             { return pgtype.Text{String: s, Valid: s != ""} }

// --- Storage (usuarios/tenants) ---

type PostgresStore struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool, q: db.New(pool)}
}

func (s *PostgresStore) CreateTenant(name, ownerEmail, ownerPasswordHash string, roles []authz.RoleKey) (*Tenant, *User, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op tras commit

	qtx := s.q.WithTx(tx)
	tRow, err := qtx.CreateTenant(ctx, db.CreateTenantParams{
		ID:     newID("ten"),
		Name:   name,
		Status: "active",
	})
	if err != nil {
		if pgDup(err, "tenants_name_uq") {
			return nil, nil, ErrDuplicateTenantName
		}
		return nil, nil, err
	}
	uRow, err := qtx.CreateUser(ctx, db.CreateUserParams{
		ID:           newID("usr"),
		TenantID:     tRow.ID,
		Email:        ownerEmail,
		PasswordHash: ownerPasswordHash,
		Status:       "active",
		Roles:        roleKeysToStrings(roles),
	})
	if err != nil {
		if pgDup(err, "users_email_glob_uq") || pgDup(err, "users_tenant_email_uq") {
			return nil, nil, ErrDuplicateEmail
		}
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return tenantFromRow(tRow), userFromRow(uRow), nil
}

func (s *PostgresStore) CreateUser(tenantID, email, passwordHash string, roles []authz.RoleKey) (*User, error) {
	ctx := context.Background()
	if _, err := s.q.GetTenantByID(ctx, tenantID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	row, err := s.q.CreateUser(ctx, db.CreateUserParams{
		ID:           newID("usr"),
		TenantID:     tenantID,
		Email:        email,
		PasswordHash: passwordHash,
		Status:       "active",
		Roles:        roleKeysToStrings(roles),
	})
	if err != nil {
		if pgDup(err, "users_email_glob_uq") || pgDup(err, "users_tenant_email_uq") {
			return nil, ErrDuplicateEmail
		}
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *PostgresStore) UserByEmail(email string) (*User, error) {
	row, err := s.q.GetUserByEmail(context.Background(), email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *PostgresStore) UserByID(id string) (*User, error) {
	row, err := s.q.GetUserByID(context.Background(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *PostgresStore) TenantByID(id string) (*Tenant, error) {
	row, err := s.q.GetTenantByID(context.Background(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, err
	}
	return tenantFromRow(row), nil
}

// --- SessionBackend (PostgreSQL) ---

type PostgresSessions struct {
	q   *db.Queries
	ttl time.Duration
}

func NewPostgresSessions(pool *pgxpool.Pool, ttl time.Duration) *PostgresSessions {
	return &PostgresSessions{q: db.New(pool), ttl: ttl}
}

func (s *PostgresSessions) Create(userID, tenantID string) (string, *auth.Session, error) {
	token, tokenHash, err := auth.NewToken()
	if err != nil {
		return "", nil, err
	}
	row, err := s.q.CreateSession(context.Background(), db.CreateSessionParams{
		ID:        newID("ses"),
		UserID:    userID,
		TenantID:  tenantID,
		TokenHash: tokenHash,
		ExpiresAt: pgTS(time.Now().Add(s.ttl)),
	})
	if err != nil {
		return "", nil, err
	}
	return token, &auth.Session{
		ID: row.ID, UserID: row.UserID, TenantID: row.TenantID,
		TokenHash: row.TokenHash, ExpiresAt: tsFromPg(row.ExpiresAt),
	}, nil
}

func (s *PostgresSessions) Validate(token string) (*auth.Session, error) {
	row, err := s.q.GetSessionByToken(context.Background(), auth.TokenHash(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, auth.ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &auth.Session{
		ID: row.ID, UserID: row.UserID, TenantID: row.TenantID,
		TokenHash: row.TokenHash, ExpiresAt: tsFromPg(row.ExpiresAt),
	}, nil
}

// Revoke es idempotente (mandato §13): reintentar no es error.
func (s *PostgresSessions) Revoke(token string) error {
	return s.q.RevokeSessionByToken(context.Background(), auth.TokenHash(token))
}

// --- Auditor (append-only) ---

type PostgresAuditor struct {
	q   *db.Queries
	log *slog.Logger
}

func NewPostgresAuditor(pool *pgxpool.Pool, log *slog.Logger) *PostgresAuditor {
	return &PostgresAuditor{q: db.New(pool), log: log}
}

func (a *PostgresAuditor) Record(ctx context.Context, event, userID, tenantID string, detail map[string]any) {
	raw, _ := json.Marshal(detail)
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	// La auditoría NUNCA bloquea el flujo de negocio: si el insert falla se
	// registra como error de observabilidad (visible, no silencioso).
	if err := a.q.InsertAudit(ctx, db.InsertAuditParams{
		ID: newID("aud"), Event: event, UserID: pgText(userID),
		TenantID: pgText(tenantID), Detail: raw,
	}); err != nil {
		a.log.Error("auditoría falló", "event", event, "user_id", userID, "err", err)
	}
}

// --- conversores ---

func roleKeysToStrings(roles []authz.RoleKey) []string {
	out := make([]string, 0, len(roles))
	for _, r := range roles {
		out = append(out, string(r))
	}
	return out
}

func userFromRow(r db.IdentityUser) *User {
	roles := make([]authz.RoleKey, 0, len(r.Roles))
	for _, s := range r.Roles {
		roles = append(roles, authz.RoleKey(s))
	}
	return &User{
		ID: r.ID, TenantID: r.TenantID, Email: r.Email,
		PasswordHash: r.PasswordHash, Status: r.Status, Roles: roles,
	}
}

func tenantFromRow(r db.IdentityTenant) *Tenant {
	return &Tenant{ID: r.ID, Name: r.Name, Status: r.Status}
}
