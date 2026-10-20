// Package store implementa la persistencia de inventory sobre postgres-db con pgx v5.
// Un movimiento, la existencia que cambia y sus eventos se escriben en UNA transacción (ADR 0012);
// la clave de idempotencia vive en la misma fila del movimiento, así que un reintento nunca
// mueve stock dos veces.
package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/inventory/internal/domain"
)

// Store es el repositorio de inventory.
type Store struct {
	pool *pgxpool.Pool
}

// Open conecta el pool (PgBouncer en modo transacción: protocolo simple).
func Open(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

// Close cierra el pool.
func (s *Store) Close() { s.pool.Close() }

// Pool expone el pool (pruebas L2).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// OutboxEvent es un evento a publicar junto con el cambio.
type OutboxEvent struct {
	ID          string
	TenantID    string
	AggregateID string
	Subject     string
	Payload     []byte
	CreatedAt   time.Time
}

func (s *Store) inTenant(ctx context.Context, tenantID string, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return fmt.Errorf("set tenant: %w", err)
		}
		return fn(tx)
	})
}

func (s *Store) asSystem(ctx context.Context, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
			return fmt.Errorf("set system role: %w", err)
		}
		return fn(tx)
	})
}

func insertOutbox(ctx context.Context, tx pgx.Tx, e OutboxEvent) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO outbox (id, tenant_id, aggregate_id, subject, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, e.ID, e.TenantID, e.AggregateID, e.Subject, e.Payload, e.CreatedAt); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

// ── Bodegas ────────────────────────────────────────────────────────────────────────────────

const warehouseCols = `id, tenant_id, name, branch_code, active, is_default, created_at, updated_at`

func scanWarehouse(row pgx.Row) (domain.Warehouse, error) {
	var w domain.Warehouse
	err := row.Scan(&w.ID, &w.TenantID, &w.Name, &w.BranchCode, &w.Active, &w.IsDefault, &w.CreatedAt, &w.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return w, domain.ErrNotFound
	}
	if err != nil {
		return w, fmt.Errorf("scan warehouse: %w", err)
	}
	return w, nil
}

// DefaultWarehouseName es el nombre con que nace la bodega por defecto (el comercio la renombra).
const DefaultWarehouseName = "Bodega principal"

// EnsureDefaultWarehouse crea la bodega por defecto si el comercio aún no tiene y la devuelve.
func ensureDefault(ctx context.Context, tx pgx.Tx, tenantID, newID string, now time.Time) (domain.Warehouse, error) {
	// Sin destino de conflicto: absorbe tanto otra creación concurrente de la bodega por defecto
	// como una bodega ya llamada igual.
	if _, err := tx.Exec(ctx, `
		INSERT INTO warehouses (id, tenant_id, name, is_default, created_at, updated_at)
		VALUES ($1, $2, $3, true, $4, $4) ON CONFLICT DO NOTHING`, newID, tenantID, DefaultWarehouseName, now); err != nil {
		return domain.Warehouse{}, fmt.Errorf("ensure default warehouse: %w", err)
	}
	w, err := scanWarehouse(tx.QueryRow(ctx, `SELECT `+warehouseCols+` FROM warehouses WHERE is_default`))
	if !errors.Is(err, domain.ErrNotFound) {
		return w, err
	}
	// Existía una bodega con ese nombre pero ninguna por defecto: esa pasa a ser la por defecto.
	return scanWarehouse(tx.QueryRow(ctx, `
		UPDATE warehouses SET is_default = true, updated_at = $2
		WHERE id = (SELECT id FROM warehouses WHERE lower(name) = lower($1) LIMIT 1)
		RETURNING `+warehouseCols, DefaultWarehouseName, now))
}

// DefaultWarehouse devuelve (creándola si falta) la bodega por defecto.
func (s *Store) DefaultWarehouse(ctx context.Context, tenantID, newID string, now time.Time) (domain.Warehouse, error) {
	var w domain.Warehouse
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		w, err = ensureDefault(ctx, tx, tenantID, newID, now)
		return err
	})
	return w, err
}

