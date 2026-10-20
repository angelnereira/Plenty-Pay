package store

import (
	"context"
	"crypto/sha256"
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

// InvitationTTL es la vigencia de una invitacion de staff (SPEC §4: 7 dias).
const InvitationTTL = 7 * 24 * time.Hour

// MembershipUpdate es el estado final de una membresia tras UpdateMembership (el servicio ya
// resolvio que se conserva y que cambia, y valido A1–A3).
type MembershipUpdate struct {
	TenantID  string
	UserID    string
	RoleID    string
	Scope     string
	BranchIDs []string
	JobTitle  string
	Change    string // ROLE | SCOPE | UPDATED (MembershipChanged.change)
}

// RoleStore es el contrato de roles, membresias, invitaciones y equipo (F08.6, ADR 0018).
type RoleStore interface {
	// CreateRole crea un rol del tenant con sus permisos (ya validados, R12).
	CreateRole(ctx context.Context, tenantID, name string, permissions []string) (*domain.Role, error)
	// UpsertRole crea (ID vacio) o edita un rol del tenant; cada edicion sube version y escribe RoleChanged.
	UpsertRole(ctx context.Context, r *domain.Role) (*domain.Role, error)
	// RoleByID devuelve un preset o un rol del tenant (ErrRoleNotFound si no existe o es de otro tenant).
	RoleByID(ctx context.Context, tenantID, roleID string) (*domain.Role, error)
	// ArchiveRole archiva un rol sin miembros activos (ErrRoleInUse).
	ArchiveRole(ctx context.Context, tenantID, roleID string) error
	// ListRoles devuelve los presets y los roles no archivados del tenant, con su numero de miembros.
	ListRoles(ctx context.Context, tenantID string) ([]domain.Role, error)
	// RoleForUser devuelve el rol asignado (membresia; user_roles como compatibilidad) o nil.
	RoleForUser(ctx context.Context, userID string) (*domain.Role, error)
	// MembershipForUser devuelve la membresia del usuario con sus sucursales activas (nil si no tiene).
	MembershipForUser(ctx context.Context, userID string) (*domain.Membership, error)
	// UpdateMembership guarda rol, alcance, sucursales y cargo y escribe MembershipChanged.
	UpdateMembership(ctx context.Context, u MembershipUpdate) (*domain.User, error)
	// CreateInvitation guarda la invitacion (solo el hash del token) y devuelve el token en claro.
	CreateInvitation(ctx context.Context, inv *domain.Invitation) (*domain.Invitation, string, error)
	// InvitationByToken busca una invitacion por su token (el token es la credencial).
	InvitationByToken(ctx context.Context, token string) (*domain.Invitation, error)
	// AcceptInvitation canjea el token: vincula al usuario existente (existingUserID) o crea uno
	// BUSINESS_STAFF con passwordHash, activa su membresia y marca la invitacion usada (H8).
	AcceptInvitation(ctx context.Context, token, existingUserID, passwordHash string) (*domain.User, error)
	// ListInvitations devuelve las invitaciones no aceptadas ni revocadas del tenant.
	ListInvitations(ctx context.Context, tenantID string) ([]domain.Invitation, error)
	// RevokeInvitation invalida una invitacion pendiente.
	RevokeInvitation(ctx context.Context, tenantID, invitationID string) error
	// ResendInvitation rota el token y extiende la vigencia 7 dias.
	ResendInvitation(ctx context.Context, tenantID, invitationID string) (*domain.Invitation, string, error)
	// ListUsers devuelve el equipo del tenant con rol, alcance, cargo y estado.
	ListUsers(ctx context.Context, tenantID string) ([]domain.User, error)
	// SetUserStatus cambia el estado (ACTIVE | SUSPENDED | DEACTIVATED). Fuera de ACTIVE revoca las
	// sesiones; nunca deja al tenant sin dueno activo (ErrLastOwner, R13).
	SetUserStatus(ctx context.Context, tenantID, userID, status string) error
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
	return s.UpsertRole(ctx, &domain.Role{TenantID: tenantID, Name: name, Permissions: permissions})
}

func (s *PostgresRoleStore) UpsertRole(ctx context.Context, r *domain.Role) (*domain.Role, error) {
	now := time.Now().UTC()
	out := *r
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, out.TenantID); err != nil {
			return err
		}
		change := ChangeUpdated
		if out.ID == "" {
			change = ChangeCreated
			out.ID = uuid.NewString()
			out.Version = 1
			if _, err := tx.Exec(ctx, `
				INSERT INTO roles (id, tenant_id, name, system, template_key, template_version, description, version, archived)
				VALUES ($1::uuid, $2::uuid, $3, false, $4, $5, $6, 1, false)`,
				out.ID, out.TenantID, out.Name, out.TemplateKey, max(out.TemplateVersion, 1), out.Description); err != nil {
				if isRoleNameTakenViolation(err) {
					return domain.ErrRoleNameTaken
				}
				return fmt.Errorf("insert role: %w", err)
			}
		} else {
			var system, archived bool
			err := tx.QueryRow(ctx, `SELECT system, archived FROM roles WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE`,
				out.ID, out.TenantID).Scan(&system, &archived)
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrRoleNotFound
			}
			if err != nil {
				return fmt.Errorf("load role for update: %w", err)
			}
			if system {
				return domain.ErrPresetReadOnly
			}
			if archived {
				return domain.ErrRoleNotFound
			}
			if err := tx.QueryRow(ctx, `
				UPDATE roles SET name = $3, description = $4, version = version + 1
				WHERE id = $1::uuid AND tenant_id = $2::uuid
				RETURNING version, template_key, template_version`,
				out.ID, out.TenantID, out.Name, out.Description).Scan(&out.Version, &out.TemplateKey, &out.TemplateVersion); err != nil {
				if isRoleNameTakenViolation(err) {
					return domain.ErrRoleNameTaken
				}
				return fmt.Errorf("update role: %w", err)
			}
			if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1::uuid`, out.ID); err != nil {
				return fmt.Errorf("clear role permissions: %w", err)
			}
		}
		for _, p := range out.Permissions {
			if _, err := tx.Exec(ctx, `INSERT INTO role_permissions (role_id, permission) VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING`, out.ID, p); err != nil {
				return fmt.Errorf("insert permission %s: %w", p, err)
			}
		}
		return writeRoleChangedTx(ctx, tx, out.TenantID, out.ID, out.Version, change, now)
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// roleSelect lee el rol con sus permisos y miembros activos. $1 = tenant (vacio = solo presets).
const roleSelect = `
	SELECT r.id::text, coalesce(r.tenant_id::text, ''), r.name, r.system, r.template_key, r.template_version,
	       r.description, r.version, r.archived,
	       coalesce((SELECT array_agg(rp.permission ORDER BY rp.permission) FROM role_permissions rp WHERE rp.role_id = r.id), '{}'),
	       (SELECT count(*)::int FROM memberships m
	         WHERE m.role_id = r.id AND m.status = 'ACTIVE' AND ($1 <> '' AND m.tenant_id::text = $1))
	FROM roles r `

func scanRole(row pgx.Row, r *domain.Role) error {
	return row.Scan(&r.ID, &r.TenantID, &r.Name, &r.System, &r.TemplateKey, &r.TemplateVersion,
		&r.Description, &r.Version, &r.Archived, &r.Permissions, &r.MemberCount)
}

func (s *PostgresRoleStore) RoleByID(ctx context.Context, tenantID, roleID string) (*domain.Role, error) {
	var r domain.Role
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		return scanRole(tx.QueryRow(ctx, roleSelect+`
			WHERE r.id = $2::uuid AND NOT r.archived AND (r.tenant_id IS NULL OR r.tenant_id::text = $1)`, tenantID, roleID), &r)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrRoleNotFound
		}
		return nil, fmt.Errorf("role by id: %w", err)
	}
	return &r, nil
}

func (s *PostgresRoleStore) ArchiveRole(ctx context.Context, tenantID, roleID string) error {
	now := time.Now().UTC()
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		var system, archived bool
		err := tx.QueryRow(ctx, `SELECT system, archived FROM roles WHERE id = $1::uuid AND (tenant_id IS NULL OR tenant_id = $2::uuid) FOR UPDATE`,
			roleID, tenantID).Scan(&system, &archived)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrRoleNotFound
		}
		if err != nil {
			return fmt.Errorf("load role for archive: %w", err)
		}
		if system {
			return domain.ErrPresetReadOnly
		}
		if archived {
			return nil // ya archivado: idempotente
		}
		var members int
		if err := tx.QueryRow(ctx, `
			SELECT count(*) FROM memberships
			WHERE tenant_id = $1::uuid AND role_id = $2::uuid AND status IN ('ACTIVE', 'SUSPENDED')`, tenantID, roleID).Scan(&members); err != nil {
			return fmt.Errorf("count role members: %w", err)
		}
		if members > 0 {
			return domain.ErrRoleInUse
		}
		var version int32
		if err := tx.QueryRow(ctx, `
			UPDATE roles SET archived = true, version = version + 1
			WHERE id = $1::uuid AND tenant_id = $2::uuid RETURNING version`, roleID, tenantID).Scan(&version); err != nil {
			return fmt.Errorf("archive role: %w", err)
		}
		return writeRoleChangedTx(ctx, tx, tenantID, roleID, version, ChangeArchived, now)
	})
}

func (s *PostgresRoleStore) ListRoles(ctx context.Context, tenantID string) ([]domain.Role, error) {
	var out []domain.Role
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		// tenant vacio = solo presets.
		rows, err := tx.Query(ctx, roleSelect+`
			WHERE NOT r.archived AND (r.tenant_id IS NULL OR ($1 <> '' AND r.tenant_id::text = $1))
			ORDER BY r.system DESC, r.created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r domain.Role
			if err := scanRole(rows, &r); err != nil {
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

func (s *PostgresRoleStore) RoleForUser(ctx context.Context, userID string) (*domain.Role, error) {
	var r domain.Role
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		// Fuente: la membresia (ADR 0018); user_roles queda como lectura de compatibilidad (0009).
		var roleID, tenantID string
		err := tx.QueryRow(ctx, `
			SELECT coalesce(m.role_id::text, ur.role_id::text, ''), coalesce(u.tenant_id::text, '')
			FROM users u
			LEFT JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id
			LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE u.id = $1::uuid
			LIMIT 1`, userID).Scan(&roleID, &tenantID)
		if err != nil {
			return err
		}
		if roleID == "" {
			return pgx.ErrNoRows
		}
		return scanRole(tx.QueryRow(ctx, roleSelect+` WHERE r.id = $2::uuid AND NOT r.archived`, tenantID, roleID), &r)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("role for user: %w", err)
	}
	return &r, nil
}

func (s *PostgresRoleStore) MembershipForUser(ctx context.Context, userID string) (*domain.Membership, error) {
	var m domain.Membership
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		// La membresia vigente es la del tenant del usuario (MVP: una por persona, Q-31).
		if err := tx.QueryRow(ctx, `
			SELECT m.id::text, m.user_id::text, m.tenant_id::text, m.base_role, coalesce(m.role_id::text, ''),
			       m.scope, m.job_title, m.status, m.created_at, m.updated_at
			FROM memberships m JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
			WHERE m.user_id = $1::uuid`, userID).Scan(
			&m.ID, &m.UserID, &m.TenantID, &m.BaseRole, &m.RoleID, &m.Scope, &m.JobTitle, &m.Status, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return err
		}
		ids, err := membershipBranchesTx(ctx, tx, m.ID)
		m.BranchIDs = ids
		return err
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("membership for user: %w", err)
	}
	return &m, nil
}

