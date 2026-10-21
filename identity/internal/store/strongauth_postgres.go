package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
)

// PostgresStrongAuthStore implementa StrongAuthStore sobre postgres-db (migración 0011_strong_auth).
// Cada operación fija app.user_id con el dueño de la fila (RLS, ADR 0014). El consumo entre
// servicios (ConsumeToken) y la purga corren como plataforma: el token es imposible de adivinar y
// la vinculación se compara en la misma sentencia.
type PostgresStrongAuthStore struct {
	pool *pgxpool.Pool
}

var _ StrongAuthStore = (*PostgresStrongAuthStore)(nil)

// NewPostgresStrongAuthStore envuelve un pool ya conectado.
func NewPostgresStrongAuthStore(pool *pgxpool.Pool) *PostgresStrongAuthStore {
	return &PostgresStrongAuthStore{pool: pool}
}

// asUser abre una transacción con app.user_id fijado.
func (s *PostgresStrongAuthStore) asUser(ctx context.Context, userID string, opts pgx.TxOptions, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, opts, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		return fn(tx)
	})
}

// asPlatform abre una transacción con el rol de plataforma (consumo entre servicios y purga).
func (s *PostgresStrongAuthStore) asPlatform(ctx context.Context, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return fmt.Errorf("set app.actor_role: %w", err)
		}
		return fn(tx)
	})
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (s *PostgresStrongAuthStore) CreateChallenge(ctx context.Context, c StepUpChallenge) error {
	session := c.SessionData
	if len(session) == 0 {
		session = []byte("{}")
	}
	err := s.asUser(ctx, c.UserID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO webauthn_challenges (id, user_id, purpose, challenge, session_data, operation, amount_minor, currency, expires_at)
			VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
			c.ID, nullable(c.UserID), c.Purpose, c.Challenge, string(session), nullable(c.Operation), c.AmountMinor, nullable(c.Currency), c.ExpiresAt)
		return err
	})
	if err != nil {
		return fmt.Errorf("create challenge: %w", err)
	}
	return nil
}

func (s *PostgresStrongAuthStore) GetChallenge(ctx context.Context, id, userID string, now time.Time) (*StepUpChallenge, error) {
	var c StepUpChallenge
	err := s.asUser(ctx, userID, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		var (
			uid, op, cur *string
			amount       *int64
			session      string
		)
		err := tx.QueryRow(ctx, `
			SELECT id::text, user_id::text, purpose, challenge, session_data::text, operation, amount_minor, currency, expires_at
			FROM webauthn_challenges
			WHERE id = $1::uuid AND consumed_at IS NULL AND expires_at > $2
			  AND coalesce(user_id::text, '') = $3`,
			id, now, userID).Scan(&c.ID, &uid, &c.Purpose, &c.Challenge, &session, &op, &amount, &cur, &c.ExpiresAt)
		if err != nil {
			return err
		}
		c.UserID, c.Operation, c.Currency = deref(uid), deref(op), deref(cur)
		if amount != nil {
			c.AmountMinor = *amount
		}
		c.SessionData = []byte(session)
		return nil
	})
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return nil, domain.ErrChallengeInvalid
	}
	if err != nil {
		return nil, fmt.Errorf("get challenge: %w", err)
	}
	return &c, nil
}

func (s *PostgresStrongAuthStore) ConsumeChallenge(ctx context.Context, id, userID string, now time.Time) error {
	var n int64
	err := s.asUser(ctx, userID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE webauthn_challenges SET consumed_at = $2
			WHERE id = $1::uuid AND consumed_at IS NULL AND expires_at > $2 AND coalesce(user_id::text, '') = $3`,
			id, now, userID)
		n = tag.RowsAffected()
		return err
	})
	if isInvalidUUID(err) {
		return domain.ErrChallengeInvalid
	}
	if err != nil {
		return fmt.Errorf("consume challenge: %w", err)
	}
	if n == 0 {
		return domain.ErrChallengeInvalid
	}
	return nil
}

func (s *PostgresStrongAuthStore) IssueToken(ctx context.Context, tokenHash []byte, b StepUpBinding, method string, expiresAt time.Time) error {
	err := s.asUser(ctx, b.UserID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO step_up_tokens (token_hash, user_id, operation, amount_minor, currency, method, expires_at)
			VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
			tokenHash, b.UserID, b.Operation, b.AmountMinor, b.Currency, method, expiresAt)
		return err
	})
	if err != nil {
		return fmt.Errorf("issue step-up token: %w", err)
	}
	return nil
}

// ConsumeToken aplica R32: un solo UPDATE condicionado consume el token; si no afecta filas, una
// lectura en la misma transacción explica por qué, sin consumirlo.
func (s *PostgresStrongAuthStore) ConsumeToken(ctx context.Context, tokenHash []byte, b StepUpBinding, now time.Time) (string, error) {
	reason := ""
	err := s.asPlatform(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE step_up_tokens SET consumed_at = $2
			WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
			  AND user_id::text = $3 AND operation = $4 AND amount_minor = $5 AND currency = $6`,
			tokenHash, now, b.UserID, b.Operation, b.AmountMinor, b.Currency)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 1 {
			return nil
		}
		var (
			consumedAt *time.Time
			expiresAt  time.Time
		)
		err = tx.QueryRow(ctx, `SELECT consumed_at, expires_at FROM step_up_tokens WHERE token_hash = $1`, tokenHash).
			Scan(&consumedAt, &expiresAt)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			reason = ConsumeNotFound
		case err != nil:
			return err
		case consumedAt != nil:
			reason = ConsumeAlreadyUsed
		case !now.Before(expiresAt):
			reason = ConsumeExpired
		default:
			reason = ConsumeMismatch
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("consume step-up token: %w", err)
	}
	return reason, nil
}