// UpsertWarehouse crea o actualiza una bodega del tenant.
func (s *Store) UpsertWarehouse(ctx context.Context, w domain.Warehouse, create bool) (domain.Warehouse, error) {
	var out domain.Warehouse
	err := s.inTenant(ctx, w.TenantID, func(tx pgx.Tx) error {
		if w.IsDefault {
			if _, err := tx.Exec(ctx, `UPDATE warehouses SET is_default = false WHERE is_default AND id <> $1`, w.ID); err != nil {
				return fmt.Errorf("clear default warehouse: %w", err)
			}
		}
		var err error
		if create {
			out, err = scanWarehouse(tx.QueryRow(ctx, `
				INSERT INTO warehouses (id, tenant_id, name, branch_code, active, is_default, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING `+warehouseCols,
				w.ID, w.TenantID, strings.TrimSpace(w.Name), w.BranchCode, w.Active, w.IsDefault, w.UpdatedAt))
		} else {
			out, err = scanWarehouse(tx.QueryRow(ctx, `
				UPDATE warehouses SET name = $2, branch_code = $3, active = $4, is_default = $5, updated_at = $6
				WHERE id = $1 RETURNING `+warehouseCols,
				w.ID, strings.TrimSpace(w.Name), w.BranchCode, w.Active, w.IsDefault, w.UpdatedAt))
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.ErrInvalidWarehouse
		}
		return err
	})
	return out, err
}

