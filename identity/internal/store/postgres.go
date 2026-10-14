package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/tenancy"
)

// PostgresUserStore implementa UserStore sobre postgres-db con pgx v5
// (go-standards.md seccion 3.5). Cada operacion abre una transaccion y ejecuta
// SET LOCAL con el tenant/actor (seccion 3.6): RLS es la segunda barrera
// (ADR 0014), la primera es el propio contenedor.
//
// Decisiones de diseno (F08.2):
//   - El registro publico (R6) crea clientes sin tenant: los settings de la
//     transaccion se toman del propio usuario que se esta creando.
//   - FindByEmail (login, R4) usa la funcion SECURITY DEFINER find_user_by_email:
//     en el login aun no se conoce tenant ni usuario, y no se puede "adivinar"
//     el contexto antes de autenticar. Es la unica via de busqueda por correo.
//   - FindByID consulta como el propio usuario (app.user_id = id buscado), que
//     es el caso real de ValidateToken/GetUserPermissions. Las consultas de
//     plataforma sobre otros tenants llegaran con sus settings desde el
//     servidor (F08.5+).
type PostgresUserStore struct {
	pool *pgxpool.Pool
}

// Compila-time: PostgresUserStore cumple la interfaz del servidor.
var _ UserStore = (*PostgresUserStore)(nil)

// NewPostgresUserStore conecta el pool (no migra: eso es del Job migrate-identity).
func NewPostgresUserStore(ctx context.Context, dsn string) (*PostgresUserStore, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse db dsn: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	// PgBouncer en modo transaccion no admite prepared statements entre
	// transacciones: se ejecuta sin ellas (protocolo simple por query).
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &PostgresUserStore{pool: pool}, nil
}

// Close libera el pool (llamado en el apagado ordenado).
func (s *PostgresUserStore) Close() { s.pool.Close() }

// Pool comparte el pool con el store de sesiones (misma base, un solo pool).
func (s *PostgresUserStore) Pool() *pgxpool.Pool { return s.pool }

// tenancySettings respeta los valores ya presentes en el contexto y completa
// con los del usuario sobre el que se opera (fail-closed si no hay nada).
func tenancySettings(ctx context.Context, userID, tenantID string) (string, string, string) {
	if u := tenancy.UserIDFromContext(ctx); u != "" {
		userID = u
	}
	if t := tenancy.TenantIDFromContext(ctx); t != "" {
		tenantID = t
	}
	return userID, tenantID, tenancy.ActorRoleFromContext(ctx)
}

