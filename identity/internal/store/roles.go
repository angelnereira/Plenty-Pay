package store

import (
	"context"
	"crypto/sha256"
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

// InvitationTTL es la vigencia de una invitacion de staff (SPEC §4: 7 dias).
const InvitationTTL = 7 * 24 * time.Hour

// RoleStore es el contrato de roles, invitaciones y staff (F08.6).
type RoleStore interface {
	// CreateRole crea un rol del tenant con sus permisos (ya validados, R12).
	CreateRole(ctx context.Context, tenantID, name string, permissions []string) (*domain.Role, error)
	// ListRoles devuelve los presets de sistema y los del tenant.
	ListRoles(ctx context.Context, tenantID string) ([]domain.Role, error)
	// AssignRole asigna un rol a un usuario del tenant.
	AssignRole(ctx context.Context, userID, roleID string) error
	// CreateInvitation invita a un correo con un rol; devuelve el token en claro
	// (solo se guarda el hash) y la fecha de expiracion.
	CreateInvitation(ctx context.Context, tenantID, email, fullName, roleID, invitedBy string) (token string, expiresAt time.Time, err error)
	// AcceptInvitation canjea el token: crea el usuario BUSINESS_STAFF con el rol.
	// passwordHash llega ya calculado (R19: el store nunca ve texto plano).
	AcceptInvitation(ctx context.Context, token, passwordHash string) (*domain.User, *domain.Role, error)
	// ListUsers pagina el staff del tenant.
	ListUsers(ctx context.Context, tenantID string) ([]domain.User, error)
	// DeactivateUser desactiva al usuario; devuelve ErrLastOwner si es el unico
	// dueno del tenant (R13).
	DeactivateUser(ctx context.Context, userID string) error
}

// PostgresRoleStore implementa RoleStore sobre postgres-db.
type PostgresRoleStore struct {
	pool *pgxpool.Pool
}

// Compila-time: cumple la interfaz.
var _ RoleStore = (*PostgresRoleStore)(nil)

// NewPostgresRoleStore envuelve un pool ya conectado.
func NewPostgresRoleStore(pool *pgxpool.Pool) *PostgresRoleStore {
	return &PostgresRoleStore{pool: pool}
}

func (s *PostgresRoleStore) CreateRole(ctx context.Context, tenantID, name string, permissions []string) (*domain.Role, error) {
	role := &domain.Role{ID: uuid.NewString(), TenantID: tenantID, Name: name, Permissions: permissions}
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set app.tenant_id: %w", err)
		}
		_, err := tx.Exec(ctx, `INSERT INTO roles (id, tenant_id, name, system) VALUES ($1::uuid, $2::uuid, $3, false)`,
			role.ID, tenantID, name)
		if err != nil {
			if isRoleNameTakenViolation(err) {
				return domain.ErrRoleNameTaken
			}
			return fmt.Errorf("insert role: %w", err)
		}
		for _, p := range permissions {
			if _, err := tx.Exec(ctx, `INSERT INTO role_permissions (role_id, permission) VALUES ($1::uuid, $2)`, role.ID, p); err != nil {
				return fmt.Errorf("insert permission %s: %w", p, err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return role, nil
}

func (s *PostgresRoleStore) ListRoles(ctx context.Context, tenantID string) ([]domain.Role, error) {
	var out []domain.Role
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return err
		}
		// tenant_id vacio = solo presets (los usa el gateway antes de saber el tenant).
		rows, err := tx.Query(ctx, `
			SELECT r.id::text, r.name, r.system,
			       coalesce(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}')
			FROM roles r
			LEFT JOIN role_permissions rp ON rp.role_id = r.id
			WHERE r.tenant_id IS NULL OR ($1 <> '' AND r.tenant_id = $1::uuid)
			GROUP BY r.id, r.name, r.system, r.created_at
			ORDER BY r.system DESC, r.created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r domain.Role
			r.TenantID = tenantID
			if err := rows.Scan(&r.ID, &r.Name, &r.System, &r.Permissions); err != nil {
				return err
			}
			out = append(out, r)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	return out, nil
}

func (s *PostgresRoleStore) AssignRole(ctx context.Context, userID, roleID string) error {
	// Como plataforma: el que asigna es el dueno/admin del tenant, y el rol puede
	// ser de sistema (tenant NULL) o del tenant.
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		// Se reemplaza cualquier rol previo (un rol activo por usuario).
		if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1::uuid`, userID); err != nil {
			return fmt.Errorf("clear previous role: %w", err)
		}
		_, err := tx.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1::uuid, $2::uuid)`, userID, roleID)
		return err
	})
}

func (s *PostgresRoleStore) CreateInvitation(ctx context.Context, tenantID, email, fullName, roleID, invitedBy string) (string, time.Time, error) {
	token := uuid.NewString()
	hash := sha256.Sum256([]byte(token))
	expiresAt := time.Now().UTC().Add(InvitationTTL)

	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO invitations (id, tenant_id, email, full_name, role_id, token_hash, invited_by, expires_at)
			VALUES (gen_random_uuid(), $1::uuid, lower($2), $3, $4::uuid, $5, $6::uuid, $7)`,
			tenantID, email, fullName, roleID, hash[:], invitedBy, expiresAt)
		return err
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("create invitation: %w", err)
	}
	return token, expiresAt, nil
}

