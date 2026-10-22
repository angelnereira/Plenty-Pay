package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/inventory/internal/domain"
)

// ── Lotes (F16.4, R5) ──────────────────────────────────────────────────────────────────────
// Se resuelven dentro de la transacción que ya bloqueó la existencia (bodega, producto) en
// lockLevels, así que dos movimientos del mismo producto nunca reparten el mismo lote a la vez.

const lotCols = `id, tenant_id, warehouse_id, product_id, code, expires_on::timestamp, on_hand_milli`

func scanLot(row pgx.Row) (domain.Lot, error) {
	var l domain.Lot
	var exp *time.Time
	err := row.Scan(&l.ID, &l.TenantID, &l.WarehouseID, &l.ProductID, &l.Code, &exp, &l.OnHandMilli)
	if errors.Is(err, pgx.ErrNoRows) {
		return l, domain.ErrLotNotFound
	}
	if err != nil {
		return l, fmt.Errorf("scan lot: %w", err)
	}
	if exp != nil {
		d := time.Date(exp.Year(), exp.Month(), exp.Day(), 0, 0, 0, 0, time.UTC)
		l.ExpiresOn = &d
	}
	return l, nil
}

// upsertLot devuelve el lote (bodega, producto, código) bloqueado, creándolo con su vencimiento
// si no existe. Un lote existente conserva su vencimiento.
func upsertLot(ctx context.Context, tx pgx.Tx, tenantID, warehouseID, productID, code string, expires *time.Time, now time.Time) (domain.Lot, error) {
	var exp any
	if expires != nil {
		exp = expires.UTC().Format("2006-01-02") // ya es fecha pura (service.lotFields)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO lots (id, tenant_id, warehouse_id, product_id, code, expires_on, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6::date,$7,$7) ON CONFLICT (tenant_id, warehouse_id, product_id, code) DO NOTHING`,
		uuid.Must(uuid.NewV7()).String(), tenantID, warehouseID, productID, code, exp, now); err != nil {
		return domain.Lot{}, fmt.Errorf("upsert lot: %w", err)
	}
	return scanLot(tx.QueryRow(ctx, `SELECT `+lotCols+` FROM lots
		WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3 AND code = $4 FOR UPDATE`,
		tenantID, warehouseID, productID, code))
}

func addToLot(ctx context.Context, tx pgx.Tx, lotID string, delta int64, now time.Time) error {
	if _, err := tx.Exec(ctx, `UPDATE lots SET on_hand_milli = on_hand_milli + $2, updated_at = $3 WHERE id = $1`,
		lotID, delta, now); err != nil {
		return fmt.Errorf("move lot: %w", err)
	}
	return nil
}

func withLot(m domain.Movement, l domain.Lot, delta int64, first bool) domain.Movement {
	out := m
	if !first {
		out.ID = uuid.Must(uuid.NewV7()).String()
	}
	out.DeltaMilli, out.LotID, out.LotCode, out.LotExpiresOn = delta, l.ID, l.Code, l.ExpiresOn
	return out
}

