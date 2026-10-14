package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
)

// SessionStore es el contrato de sesiones que usa el servicio (R7-R9).
type SessionStore interface {
	// CreateSession abre una sesion para el usuario (login/registro).
	CreateSession(ctx context.Context, userID string) (*domain.Session, error)
	// IssueRefreshToken registra el hash de un refresh recien emitido. Recibe el
	// userID para fijar app.user_id sin depender de leer la sesion (RLS).
	IssueRefreshToken(ctx context.Context, sessionID, userID string, tokenHash []byte, expiresAt time.Time) error
	// ConsumeRefreshToken marca el refresh como usado (rotacion, R8). Devuelve
	// reused=true si el token ya habia sido usado: el llamante debe revocar la
	// familia. La actualizacion es atomica: en una carrera solo gana una.
	ConsumeRefreshToken(ctx context.Context, tokenHash []byte) (sessionID string, reused bool, err error)
	// RevokeSession revoca la sesion y, con ella, toda su familia de tokens.
	RevokeSession(ctx context.Context, sessionID, reason string) error
	// SessionByID consulta la sesion (R9: valida si esta revocada).
	SessionByID(ctx context.Context, sessionID string) (*domain.Session, error)
	// WriteOutboxEvent escribe el evento en la misma unidad que el efecto
	// (ADR 0012); el relay lo publica despues.
	WriteOutboxEvent(ctx context.Context, eventType, aggregateID, tenantID string, payload []byte) error
}

// PostgresSessionStore implementa SessionStore sobre postgres-db.
type PostgresSessionStore struct {
	pool *pgxpool.Pool
}

// Compila-time: cumple la interfaz.
var _ SessionStore = (*PostgresSessionStore)(nil)

// NewPostgresSessionStore envuelve un pool ya conectado.
func NewPostgresSessionStore(pool *pgxpool.Pool) *PostgresSessionStore {
	return &PostgresSessionStore{pool: pool}
}

func (s *PostgresSessionStore) CreateSession(ctx context.Context, userID string) (*domain.Session, error) {
	session := &domain.Session{ID: uuid.NewString(), UserID: userID, CreatedAt: time.Now().UTC()}
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// El usuario es el propio: RLS valida con app.user_id.
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		_, err := tx.Exec(ctx, `INSERT INTO sessions (id, user_id, created_at) VALUES ($1::uuid, $2::uuid, $3)`,
			session.ID, session.UserID, session.CreatedAt)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return session, nil
}

func (s *PostgresSessionStore) IssueRefreshToken(ctx context.Context, sessionID, userID string, tokenHash []byte, expiresAt time.Time) error {
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		_, err := tx.Exec(ctx, `INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at)
			VALUES (gen_random_uuid(), $1::uuid, $2, $3)`, sessionID, tokenHash, expiresAt)
		return err
	})
	if err != nil {
		return fmt.Errorf("issue refresh token: %w", err)
	}
	return nil
}

func (s *PostgresSessionStore) ConsumeRefreshToken(ctx context.Context, tokenHash []byte) (string, bool, error) {
	var sessionID string
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// El refresh token presentado ya es la credencial (quien lo tiene se
		// autentica): el consumo es operacion de plataforma sobre refresh_tokens,
		// igual que SessionByID y RevokeSession.
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return fmt.Errorf("set actor role: %w", err)
		}
		// Consumo atomico: solo gana la primera llamada (used_at IS NULL).
		err := tx.QueryRow(ctx, `
			UPDATE refresh_tokens SET used_at = now()
			WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
			RETURNING session_id::text`, tokenHash).Scan(&sessionID)
		if err == nil {
			return nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("consume refresh token: %w", err)
		}

		// No se pudo consumir: determinar si es reuso (token ya usado).
		var usedAt *time.Time
		err = tx.QueryRow(ctx, `SELECT used_at FROM refresh_tokens WHERE token_hash = $1`, tokenHash).Scan(&usedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrRefreshTokenUnknown
			}
			return fmt.Errorf("lookup refresh token: %w", err)
		}
		if usedAt == nil {
			// Existe, no estaba usado, pero expiro entre medias.
			return fmt.Errorf("refresh token expirado")
		}
		// Reuso detectado (R8): el llamador revoca la familia.
		if err := tx.QueryRow(ctx, `SELECT session_id::text FROM refresh_tokens WHERE token_hash = $1`, tokenHash).Scan(&sessionID); err != nil {
			return fmt.Errorf("lookup session for reuse: %w", err)
		}
		return domain.ErrRefreshTokenReuse
	})
	if err != nil {
		if errors.Is(err, domain.ErrRefreshTokenReuse) {
			return sessionID, true, nil
		}
		return "", false, err
	}
	return sessionID, false, nil
}

func (s *PostgresSessionStore) RevokeSession(ctx context.Context, sessionID, reason string) error {
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return fmt.Errorf("set actor role: %w", err)
		}
		_, err := tx.Exec(ctx, `UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE id = $1::uuid AND revoked_at IS NULL`, sessionID, reason)
		return err
	})
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (s *PostgresSessionStore) SessionByID(ctx context.Context, sessionID string) (*domain.Session, error) {
	var (
		sess          domain.Session
		revokedAt     *time.Time
		revokedReason *string
	)
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		// Consulta como plataforma: R9 valida cualquier sesion (el token ya
		// demostro identidad; aqui solo se pregunta por su estado).
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT id::text, user_id::text, created_at, revoked_at, revoked_reason
			FROM sessions WHERE id = $1::uuid`, sessionID).
			Scan(&sess.ID, &sess.UserID, &sess.CreatedAt, &revokedAt, &revokedReason)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("session by id: %w", err)
	}
	sess.RevokedAt = revokedAt
	if revokedReason != nil {
		sess.RevokedReason = *revokedReason
	}
	return &sess, nil
}

func (s *PostgresSessionStore) WriteOutboxEvent(ctx context.Context, eventType, aggregateID, tenantID string, payload []byte) error {
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO outbox (id, event_type, aggregate_id, tenant_id, payload)
			VALUES (gen_random_uuid(), $1, $2::uuid, NULLIF($3, '')::uuid, $4)`,
			eventType, aggregateID, tenantID, payload)
		return err
	})
	if err != nil {
		return fmt.Errorf("write outbox event: %w", err)
	}
	return nil
}