// ListWarehouses devuelve las bodegas (la por defecto se crea si no hay ninguna).
func (s *Store) ListWarehouses(ctx context.Context, tenantID, newID string, now time.Time) ([]domain.Warehouse, error) {
	var out []domain.Warehouse
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		if _, err := ensureDefault(ctx, tx, tenantID, newID, now); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT `+warehouseCols+` FROM warehouses ORDER BY is_default DESC, lower(name)`)
		if err != nil {
			return fmt.Errorf("list warehouses: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			w, err := scanWarehouse(rows)
			if err != nil {
				return err
			}
			out = append(out, w)
		}
		return rows.Err()
	})
	return out, err
}

// ── Movimientos ────────────────────────────────────────────────────────────────────────────

// Batch es un conjunto de movimientos que se aplican juntos o no se aplica ninguno (un ajuste,
// una transferencia OUT+IN, o las líneas de una venta).
type Batch struct {
	TenantID       string
	IdempotencyKey string
	RequestHash    []byte
	Movements      []domain.Movement
	// DefaultWarehouseID se usa cuando un movimiento llega sin bodega (la crea si falta).
	NewWarehouseID string
	Now            time.Time
}

// Applied es el resultado: los movimientos guardados y las existencias que quedaron.
type Applied struct {
	Movements []domain.Movement
	Levels    []domain.Level
	Replayed  bool
}

// EventsFor arma los eventos (StockChanged y, si toca, StockLow) de las existencias que quedaron.
type EventsFor func(levels []domain.Level, lowNotify map[string]bool) ([]OutboxEvent, error)

func levelKey(warehouseID, productID string) string { return warehouseID + "/" + productID }

const movementCols = `id, tenant_id, warehouse_id, product_id, type, delta_milli, reason, reference_type,
	reference_id, coalesce(actor_user_id::text, ''), actor_service, idempotency_key, created_at`

func scanMovement(row pgx.Row) (domain.Movement, error) {
	var m domain.Movement
	err := row.Scan(&m.ID, &m.TenantID, &m.WarehouseID, &m.ProductID, &m.Type, &m.DeltaMilli, &m.Reason,
		&m.ReferenceType, &m.ReferenceID, &m.ActorUserID, &m.ActorService, &m.IdempotencyKey, &m.OccurredAt)
	if err != nil {
		return m, fmt.Errorf("scan movement: %w", err)
	}
	return m, nil
}

// replay devuelve los movimientos ya guardados con la clave si el contenido coincide.
func replay(ctx context.Context, tx pgx.Tx, key string, hash []byte) (*Applied, error) {
	rows, err := tx.Query(ctx, `SELECT `+movementCols+`, request_hash FROM movements WHERE idempotency_key = $1 ORDER BY type, id`, key)
	if err != nil {
		return nil, fmt.Errorf("load idempotent movements: %w", err)
	}
	defer rows.Close()
	var out Applied
	for rows.Next() {
		var m domain.Movement
		var h []byte
		if err := rows.Scan(&m.ID, &m.TenantID, &m.WarehouseID, &m.ProductID, &m.Type, &m.DeltaMilli, &m.Reason,
			&m.ReferenceType, &m.ReferenceID, &m.ActorUserID, &m.ActorService, &m.IdempotencyKey, &m.OccurredAt, &h); err != nil {
			return nil, fmt.Errorf("scan movement: %w", err)
		}
		if !bytes.Equal(h, hash) {
			return nil, domain.ErrKeyReused
		}
		out.Movements = append(out.Movements, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out.Movements) == 0 {
		return nil, nil
	}
	out.Replayed = true
	return &out, nil
}

// Apply guarda el lote de forma atómica. R3: bloquea las existencias en orden
// (warehouse_id, product_id) ascendente para que dos lotes concurrentes no se bloqueen entre sí.
func (s *Store) Apply(ctx context.Context, b Batch, events EventsFor) (Applied, error) {
	var out Applied
	err := s.inTenant(ctx, b.TenantID, func(tx pgx.Tx) error {
		prev, err := replay(ctx, tx, b.IdempotencyKey, b.RequestHash)
		if err != nil {
			return err
		}
		if prev != nil {
			out = *prev
			return nil
		}
		// Bodega por defecto para los movimientos que no la indican; las indicadas deben ser del
		// tenant (RLS) y estar activas.
		var def *domain.Warehouse
		checked := map[string]bool{}
		for i := range b.Movements {
			m := &b.Movements[i]
			if m.WarehouseID == "" {
				if def == nil {
					w, err := ensureDefault(ctx, tx, b.TenantID, b.NewWarehouseID, b.Now)
					if err != nil {
						return err
					}
					def = &w
				}
				m.WarehouseID = def.ID
			}
			if checked[m.WarehouseID] {
				continue
			}
			var active bool
			err := tx.QueryRow(ctx, `SELECT active FROM warehouses WHERE id = $1`, m.WarehouseID).Scan(&active)
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
				return domain.ErrInvalidWarehouse
			}
			if err != nil {
				return fmt.Errorf("check warehouse: %w", err)
			}
			checked[m.WarehouseID] = true
		}

		keys := map[string]bool{}
		for _, m := range b.Movements {
			keys[levelKey(m.WarehouseID, m.ProductID)] = true
		}
		levels, ordered, err := lockLevels(ctx, tx, b.TenantID, keys, b.Now)
		if err != nil {
			return err
		}

		for _, m := range b.Movements {
			l := levels[levelKey(m.WarehouseID, m.ProductID)]
			if err := l.Apply(m); err != nil {
				return err
			}
			var actor any
			if m.ActorUserID != "" {
				actor = m.ActorUserID
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO movements (id, tenant_id, warehouse_id, product_id, type, delta_milli, reason,
					reference_type, reference_id, actor_user_id, actor_service, idempotency_key, request_hash, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
				m.ID, b.TenantID, m.WarehouseID, m.ProductID, m.Type, m.DeltaMilli, strings.TrimSpace(m.Reason),
				m.ReferenceType, m.ReferenceID, actor, m.ActorService, b.IdempotencyKey, b.RequestHash, b.Now); err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return errConcurrentKey
				}
				return fmt.Errorf("insert movement: %w", err)
			}
			mm := m
			mm.TenantID, mm.IdempotencyKey, mm.OccurredAt = b.TenantID, b.IdempotencyKey, b.Now
			out.Movements = append(out.Movements, mm)
		}

		lowNotify, saved, err := saveLevels(ctx, tx, levels, ordered, b.Now)
		if err != nil {
			return err
		}
		out.Levels = saved
		evs, err := events(out.Levels, lowNotify)
		if err != nil {
			return err
		}
		for _, e := range evs {
			if err := insertOutbox(ctx, tx, e); err != nil {
				return err
			}
		}
		return nil
	})
	if errors.Is(err, errConcurrentKey) {
		// Otro reintento con la misma clave ganó la carrera: se responde lo que él guardó.
		var prev *Applied
		rerr := s.inTenant(ctx, b.TenantID, func(tx pgx.Tx) error {
			var err error
			prev, err = replay(ctx, tx, b.IdempotencyKey, b.RequestHash)
			return err
		})
		if rerr != nil {
			return out, rerr
		}
		if prev != nil {
			return *prev, nil
		}
	}
	return out, err
}

var errConcurrentKey = errors.New("idempotency key inserted concurrently")

// lockLevels crea si faltan y bloquea las existencias en orden (warehouse_id, product_id) (R3).
func lockLevels(ctx context.Context, tx pgx.Tx, tenantID string, keys map[string]bool, now time.Time) (map[string]*domain.Level, []string, error) {
	ordered := make([]string, 0, len(keys))
	for k := range keys {
		ordered = append(ordered, k)
	}
	sort.Strings(ordered)
	levels := map[string]*domain.Level{}
	for _, k := range ordered {
		wh, prod, _ := strings.Cut(k, "/")
		if _, err := tx.Exec(ctx, `
			INSERT INTO stock_levels (tenant_id, warehouse_id, product_id, updated_at)
			VALUES ($1, $2, $3, $4) ON CONFLICT (warehouse_id, product_id) DO NOTHING`, tenantID, wh, prod, now); err != nil {
			return nil, nil, fmt.Errorf("init stock level: %w", err)
		}
		var l domain.Level
		var low *time.Time
		if err := tx.QueryRow(ctx, `
			SELECT tenant_id, warehouse_id, product_id, on_hand_milli, reserved_milli, reorder_point_milli,
			       low_notified_on::timestamptz, version
			FROM stock_levels WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`, wh, prod).
			Scan(&l.TenantID, &l.WarehouseID, &l.ProductID, &l.OnHandMilli, &l.ReservedMilli, &l.ReorderPointMilli, &low, &l.Version); err != nil {
			return nil, nil, fmt.Errorf("lock stock level: %w", err)
		}
		if low != nil {
			l.LowNotifiedOn = *low
		}
		levels[k] = &l
	}
	return levels, ordered, nil
}

// saveLevels guarda las existencias bloqueadas y decide qué StockLow avisar (R7).
func saveLevels(ctx context.Context, tx pgx.Tx, levels map[string]*domain.Level, ordered []string, now time.Time) (map[string]bool, []domain.Level, error) {
	lowNotify := map[string]bool{}
	var out []domain.Level
	for _, k := range ordered {
		l := levels[k]
		notify := l.ShouldNotifyLow(now)
		var lowArg any
		if notify {
			lowNotify[k] = true
			lowArg = now.UTC().Format("2006-01-02")
		}
		if _, err := tx.Exec(ctx, `
			UPDATE stock_levels SET on_hand_milli = $3, reserved_milli = $4, version = $5, updated_at = $6,
				low_notified_on = coalesce($7::date, low_notified_on)
			WHERE warehouse_id = $1 AND product_id = $2`, l.WarehouseID, l.ProductID, l.OnHandMilli, l.ReservedMilli,
			l.Version, now, lowArg); err != nil {
			return nil, nil, fmt.Errorf("update stock level: %w", err)
		}
		out = append(out, *l)
	}
	return lowNotify, out, nil
}

// ── Lecturas ───────────────────────────────────────────────────────────────────────────────

// LevelCols es la proyección de una existencia.
const levelCols = `tenant_id, warehouse_id, product_id, on_hand_milli, reserved_milli, reorder_point_milli, version`

func scanLevel(row pgx.Row) (domain.Level, error) {
	var l domain.Level
	err := row.Scan(&l.TenantID, &l.WarehouseID, &l.ProductID, &l.OnHandMilli, &l.ReservedMilli, &l.ReorderPointMilli, &l.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return l, domain.ErrNotFound
	}
	if err != nil {
		return l, fmt.Errorf("scan stock level: %w", err)
	}
	return l, nil
}

// GetStock lee la existencia de un producto; sin bodega suma todas.
func (s *Store) GetStock(ctx context.Context, tenantID, productID, warehouseID string) (domain.Level, error) {
	var l domain.Level
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		if warehouseID != "" {
			l, err = scanLevel(tx.QueryRow(ctx, `SELECT `+levelCols+` FROM stock_levels WHERE warehouse_id = $1 AND product_id = $2`, warehouseID, productID))
		} else {
			l, err = scanLevel(tx.QueryRow(ctx, `
				SELECT $1::uuid, '00000000-0000-0000-0000-000000000000'::uuid, product_id, sum(on_hand_milli)::bigint,
				       sum(reserved_milli)::bigint, max(reorder_point_milli)::bigint, max(version)::bigint
				FROM stock_levels WHERE product_id = $2 GROUP BY product_id`, tenantID, productID))
		}
		return err
	})
	if errors.Is(err, domain.ErrNotFound) {
		// Un producto sin movimientos tiene existencia cero (no es un error).
		return domain.Level{TenantID: tenantID, WarehouseID: warehouseID, ProductID: productID}, nil
	}
	return l, err
}

// SetReorderPoint fija el punto de reorden de un producto en una bodega.
func (s *Store) SetReorderPoint(ctx context.Context, tenantID, warehouseID, productID string, milli int64, now time.Time) error {
	return s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO stock_levels (tenant_id, warehouse_id, product_id, reorder_point_milli, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (warehouse_id, product_id) DO UPDATE SET reorder_point_milli = EXCLUDED.reorder_point_milli,
				updated_at = EXCLUDED.updated_at`, tenantID, warehouseID, productID, milli, now)
		if err != nil {
			return fmt.Errorf("set reorder point: %w", err)
		}
		return nil
	})
}