// membershipBranchesTx devuelve las sucursales ACTIVAS del alcance (una sucursal desactivada
// conserva el vinculo pero deja de dar acceso).
func membershipBranchesTx(ctx context.Context, tx pgx.Tx, membershipID string) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT mb.branch_id::text FROM membership_branches mb JOIN branches b ON b.id = mb.branch_id
		WHERE mb.membership_id = $1::uuid AND b.active ORDER BY b.code`, membershipID)
	if err != nil {
		return nil, fmt.Errorf("load membership branches: %w", err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan membership branch: %w", err)
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func replaceMembershipBranchesTx(ctx context.Context, tx pgx.Tx, membershipID, scope string, branchIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM membership_branches WHERE membership_id = $1::uuid`, membershipID); err != nil {
		return fmt.Errorf("clear membership branches: %w", err)
	}
	if scope != domain.ScopeBranches {
		return nil
	}
	for _, bid := range branchIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO membership_branches (membership_id, branch_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
			membershipID, bid); err != nil {
			return fmt.Errorf("insert membership branch: %w", err)
		}
	}
	return nil
}

// syncUserRoleTx mantiene user_roles (lectura obsoleta, 0009) igual al rol de la membresia.
func syncUserRoleTx(ctx context.Context, tx pgx.Tx, userID, roleID string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1::uuid`, userID); err != nil {
		return fmt.Errorf("clear user_roles: %w", err)
	}
	if roleID == "" {
		return nil
	}
	if _, err := tx.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1::uuid, $2::uuid)`, userID, roleID); err != nil {
		return fmt.Errorf("insert user_roles: %w", err)
	}
	return nil
}