// Create inserta usuario y consentimientos en una transaccion (R18: sin los
// consentimientos obligatorios no se crea la cuenta; eso lo valida el servidor,
// aqui solo se persiste lo recibido).
func (s *PostgresUserStore) Create(ctx context.Context, u *User) error {
	if u == nil {
		return errors.New("usuario nil")
	}
	if u.Email == "" || u.PasswordHash == "" {
		return errors.New("usuario sin correo o sin hash de contrasena")
	}
	if u.ID == "" {
		return errors.New("usuario sin id")
	}
	now := time.Now().UTC()

	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		userID, tenantID, actorRole := tenancySettings(ctx, u.ID, u.TenantID)
		if err := applyRLS(ctx, tx, userID, tenantID, actorRole); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `
		INSERT INTO users (id, email, email_normalized, password_hash, full_name, role, tenant_id, created_at, updated_at)
		VALUES ($1, $2, lower($2), $3, $4, $5, NULLIF($6, '')::uuid, $7, $7)`,
			u.ID, u.Email, u.PasswordHash, u.FullName, u.Role, u.TenantID, now)
		if err != nil {
			if isEmailTakenViolation(err) {
				return ErrEmailTaken
			}
			return fmt.Errorf("insert user: %w", err)
		}

		for _, c := range u.Consents {
			_, err = tx.Exec(ctx, `
			INSERT INTO consents (user_id, purpose, text_version, granted, channel, device, recorded_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				u.ID, c.Purpose, c.TextVersion, c.Granted, c.Channel, c.Device, c.RecordedAt.UTC())
			if err != nil {
				return fmt.Errorf("insert consent %s: %w", c.Purpose, err)
			}
		}
		return nil
	})
}

// FindByEmail localiza al usuario para autenticarlo (R4).
func (s *PostgresUserStore) FindByEmail(ctx context.Context, email string) (*User, error) {
	normalized := strings.ToLower(strings.TrimSpace(email))
	if normalized == "" {
		return nil, ErrUserNotFound
	}
	var u User
	var tenantID *string
	var createdAt, updatedAt time.Time

	err := s.pool.QueryRow(ctx, `SELECT * FROM find_user_by_email($1)`, normalized).
		Scan(&u.ID, &u.Email, &normalized, &u.PasswordHash, &u.FullName, &u.Role, &tenantID, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by email: %w", err)
	}
	if tenantID != nil {
		u.TenantID = *tenantID
	}
	return &u, nil
}

// FindByID consulta como el propio usuario (app.user_id = id) dentro de una
// transaccion: SET LOCAL solo existe dentro de un bloque transaccional.
func (s *PostgresUserStore) FindByID(ctx context.Context, id string) (*User, error) {
	if id == "" {
		return nil, ErrUserNotFound
	}
	var u *User

	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		userID, tenantID, actorRole := tenancySettings(ctx, id, "")
		if err := applyRLS(ctx, tx, userID, tenantID, actorRole); err != nil {
			return err
		}

		var (
			candidate              User
			candidateTenant        *string
			createdAt, updatedAt   time.Time
			emailNormalizedDiscard string
		)
		err := tx.QueryRow(ctx, `SELECT id, email, email_normalized, password_hash, full_name, role, tenant_id, created_at, updated_at
			FROM users WHERE id = $1::uuid`, id).
			Scan(&candidate.ID, &candidate.Email, &emailNormalizedDiscard, &candidate.PasswordHash,
				&candidate.FullName, &candidate.Role, &candidateTenant, &createdAt, &updatedAt)
		if err != nil {
			return err
		}
		if candidateTenant != nil {
			candidate.TenantID = *candidateTenant
		}
		u = &candidate

		consents, err := loadConsentsTx(ctx, tx, id)
		if err != nil {
			return err
		}
		u.Consents = consents
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by id: %w", err)
	}
	return u, nil
}

// loadConsentsTx lee los consentimientos dentro de la transaccion de lectura
// (con el mismo SET LOCAL aplicado, RLS filtra por app.user_id).
func loadConsentsTx(ctx context.Context, tx pgx.Tx, userID string) ([]ConsentRecord, error) {
	rows, err := tx.Query(ctx, `SELECT purpose, text_version, granted, channel, device, recorded_at
		FROM consents WHERE user_id = $1::uuid ORDER BY id`, userID)
	if err != nil {
		return nil, fmt.Errorf("query consents: %w", err)
	}
	defer rows.Close()

	var out []ConsentRecord
	for rows.Next() {
		var c ConsentRecord
		if err := rows.Scan(&c.Purpose, &c.TextVersion, &c.Granted, &c.Channel, &c.Device, &c.RecordedAt); err != nil {
			return nil, fmt.Errorf("scan consent: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// applyRLS fija el tenant/actor de la transaccion (go-standards.md seccion 3.6).
func applyRLS(ctx context.Context, tx pgx.Tx, userID, tenantID, actorRole string) error {
	for _, kv := range [][2]string{
		{"app.user_id", userID},
		{"app.tenant_id", tenantID},
		{"app.actor_role", actorRole},
	} {
		if _, err := tx.Exec(ctx, `SELECT set_config($1, $2, true)`, kv[0], kv[1]); err != nil {
			return fmt.Errorf("set %s: %w", kv[0], err)
		}
	}
	return nil
}

// isEmailTakenViolation detecta 23505 sobre el indice unico del correo
// (R3 -> EMAIL_TAKEN). Otros unique (la PK) devuelven error envuelto: no son
// "correo tomado".
func isEmailTakenViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return strings.Contains(pgErr.ConstraintName, "email_normalized")
}
