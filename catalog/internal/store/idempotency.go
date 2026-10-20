package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NoTenantID es el tenant de las claves de idempotencia de RPC sin negocio (data-standards.md §6).
const NoTenantID = "00000000-0000-0000-0000-000000000000"

// IdempotencyTTL es la retención mínima de las claves (data-standards.md §6: ≥ 72 h).
const IdempotencyTTL = 72 * time.Hour

// IdempotencyRecord es una clave ya reservada por una ejecución anterior.
type IdempotencyRecord struct {
	RequestHash []byte
	Response    []byte // google.protobuf.Any serializado; nil mientras corre
	Done        bool
}

// IdempotencyStore guarda las claves de idempotencia (grpc-conventions.md §3).
type IdempotencyStore interface {
	// Reserve intenta reservar (tenant, rpc, key) como IN_PROGRESS. Devuelve nil si la reservó
	// (hay que ejecutar), o el registro existente si la clave ya estaba.
	Reserve(ctx context.Context, tenantID, rpc, key string, requestHash []byte) (*IdempotencyRecord, error)
	// Complete marca la clave DONE con la respuesta a devolver en los reintentos.
	Complete(ctx context.Context, tenantID, rpc, key string, response []byte) error
	// Release borra una reserva cuya ejecución falló, para que el reintento vuelva a ejecutar.
	Release(ctx context.Context, tenantID, rpc, key string) error
	// Purge borra las claves anteriores a before y devuelve cuántas.
	Purge(ctx context.Context, before time.Time) (int64, error)
}

// PostgresIdempotencyStore implementa IdempotencyStore sobre postgres-db.
type PostgresIdempotencyStore struct {
	pool *pgxpool.Pool
}

var _ IdempotencyStore = (*PostgresIdempotencyStore)(nil)

// NewPostgresIdempotencyStore envuelve un pool ya conectado.
func NewPostgresIdempotencyStore(pool *pgxpool.Pool) *PostgresIdempotencyStore {
	return &PostgresIdempotencyStore{pool: pool}
}

func (s *PostgresIdempotencyStore) Reserve(ctx context.Context, tenantID, rpc, key string, requestHash []byte) (*IdempotencyRecord, error) {
	var existing *IdempotencyRecord
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set tenant: %w", err)
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO idempotency_keys (tenant_id, rpc, key, request_hash, state)
			VALUES ($1::uuid, $2, $3, $4, 'IN_PROGRESS')
			ON CONFLICT (tenant_id, rpc, key) DO NOTHING`, tenantID, rpc, key, requestHash)
		if err != nil {
			return fmt.Errorf("reserve idempotency key: %w", err)
		}
		if tag.RowsAffected() == 1 {
			return nil
		}
		var rec IdempotencyRecord
		var state string
		if err := tx.QueryRow(ctx, `
			SELECT request_hash, response, state FROM idempotency_keys
			WHERE tenant_id = $1::uuid AND rpc = $2 AND key = $3`, tenantID, rpc, key).
			Scan(&rec.RequestHash, &rec.Response, &state); err != nil {
			return fmt.Errorf("load idempotency key: %w", err)
		}
		rec.Done = state == "DONE"
		existing = &rec
		return nil
	})
	if err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *PostgresIdempotencyStore) Complete(ctx context.Context, tenantID, rpc, key string, response []byte) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set tenant: %w", err)
		}
		tag, err := tx.Exec(ctx, `
			UPDATE idempotency_keys SET state = 'DONE', response = $4
			WHERE tenant_id = $1::uuid AND rpc = $2 AND key = $3 AND state = 'IN_PROGRESS'`, tenantID, rpc, key, response)
		if err != nil {
			return fmt.Errorf("complete idempotency key: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("complete idempotency key: la reserva %s/%s no estaba en curso", rpc, key)
		}
		return nil
	})
}

func (s *PostgresIdempotencyStore) Release(ctx context.Context, tenantID, rpc, key string) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set tenant: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			DELETE FROM idempotency_keys
			WHERE tenant_id = $1::uuid AND rpc = $2 AND key = $3 AND state = 'IN_PROGRESS'`, tenantID, rpc, key); err != nil {
			return fmt.Errorf("release idempotency key: %w", err)
		}
		return nil
	})
}

func (s *PostgresIdempotencyStore) Purge(ctx context.Context, before time.Time) (int64, error) {
	var n int64
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
			return fmt.Errorf("set system role: %w", err)
		}
		tag, err := tx.Exec(ctx, `DELETE FROM idempotency_keys WHERE created_at < $1`, before)
		if err != nil {
			return fmt.Errorf("purge idempotency keys: %w", err)
		}
		n = tag.RowsAffected()
		return nil
	})
	return n, err
}

// InMemoryIdempotencyStore es la versión en memoria (pruebas y modo sin PP_DB_DSN).
type InMemoryIdempotencyStore struct {
	mu   sync.Mutex
	rows map[string]*memIdem
}

type memIdem struct {
	rec       IdempotencyRecord
	createdAt time.Time
}

var _ IdempotencyStore = (*InMemoryIdempotencyStore)(nil)

// NewInMemoryIdempotencyStore crea un store vacío.
func NewInMemoryIdempotencyStore() *InMemoryIdempotencyStore {
	return &InMemoryIdempotencyStore{rows: map[string]*memIdem{}}
}

func memKey(tenantID, rpc, key string) string { return tenantID + "\x00" + rpc + "\x00" + key }

func (s *InMemoryIdempotencyStore) Reserve(_ context.Context, tenantID, rpc, key string, requestHash []byte) (*IdempotencyRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	k := memKey(tenantID, rpc, key)
	if row, ok := s.rows[k]; ok {
		cp := row.rec
		return &cp, nil
	}
	s.rows[k] = &memIdem{rec: IdempotencyRecord{RequestHash: bytes.Clone(requestHash)}, createdAt: time.Now().UTC()}
	return nil, nil
}

func (s *InMemoryIdempotencyStore) Complete(_ context.Context, tenantID, rpc, key string, response []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	row, ok := s.rows[memKey(tenantID, rpc, key)]
	if !ok || row.rec.Done {
		return errors.New("complete idempotency key: la reserva no estaba en curso")
	}
	row.rec.Done, row.rec.Response = true, bytes.Clone(response)
	return nil
}

func (s *InMemoryIdempotencyStore) Release(_ context.Context, tenantID, rpc, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	k := memKey(tenantID, rpc, key)
	if row, ok := s.rows[k]; ok && !row.rec.Done {
		delete(s.rows, k)
	}
	return nil
}

func (s *InMemoryIdempotencyStore) Purge(_ context.Context, before time.Time) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var n int64
	for k, row := range s.rows {
		if row.createdAt.Before(before) {
			delete(s.rows, k)
			n++
		}
	}
	return n, nil
}
