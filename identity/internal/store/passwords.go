package store

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
)

// ResetTokenTTL es la vigencia del token de recuperacion (SPEC §4: 30 min).
const ResetTokenTTL = 30 * time.Minute

// PasswordStore es el contrato de recuperacion y cambio de contrasena (F08.7).
type PasswordStore interface {
	// CreatePasswordReset emite un token de reset (se guarda hasheado).
	CreatePasswordReset(ctx context.Context, userID string) (token string, expiresAt time.Time, err error)
	// ConsumePasswordReset canjea el token de forma atomica (un solo uso) y
	// devuelve el usuario. Detecta expirado, usado y desconocido.
	ConsumePasswordReset(ctx context.Context, token string) (userID string, err error)
	// ChangePassword aplica el hash nuevo, fija password_changed_at (R16: los
	// tokens emitidos antes dejan de validar) y revoca las sesiones. Si
	// keepSessionID no es vacio, esa sesion sobrevive (cambio voluntario).
	ChangePassword(ctx context.Context, userID, newHash, keepSessionID string) error
	// PasswordChangedAt devuelve la marca del ultimo cambio (nil si nunca).
	PasswordChangedAt(ctx context.Context, userID string) (*time.Time, error)
}

// PostgresPasswordStore implementa PasswordStore sobre postgres-db.
type PostgresPasswordStore struct {
	pool *pgxpool.Pool
}

// Compila-time: cumple la interfaz.
var _ PasswordStore = (*PostgresPasswordStore)(nil)

// NewPostgresPasswordStore envuelve un pool ya conectado.
func NewPostgresPasswordStore(pool *pgxpool.Pool) *PostgresPasswordStore {
	return &PostgresPasswordStore{pool: pool}
}

func (s *PostgresPasswordStore) CreatePasswordReset(ctx context.Context, userID string) (string, time.Time, error) {
	token := uuid.NewString()
	hash := sha256.Sum256([]byte(token))
	expiresAt := time.Now().UTC().Add(ResetTokenTTL)

	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO password_resets (id, user_id, token_hash, expires_at)
			VALUES (gen_random_uuid(), $1::uuid, $2, $3)`, userID, hash[:], expiresAt)
		return err
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("create password reset: %w", err)
	}
	return token, expiresAt, nil
}

func (s *PostgresPasswordStore) ConsumePasswordReset(ctx context.Context, token string) (string, error) {
	hash := sha256.Sum256([]byte(token))
	var userID string
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		var (
			expiresAt time.Time
			usedAt    *time.Time
		)
		err := tx.QueryRow(ctx, `SELECT user_id::text, expires_at, used_at FROM password_resets WHERE token_hash = $1`,
			hash[:]).Scan(&userID, &expiresAt, &usedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrResetTokenUnknown
			}
			return fmt.Errorf("lookup reset: %w", err)
		}
		if usedAt != nil {
			return domain.ErrResetTokenUsed
		}
		if expiresAt.Before(time.Now()) {
			return domain.ErrResetTokenExpired
		}
		_, err = tx.Exec(ctx, `UPDATE password_resets SET used_at = now() WHERE token_hash = $1`, hash[:])
		return err
	})
	if err != nil {
		return "", err
	}
	return userID, nil
}

// ChangePassword aplica el nuevo hash y revoca sesiones (R16). keepSessionID
// vacio = revocar todas (reset); con valor = esa sesion sigue viva (cambio).
func (s *PostgresPasswordStore) ChangePassword(ctx context.Context, userID, newHash, keepSessionID string) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2, password_changed_at = $3, updated_at = $3 WHERE id = $1::uuid`,
			userID, newHash, now); err != nil {
			return fmt.Errorf("update password: %w", err)
		}
		_, err := tx.Exec(ctx, `
			UPDATE sessions SET revoked_at = now(), revoked_reason = 'PASSWORD_CHANGED'
			WHERE user_id = $1::uuid AND revoked_at IS NULL AND ($2 = '' OR id::text <> $2)`,
			userID, keepSessionID)
		return err
	})
}

func (s *PostgresPasswordStore) PasswordChangedAt(ctx context.Context, userID string) (*time.Time, error) {
	var at *time.Time
	// Como plataforma: la validacion de tokens pregunta por cualquier usuario.
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `SELECT password_changed_at FROM users WHERE id = $1::uuid`, userID).Scan(&at)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("password changed at: %w", err)
	}
	return at, nil
}