func (s *PostgresStrongAuthStore) GetPin(ctx context.Context, userID string) (*domain.PinState, error) {
	var p *domain.PinState
	err := s.asUser(ctx, userID, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		var st domain.PinState
		err := tx.QueryRow(ctx, `SELECT pin_hash, failed_attempts, locked_until FROM step_up_pins WHERE user_id = $1::uuid`,
			userID).Scan(&st.Hash, &st.FailedAttempts, &st.LockedUntil)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		p = &st
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("get pin: %w", err)
	}
	return p, nil
}

func (s *PostgresStrongAuthStore) SetPin(ctx context.Context, userID, hash string, now time.Time) error {
	err := s.asUser(ctx, userID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO step_up_pins (user_id, pin_hash, failed_attempts, locked_until, updated_at)
			VALUES ($1::uuid, $2, 0, NULL, $3)
			ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0,
			  locked_until = NULL, updated_at = EXCLUDED.updated_at`,
			userID, hash, now)
		return err
	})
	if err != nil {
		return fmt.Errorf("set pin: %w", err)
	}
	return nil
}

// RecordPinFailure bloquea la fila (FOR UPDATE) para que dos intentos simultáneos no se pierdan.
func (s *PostgresStrongAuthStore) RecordPinFailure(ctx context.Context, userID string, p domain.PinPolicy, now time.Time) (domain.PinState, error) {
	var next domain.PinState
	err := s.asUser(ctx, userID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		var cur domain.PinState
		err := tx.QueryRow(ctx, `SELECT pin_hash, failed_attempts, locked_until FROM step_up_pins WHERE user_id = $1::uuid FOR UPDATE`,
			userID).Scan(&cur.Hash, &cur.FailedAttempts, &cur.LockedUntil)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrPinNotSet
		}
		if err != nil {
			return err
		}
		next = cur.AfterFailure(p, now)
		_, err = tx.Exec(ctx, `UPDATE step_up_pins SET failed_attempts = $2, locked_until = $3, updated_at = $4 WHERE user_id = $1::uuid`,
			userID, next.FailedAttempts, next.LockedUntil, now)
		return err
	})
	if errors.Is(err, domain.ErrPinNotSet) {
		return domain.PinState{}, err
	}
	if err != nil {
		return domain.PinState{}, fmt.Errorf("record pin failure: %w", err)
	}
	return next, nil
}

func (s *PostgresStrongAuthStore) ResetPinFailures(ctx context.Context, userID string, now time.Time) error {
	err := s.asUser(ctx, userID, pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE step_up_pins SET failed_attempts = 0, locked_until = NULL, updated_at = $2
			WHERE user_id = $1::uuid AND (failed_attempts <> 0 OR locked_until IS NOT NULL)`, userID, now)
		return err
	})
	if err != nil {
		return fmt.Errorf("reset pin failures: %w", err)
	}
	return nil
}

func (s *PostgresStrongAuthStore) PurgeStepUp(ctx context.Context, before time.Time) (int64, error) {
	var n int64
	err := s.asPlatform(ctx, func(tx pgx.Tx) error {
		a, err := tx.Exec(ctx, `DELETE FROM webauthn_challenges WHERE expires_at < $1`, before)
		if err != nil {
			return err
		}
		b, err := tx.Exec(ctx, `DELETE FROM step_up_tokens WHERE expires_at < $1`, before)
		if err != nil {
			return err
		}
		n = a.RowsAffected() + b.RowsAffected()
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("purge step-up: %w", err)
	}
	return n, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// isInvalidUUID detecta 22P02 (texto que no es un UUID): un id de reto mal formado es un reto
// inexistente para quien lo envía, no un defecto del servidor.
func isInvalidUUID(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}