// resolveLots convierte un movimiento en los movimientos por lote que lo componen (R5):
//   - entrada con código: crea o suma al lote; no se recibe un lote vencido (salvo la entrada de
//     una transferencia, que solo cambia de bodega lo que ya existe);
//   - entrada de una transferencia sin código: replica en el destino los lotes que salieron;
//   - salida con código: de ese lote; una venta nunca sale de un lote vencido;
//   - salida sin código de un producto con lotes: FEFO; lo que no alcanza queda sin lote y la
//     existencia agregada decide (R2: solo la venta física puede dejar negativo).
//
// mirror guarda, por producto, lo que tomó una salida de transferencia para su entrada.
func resolveLots(ctx context.Context, tx pgx.Tx, tenantID string, m domain.Movement, now time.Time,
	mirror map[string][]domain.Allocation) ([]domain.Movement, error) {
	today := domain.Today(now)
	if m.DeltaMilli > 0 {
		if m.Type == domain.TransferIn && m.LotCode == "" {
			if allocs := mirror[m.ProductID]; len(allocs) > 0 {
				delete(mirror, m.ProductID)
				var out []domain.Movement
				rest := m.DeltaMilli
				for i, a := range allocs {
					lot, err := upsertLot(ctx, tx, tenantID, m.WarehouseID, m.ProductID, a.Lot.Code, a.Lot.ExpiresOn, now)
					if err != nil {
						return nil, err
					}
					if err := addToLot(ctx, tx, lot.ID, a.Milli, now); err != nil {
						return nil, err
					}
					out = append(out, withLot(m, lot, a.Milli, i == 0))
					rest -= a.Milli
				}
				if rest > 0 {
					tail := m
					tail.ID, tail.DeltaMilli = uuid.Must(uuid.NewV7()).String(), rest
					out = append(out, tail)
				}
				return out, nil
			}
		}
		if m.LotCode == "" {
			if m.RequireLot {
				return nil, domain.ErrLotRequired
			}
			return []domain.Movement{m}, nil
		}
		lot, err := upsertLot(ctx, tx, tenantID, m.WarehouseID, m.ProductID, m.LotCode, m.LotExpiresOn, now)
		if err != nil {
			return nil, err
		}
		if m.Type != domain.TransferIn && lot.Expired(today) {
			return nil, domain.ErrLotExpired
		}
		if err := addToLot(ctx, tx, lot.ID, m.DeltaMilli, now); err != nil {
			return nil, err
		}
		return []domain.Movement{withLot(m, lot, m.DeltaMilli, true)}, nil
	}

	qty := -m.DeltaMilli
	if m.LotCode != "" {
		lot, err := scanLot(tx.QueryRow(ctx, `SELECT `+lotCols+` FROM lots
			WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3 AND code = $4 FOR UPDATE`,
			tenantID, m.WarehouseID, m.ProductID, m.LotCode))
		if err != nil {
			return nil, err
		}
		if m.Type == domain.Sale && lot.Expired(today) {
			return nil, domain.ErrLotExpired
		}
		if lot.OnHandMilli < qty {
			return nil, domain.ErrOutOfStock
		}
		if err := addToLot(ctx, tx, lot.ID, -qty, now); err != nil {
			return nil, err
		}
		if m.Type == domain.TransferOut {
			mirror[m.ProductID] = []domain.Allocation{{Lot: lot, Milli: qty}}
		}
		return []domain.Movement{withLot(m, lot, -qty, true)}, nil
	}

	rows, err := tx.Query(ctx, `SELECT `+lotCols+` FROM lots
		WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3
		ORDER BY expires_on NULLS LAST, code FOR UPDATE`, tenantID, m.WarehouseID, m.ProductID)
	if err != nil {
		return nil, fmt.Errorf("load lots: %w", err)
	}
	var lots []domain.Lot
	for rows.Next() {
		l, err := scanLot(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		lots = append(lots, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(lots) == 0 {
		return []domain.Movement{m}, nil // el producto no maneja lotes en esta bodega
	}
	allocs, rest := domain.AllocateFEFO(lots, qty, today, m.Type != domain.Sale)
	var out []domain.Movement
	for i, a := range allocs {
		if err := addToLot(ctx, tx, a.Lot.ID, -a.Milli, now); err != nil {
			return nil, err
		}
		out = append(out, withLot(m, a.Lot, -a.Milli, i == 0))
	}
	if rest > 0 {
		tail := m
		if len(out) > 0 {
			tail.ID = uuid.Must(uuid.NewV7()).String()
		}
		tail.DeltaMilli = -rest
		out = append(out, tail)
	}
	if m.Type == domain.TransferOut {
		mirror[m.ProductID] = allocs
	}
	return out, nil
}

// ListLots devuelve los lotes de un producto (de una bodega o de todas), primero los que vencen.
func (s *Store) ListLots(ctx context.Context, tenantID, productID, warehouseID string, includeEmpty bool) ([]domain.Lot, error) {
	var out []domain.Lot
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+lotCols+` FROM lots
			WHERE product_id = $1 AND ($2 = '' OR warehouse_id::text = $2) AND ($3 OR on_hand_milli > 0)
			ORDER BY expires_on NULLS LAST, code, warehouse_id`, productID, warehouseID, includeEmpty)
		if err != nil {
			return fmt.Errorf("list lots: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			l, err := scanLot(rows)
			if err != nil {
				return err
			}
			out = append(out, l)
		}
		return rows.Err()
	})
	return out, err
}