func (s *PostgresRoleStore) UpdateMembership(ctx context.Context, u MembershipUpdate) (*domain.User, error) {
	now := time.Now().UTC()
	var out domain.User
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, u.TenantID); err != nil {
			return err
		}
		var memID string
		err := tx.QueryRow(ctx, `
			UPDATE memberships SET role_id = NULLIF($3, '')::uuid, scope = $4, job_title = $5, updated_at = $6
			WHERE user_id = $1::uuid AND tenant_id = $2::uuid AND base_role = 'BUSINESS_STAFF'
			RETURNING id::text`,
			u.UserID, u.TenantID, u.RoleID, u.Scope, u.JobTitle, now).Scan(&memID)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrUserNotFound
		}
		if err != nil {
			return fmt.Errorf("update membership: %w", err)
		}
		if err := replaceMembershipBranchesTx(ctx, tx, memID, u.Scope, u.BranchIDs); err != nil {
			return err
		}
		if err := setPlatform(ctx, tx); err != nil { // user_roles exige plataforma en su WITH CHECK
			return err
		}
		if err := syncUserRoleTx(ctx, tx, u.UserID, u.RoleID); err != nil {
			return err
		}
		users, err := listUsersTx(ctx, tx, u.TenantID, u.UserID)
		if err != nil {
			return err
		}
		if len(users) == 1 {
			out = users[0]
		}
		return writeMembershipChangedTx(ctx, tx, u.TenantID, u.UserID, u.Change, now)
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *PostgresRoleStore) CreateInvitation(ctx context.Context, inv *domain.Invitation) (*domain.Invitation, string, error) {
	out := *inv
	out.ID = uuid.NewString()
	token := uuid.NewString()
	hash := sha256.Sum256([]byte(token))
	now := time.Now().UTC()
	out.CreatedAt, out.ExpiresAt = now, now.Add(InvitationTTL)
	if out.Scope == "" {
		out.Scope = domain.ScopeTenant
	}
	if out.BranchIDs == nil {
		out.BranchIDs = []string{}
	}
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, out.TenantID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO invitations (id, tenant_id, email, full_name, role_id, token_hash, invited_by, expires_at, scope, branch_ids, job_title, created_at)
			VALUES ($1::uuid, $2::uuid, lower($3), $4, $5::uuid, $6, $7::uuid, $8, $9, $10, $11, $12)`,
			out.ID, out.TenantID, out.Email, out.FullName, out.RoleID, hash[:], out.InvitedBy, out.ExpiresAt,
			out.Scope, out.BranchIDs, out.JobTitle, now); err != nil {
			return fmt.Errorf("insert invitation: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, "", fmt.Errorf("create invitation: %w", err)
	}
	out.Email = strings.ToLower(out.Email)
	return &out, token, nil
}

const invitationSelect = `
	SELECT i.id::text, i.tenant_id::text, i.email, i.full_name, i.role_id::text, coalesce(r.name, ''), i.invited_by::text,
	       i.scope, i.branch_ids, i.job_title, i.expires_at, i.accepted_at, i.revoked_at, i.created_at
	FROM invitations i LEFT JOIN roles r ON r.id = i.role_id `

func scanInvitation(row pgx.Row, inv *domain.Invitation) error {
	return row.Scan(&inv.ID, &inv.TenantID, &inv.Email, &inv.FullName, &inv.RoleID, &inv.RoleName, &inv.InvitedBy,
		&inv.Scope, &inv.BranchIDs, &inv.JobTitle, &inv.ExpiresAt, &inv.AcceptedAt, &inv.RevokedAt, &inv.CreatedAt)
}

func (s *PostgresRoleStore) InvitationByToken(ctx context.Context, token string) (*domain.Invitation, error) {
	hash := sha256.Sum256([]byte(token))
	var inv domain.Invitation
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil { // el token presentado es la credencial
			return err
		}
		return scanInvitation(tx.QueryRow(ctx, invitationSelect+` WHERE i.token_hash = $1`, hash[:]), &inv)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("invitation by token: %w", err)
	}
	return &inv, nil
}

func (s *PostgresRoleStore) AcceptInvitation(ctx context.Context, token, existingUserID, passwordHash string) (*domain.User, error) {
	hash := sha256.Sum256([]byte(token))
	now := time.Now().UTC()
	var user domain.User
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setPlatform(ctx, tx); err != nil {
			return err
		}
		var inv domain.Invitation
		if err := scanInvitation(tx.QueryRow(ctx, invitationSelect+` WHERE i.token_hash = $1 FOR UPDATE OF i`, hash[:]), &inv); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrInvitationNotFound
			}
			return fmt.Errorf("lock invitation: %w", err)
		}
		if err := inv.Acceptable(now); err != nil {
			return err
		}

		if existingUserID != "" {
			// H8: la persona ya tiene cuenta (cliente con billetera): conserva su cuenta y su clave.
			tag, err := tx.Exec(ctx, `
				UPDATE users SET role = 'BUSINESS_STAFF', tenant_id = $2::uuid, updated_at = $3
				WHERE id = $1::uuid AND tenant_id IS NULL AND role = 'CUSTOMER'`, existingUserID, inv.TenantID, now)
			if err != nil {
				return fmt.Errorf("link existing user as staff: %w", err)
			}
			if tag.RowsAffected() == 0 {
				return domain.ErrTenantAlreadyExists // ya pertenece a un negocio (MVP: una membresia, Q-31)
			}
			user.ID = existingUserID
		} else {
			user.ID = uuid.NewString()
			if _, err := tx.Exec(ctx, `
				INSERT INTO users (id, email, email_normalized, password_hash, full_name, role, tenant_id, active, status, created_at, updated_at)
				VALUES ($1::uuid, $2, lower($2), $3, $4, 'BUSINESS_STAFF', $5::uuid, true, 'ACTIVE', $6, $6)`,
				user.ID, inv.Email, passwordHash, inv.FullName, inv.TenantID, now); err != nil {
				if isEmailTakenViolation(err) {
					return domain.ErrEmailTaken
				}
				return fmt.Errorf("insert staff: %w", err)
			}
		}

		var memID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO memberships (id, user_id, tenant_id, base_role, role_id, scope, job_title, status, created_at, updated_at)
			VALUES ($1::uuid, $2::uuid, $3::uuid, 'BUSINESS_STAFF', $4::uuid, $5, $6, 'ACTIVE', $7, $7)
			RETURNING id::text`,
			uuid.NewString(), user.ID, inv.TenantID, inv.RoleID, inv.Scope, inv.JobTitle, now).Scan(&memID); err != nil {
			return fmt.Errorf("insert staff membership: %w", err)
		}
		if err := replaceMembershipBranchesTx(ctx, tx, memID, inv.Scope, inv.BranchIDs); err != nil {
			return err
		}
		if err := syncUserRoleTx(ctx, tx, user.ID, inv.RoleID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE invitations SET accepted_at = $2 WHERE id = $1::uuid`, inv.ID, now); err != nil {
			return fmt.Errorf("mark invitation accepted: %w", err)
		}
		users, err := listUsersTx(ctx, tx, inv.TenantID, user.ID)
		if err != nil {
			return err
		}
		if len(users) == 1 {
			user = users[0]
		}
		return writeMembershipChangedTx(ctx, tx, inv.TenantID, user.ID, ChangeAccepted, now)
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *PostgresRoleStore) ListInvitations(ctx context.Context, tenantID string) ([]domain.Invitation, error) {
	var out []domain.Invitation
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, invitationSelect+`
			WHERE i.tenant_id = $1::uuid AND i.accepted_at IS NULL AND i.revoked_at IS NULL
			ORDER BY i.created_at DESC`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var inv domain.Invitation
			if err := scanInvitation(rows, &inv); err != nil {
				return err
			}
			out = append(out, inv)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}
	return out, nil
}

func (s *PostgresRoleStore) RevokeInvitation(ctx context.Context, tenantID, invitationID string) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `
			UPDATE invitations SET revoked_at = now()
			WHERE id = $1::uuid AND tenant_id = $2::uuid AND accepted_at IS NULL AND revoked_at IS NULL`,
			invitationID, tenantID)
		if err != nil {
			return fmt.Errorf("revoke invitation: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return domain.ErrInvitationNotFound
		}
		return nil
	})
}

func (s *PostgresRoleStore) ResendInvitation(ctx context.Context, tenantID, invitationID string) (*domain.Invitation, string, error) {
	token := uuid.NewString()
	hash := sha256.Sum256([]byte(token))
	expiresAt := time.Now().UTC().Add(InvitationTTL)
	var inv domain.Invitation
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `
			UPDATE invitations SET token_hash = $3, expires_at = $4
			WHERE id = $1::uuid AND tenant_id = $2::uuid AND accepted_at IS NULL AND revoked_at IS NULL`,
			invitationID, tenantID, hash[:], expiresAt)
		if err != nil {
			return fmt.Errorf("rotate invitation token: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return domain.ErrInvitationNotFound
		}
		return scanInvitation(tx.QueryRow(ctx, invitationSelect+` WHERE i.id = $1::uuid`, invitationID), &inv)
	})
	if err != nil {
		return nil, "", err
	}
	return &inv, token, nil
}

func (s *PostgresRoleStore) ListUsers(ctx context.Context, tenantID string) ([]domain.User, error) {
	var out []domain.User
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		var err error
		out, err = listUsersTx(ctx, tx, tenantID, "")
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return out, nil
}

// listUsersTx lee el equipo del tenant (onlyUserID vacio = todos) con su membresia.
func listUsersTx(ctx context.Context, tx pgx.Tx, tenantID, onlyUserID string) ([]domain.User, error) {
	rows, err := tx.Query(ctx, `
		SELECT u.id::text, u.email, u.full_name, u.role, u.tenant_id::text,
		       coalesce(m.status, u.status), coalesce(m.role_id::text, ''), coalesce(r.name, ''),
		       coalesce(m.scope, 'TENANT'), coalesce(m.job_title, ''),
		       coalesce((SELECT array_agg(mb.branch_id::text ORDER BY mb.branch_id) FROM membership_branches mb WHERE mb.membership_id = m.id), '{}'),
		       (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id)
		FROM users u
		LEFT JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id
		LEFT JOIN roles r ON r.id = m.role_id
		WHERE u.tenant_id = $1::uuid AND ($2 = '' OR u.id::text = $2)
		ORDER BY u.created_at`, tenantID, onlyUserID)
	if err != nil {
		return nil, fmt.Errorf("query team: %w", err)
	}
	defer rows.Close()
	var out []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.TenantID, &u.Status, &u.RoleID, &u.RoleName,
			&u.Scope, &u.JobTitle, &u.BranchIDs, &u.LastLoginAt); err != nil {
			return nil, fmt.Errorf("scan team member: %w", err)
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *PostgresRoleStore) SetUserStatus(ctx context.Context, tenantID, userID, status string) error {
	now := time.Now().UTC()
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := setTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		var role, previous string
		err := tx.QueryRow(ctx, `SELECT role, status FROM users WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE`,
			userID, tenantID).Scan(&role, &previous)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrUserNotFound
		}
		if err != nil {
			return fmt.Errorf("load user: %w", err)
		}
		if previous == status {
			return nil // sin cambio: idempotente
		}
		if status != domain.UserStatusActive && role == "BUSINESS_OWNER" {
			var owners int
			if err := tx.QueryRow(ctx, `
				SELECT count(*) FROM users WHERE tenant_id = $1::uuid AND role = 'BUSINESS_OWNER' AND status = 'ACTIVE'`,
				tenantID).Scan(&owners); err != nil {
				return fmt.Errorf("count owners: %w", err)
			}
			if owners <= 1 {
				return domain.ErrLastOwner
			}
		}
		active := status == domain.UserStatusActive
		if _, err := tx.Exec(ctx, `UPDATE users SET active = $2, status = $3, updated_at = $4 WHERE id = $1::uuid`,
			userID, active, status, now); err != nil {
			return fmt.Errorf("update user status: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE memberships SET status = $3, updated_at = $4 WHERE user_id = $1::uuid AND tenant_id = $2::uuid`,
			userID, tenantID, status, now); err != nil {
			return fmt.Errorf("update membership status: %w", err)
		}
		if err := setPlatform(ctx, tx); err != nil { // sesiones y outbox son de plataforma
			return err
		}
		var revoked []string
		if !active {
			rows, err := tx.Query(ctx, `
				UPDATE sessions SET revoked_at = $2, revoked_reason = 'ADMIN_ACTION'
				WHERE user_id = $1::uuid AND revoked_at IS NULL RETURNING id::text`, userID, now)
			if err != nil {
				return fmt.Errorf("revoke sessions: %w", err)
			}
			for rows.Next() {
				var id string
				if err := rows.Scan(&id); err != nil {
					rows.Close()
					return fmt.Errorf("scan revoked session: %w", err)
				}
				revoked = append(revoked, id)
			}
			rows.Close()
			if err := rows.Err(); err != nil {
				return fmt.Errorf("revoke sessions: %w", err)
			}
		}
		change := map[string]string{
			domain.UserStatusActive: ChangeReactivated, domain.UserStatusSuspended: ChangeSuspended,
			domain.UserStatusDeactivated: ChangeDeactivated,
		}[status]
		if err := writeMembershipChangedTx(ctx, tx, tenantID, userID, change, now); err != nil {
			return err
		}
		if len(revoked) == 0 {
			return nil
		}
		// El gateway cierra los sockets abiertos al recibir SessionRevoked (F09.5).
		payload, err := json.Marshal(map[string]any{"user_id": userID, "session_ids": revoked, "reason": domain.RevokedReasonAdmin})
		if err != nil {
			return fmt.Errorf("marshal session revoked: %w", err)
		}
		return writeOutboxTx(ctx, tx, OutboxEvent{
			ID: uuid.NewString(), EventType: EventSessionRevoked, AggregateID: userID, TenantID: tenantID, Payload: payload, CreatedAt: now,
		})
	})
}

func writeRoleChangedTx(ctx context.Context, tx pgx.Tx, tenantID, roleID string, version int32, change string, now time.Time) error {
	payload, err := json.Marshal(map[string]any{"tenant_id": tenantID, "role_id": roleID, "version": version, "change": change})
	if err != nil {
		return fmt.Errorf("marshal role changed: %w", err)
	}
	return writeOutboxTx(ctx, tx, OutboxEvent{
		ID: uuid.NewString(), EventType: EventRoleChanged, AggregateID: roleID, TenantID: tenantID, Payload: payload, CreatedAt: now,
	})
}

func writeMembershipChangedTx(ctx context.Context, tx pgx.Tx, tenantID, userID, change string, now time.Time) error {
	payload, err := json.Marshal(map[string]any{"tenant_id": tenantID, "user_id": userID, "change": change})
	if err != nil {
		return fmt.Errorf("marshal membership changed: %w", err)
	}
	return writeOutboxTx(ctx, tx, OutboxEvent{
		ID: uuid.NewString(), EventType: EventMembershipChanged, AggregateID: userID, TenantID: tenantID, Payload: payload, CreatedAt: now,
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