func (s *PostgresRoleStore) AcceptInvitation(ctx context.Context, token, passwordHash string) (*domain.User, *domain.Role, error) {
	hash := sha256.Sum256([]byte(token))
	var (
		user   domain.User
		role   domain.Role
		roleID string
		tenant string
	)
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// Como plataforma: el token presentado ya es la credencial.
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		var (
			invID     string
			accepted  *time.Time
			expiresAt time.Time
			email     string
			fullName  string
		)
		err := tx.QueryRow(ctx, `
			SELECT id::text, tenant_id::text, email, full_name, role_id::text, expires_at, accepted_at
			FROM invitations WHERE token_hash = $1`, hash[:]).Scan(&invID, &tenant, &email, &fullName, &roleID, &expiresAt, &accepted)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrInvitationNotFound
			}
			return fmt.Errorf("lookup invitation: %w", err)
		}
		if accepted != nil {
			return domain.ErrInvitationUsed
		}
		if expiresAt.Before(time.Now()) {
			return domain.ErrInvitationExpired
		}

		user = domain.User{
			ID: uuid.NewString(), Email: email, FullName: fullName, Role: "BUSINESS_STAFF", TenantID: tenant,
		}
		_, err = tx.Exec(ctx, `INSERT INTO users (id, email, email_normalized, password_hash, full_name, role, tenant_id, created_at, updated_at)
			VALUES ($1::uuid, $2, lower($2), $3, $4, 'BUSINESS_STAFF', $5::uuid, now(), now())`,
			user.ID, email, passwordHash, fullName, tenant)
		if err != nil {
			if isEmailTakenViolation(err) {
				return domain.ErrEmailTaken
			}
			return fmt.Errorf("insert staff: %w", err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1::uuid, $2::uuid)`, user.ID, roleID); err != nil {
			return fmt.Errorf("assign role: %w", err)
		}
		_, err = tx.Exec(ctx, `UPDATE invitations SET accepted_at = now() WHERE id = $1::uuid`, invID)
		return err
	})
	if err != nil {
		return nil, nil, err
	}

	// Rol resultante (para la respuesta).
	roles, err := s.ListRoles(ctx, tenant)
	if err != nil {
		return nil, nil, err
	}
	for i := range roles {
		if roles[i].ID == roleID {
			role = roles[i]
			break
		}
	}
	return &user, &role, nil
}

func (s *PostgresRoleStore) ListUsers(ctx context.Context, tenantID string) ([]domain.User, error) {
	var out []domain.User
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id::text, email, full_name, role, coalesce(tenant_id::text, '')
			FROM users WHERE tenant_id = $1::uuid ORDER BY created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var u domain.User
			if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.TenantID); err != nil {
				return err
			}
			out = append(out, u)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return out, nil
}

// DeactivateUser desactiva al usuario. R13: el ultimo dueno no se puede
// desactivar (se cuenta en la misma transaccion que bloquea el UPDATE).
func (s *PostgresRoleStore) DeactivateUser(ctx context.Context, userID string) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		var (
			role   string
			tenant *string
		)
		if err := tx.QueryRow(ctx, `SELECT role, tenant_id::text FROM users WHERE id = $1::uuid`, userID).Scan(&role, &tenant); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrUserNotFound
			}
			return fmt.Errorf("load user: %w", err)
		}
		if role == "BUSINESS_OWNER" && tenant != nil {
			var owners int
			if err := tx.QueryRow(ctx, `SELECT count(*) FROM users WHERE tenant_id = $1::uuid AND role = 'BUSINESS_OWNER' AND active`, *tenant).Scan(&owners); err != nil {
				return fmt.Errorf("count owners: %w", err)
			}
			if owners <= 1 {
				return domain.ErrLastOwner
			}
		}
		_, err := tx.Exec(ctx, `UPDATE users SET active = false, updated_at = now() WHERE id = $1::uuid`, userID)
		if err != nil {
			return fmt.Errorf("deactivate user: %w", err)
		}
		// Desactivar = perder acceso: se revocan sus sesiones.
		_, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at = now(), revoked_reason = 'ADMIN_ACTION'
			WHERE user_id = $1::uuid AND revoked_at IS NULL`, userID)
		return err
	})
}

// isRoleNameTakenViolation detecta 23505 sobre el indice unico (tenant, nombre).
func isRoleNameTakenViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return strings.Contains(pgErr.ConstraintName, "roles_tenant_name")
}
