package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// LoginAttemptStore es el contrato de bloqueo progresivo que usa el servicio (R5).
type LoginAttemptStore interface {
	// RegisterFailure suma un fallo consecutivo y devuelve el total y el bloqueo
	// vigente (nil si no aplica). Con block=0 solo cuenta. Es una sola sentencia
	// (upsert): dos logins concurrentes no pierden ningun fallo.
	RegisterFailure(ctx context.Context, userID string, block time.Duration) (failures int, blockedUntil *time.Time, err error)
	// ResetFailures reinicia la cuenta tras un login exitoso (R5).
	ResetFailures(ctx context.Context, userID string) error
	// CurrentFailures devuelve los fallos consecutivos actuales (0 si no hay).
	CurrentFailures(ctx context.Context, userID string) (int, error)
	// BlockedUntil devuelve el bloqueo vigente de la cuenta (nil si no tiene o
	// si ya vencio).
	BlockedUntil(ctx context.Context, userID string) (*time.Time, error)
}

// PostgresLoginAttemptStore implementa LoginAttemptStore sobre postgres-db.
type PostgresLoginAttemptStore struct {
	pool *pgxpool.Pool
}

// Compila-time: cumple la interfaz.
var _ LoginAttemptStore = (*PostgresLoginAttemptStore)(nil)

// NewPostgresLoginAttemptStore envuelve un pool ya conectado.
func NewPostgresLoginAttemptStore(pool *pgxpool.Pool) *PostgresLoginAttemptStore {
	return &PostgresLoginAttemptStore{pool: pool}
}

func (s *PostgresLoginAttemptStore) RegisterFailure(ctx context.Context, userID string, block time.Duration) (int, *time.Time, error) {
	var (
		failures int
		until    *time.Time
	)
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// La cuenta es la propia: RLS valida con app.user_id.
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		if block > 0 {
			// El bloqueo se mide desde ahora (o desde el bloqueo previo si sigue
			// vigente): un ataque no reinicia el plazo acumulado.
			return tx.QueryRow(ctx, `
				INSERT INTO login_attempts (user_id, consecutive_failures, last_failure_at, blocked_until)
				VALUES ($1::uuid, 1, now(), now() + $2::interval)
				ON CONFLICT (user_id) DO UPDATE SET
					consecutive_failures = login_attempts.consecutive_failures + 1,
					last_failure_at = now(),
					blocked_until = greatest(now(), coalesce(login_attempts.blocked_until, now())) + $2::interval
				RETURNING consecutive_failures, blocked_until`, userID, block.String()).Scan(&failures, &until)
		}
		return tx.QueryRow(ctx, `
			INSERT INTO login_attempts (user_id, consecutive_failures, last_failure_at)
			VALUES ($1::uuid, 1, now())
			ON CONFLICT (user_id) DO UPDATE SET
				consecutive_failures = login_attempts.consecutive_failures + 1,
				last_failure_at = now()
			RETURNING consecutive_failures, blocked_until`, userID).Scan(&failures, &until)
	})
	if err != nil {
		return 0, nil, fmt.Errorf("register failure: %w", err)
	}
	return failures, until, nil
}

func (s *PostgresLoginAttemptStore) ResetFailures(ctx context.Context, userID string) error {
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
			return fmt.Errorf("set app.user_id: %w", err)
		}
		_, err := tx.Exec(ctx, `DELETE FROM login_attempts WHERE user_id = $1::uuid`, userID)
		return err
	})
	if err != nil {
		return fmt.Errorf("reset failures: %w", err)
	}
	return nil
}

func (s *PostgresLoginAttemptStore) CurrentFailures(ctx context.Context, userID string) (int, error) {
	var failures int
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT consecutive_failures FROM login_attempts WHERE user_id = $1::uuid`, userID).Scan(&failures)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("current failures: %w", err)
	}
	return failures, nil
}

func (s *PostgresLoginAttemptStore) BlockedUntil(ctx context.Context, userID string) (*time.Time, error) {
	var until *time.Time
	// La consulta previa al login aun no tiene app.user_id: se hace como
	// plataforma (mismo patron que SessionByID). El bloqueo no revela nada que
	// quien llama no pudiera provocar.
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT blocked_until FROM login_attempts WHERE user_id = $1::uuid`, userID).Scan(&until)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("blocked until: %w", err)
	}
	if until != nil && !until.After(time.Now()) {
		return nil, nil // el bloqueo ya vencio
	}
	return until, nil
}