// ListStock pagina por (product_id, warehouse_id); `after` es "producto/bodega" de la última fila.
// `onlyLow` filtra available ≤ punto de reorden o negativo.
func (s *Store) ListStock(ctx context.Context, tenantID, warehouseID string, onlyLow bool, after string, limit int) ([]domain.Level, string, error) {
	var out []domain.Level
	afterProduct, afterWarehouse, _ := strings.Cut(after, "/")
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT `+levelCols+` FROM stock_levels
			WHERE ($1 = '' OR warehouse_id::text = $1)
			  AND (NOT $2 OR on_hand_milli - reserved_milli < 0
			       OR (reorder_point_milli > 0 AND on_hand_milli - reserved_milli <= reorder_point_milli))
			  AND ($3 = '' OR (product_id::text, warehouse_id::text) > ($3, $4))
			ORDER BY product_id::text, warehouse_id::text LIMIT $5`, warehouseID, onlyLow, afterProduct, afterWarehouse, limit+1)
		if err != nil {
			return fmt.Errorf("list stock: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			l, err := scanLevel(rows)
			if err != nil {
				return err
			}
			out = append(out, l)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, "", err
	}
	if len(out) > limit {
		out = out[:limit]
		last := out[len(out)-1]
		return out, last.ProductID + "/" + last.WarehouseID, nil
	}
	return out, "", nil
}

// MovementCursor es la posición de keyset (más reciente primero).
type MovementCursor struct {
	At time.Time
	ID string
}

// ListMovements devuelve el historial (R1) más reciente primero.
func (s *Store) ListMovements(ctx context.Context, tenantID, productID, warehouseID string, from, to time.Time,
	after *MovementCursor, limit int) ([]domain.Movement, *MovementCursor, error) {
	var out []domain.Movement
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var afterAt any
		afterID := ""
		if after != nil {
			afterAt, afterID = after.At, after.ID
		}
		rows, err := tx.Query(ctx, `
			SELECT `+movementCols+` FROM movements
			WHERE ($1 = '' OR product_id::text = $1) AND ($2 = '' OR warehouse_id::text = $2)
			  AND created_at >= $3 AND created_at < $4
			  AND ($5::timestamptz IS NULL OR (created_at, id::text) < ($5::timestamptz, $6))
			ORDER BY created_at DESC, id DESC LIMIT $7`, productID, warehouseID, from, to, afterAt, afterID, limit+1)
		if err != nil {
			return fmt.Errorf("list movements: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			m, err := scanMovement(rows)
			if err != nil {
				return err
			}
			out = append(out, m)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, err
	}
	if len(out) > limit {
		out = out[:limit]
		last := out[len(out)-1]
		return out, &MovementCursor{At: last.OccurredAt, ID: last.ID}, nil
	}
	return out, nil, nil
}

// SumOfMovements recalcula on_hand desde los movimientos (R1: verificación).
func (s *Store) SumOfMovements(ctx context.Context, tenantID, warehouseID, productID string) (int64, error) {
	var n int64
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT coalesce(sum(delta_milli), 0)::bigint FROM movements
			WHERE warehouse_id = $1 AND product_id = $2`, warehouseID, productID).Scan(&n)
	})
	return n, err
}

// ── Outbox ─────────────────────────────────────────────────────────────────────────────────

// OutboxPending lee eventos sin publicar en orden.
func (s *Store) OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	var out []OutboxEvent
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, tenant_id, aggregate_id, subject, payload, created_at FROM outbox
			WHERE published_at IS NULL ORDER BY created_at, id LIMIT $1`, limit)
		if err != nil {
			return fmt.Errorf("outbox pending: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var e OutboxEvent
			if err := rows.Scan(&e.ID, &e.TenantID, &e.AggregateID, &e.Subject, &e.Payload, &e.CreatedAt); err != nil {
				return fmt.Errorf("scan outbox: %w", err)
			}
			out = append(out, e)
		}
		return rows.Err()
	})
	return out, err
}

// OutboxMarkPublished marca publicado tras el ack.
func (s *Store) OutboxMarkPublished(ctx context.Context, id string, at time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = $2 WHERE id = $1`, id, at); err != nil {
			return fmt.Errorf("mark outbox published: %w", err)
		}
		return nil
	})
}

// OutboxBacklog cuenta lo pendiente.
func (s *Store) OutboxBacklog(ctx context.Context) (int64, error) {
	var n int64
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL`).Scan(&n)
	})
	return n, err
}
