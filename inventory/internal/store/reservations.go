package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"plentypay/inventory/internal/domain"
)

const reservationCols = `id, tenant_id, warehouse_id, lines, status, reference_type, reference_id, idempotency_key,
	expires_at, created_at`

func scanReservation(row pgx.Row) (domain.Reservation, []byte, error) {
	var r domain.Reservation
	var lines []byte
	var hash []byte
	err := row.Scan(&r.ID, &r.TenantID, &r.WarehouseID, &lines, &r.Status, &r.ReferenceType, &r.ReferenceID,
		&r.IdempotencyKey, &r.ExpiresAt, &r.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, nil, domain.ErrNotFound
	}
	if err != nil {
		return r, nil, fmt.Errorf("scan reservation: %w", err)
	}
	if err := json.Unmarshal(lines, &r.Lines); err != nil {
		return r, nil, fmt.Errorf("decode reservation lines: %w", err)
	}
	return r, hash, nil
}

// Reserve aparta todas las líneas o ninguna (R4), idempotente por clave dentro del tenant.
func (s *Store) Reserve(ctx context.Context, r domain.Reservation, hash []byte, allowNegative bool, newWarehouseID string,
	now time.Time, events EventsFor) (domain.Reservation, error) {
	out := r
	err := s.inTenant(ctx, r.TenantID, func(tx pgx.Tx) error {
		prev, h, err := scanReservation(tx.QueryRow(ctx, `SELECT `+reservationCols+`, request_hash FROM reservations
			WHERE idempotency_key = $1`, r.IdempotencyKey))
		if err == nil {
			if !bytes.Equal(h, hash) {
				return domain.ErrKeyReused
			}
			out = prev
			return nil
		}
		if !errors.Is(err, domain.ErrNotFound) {
			return err
		}
		if r.WarehouseID == "" {
			w, err := ensureDefault(ctx, tx, r.TenantID, newWarehouseID, now)
			if err != nil {
				return err
			}
			r.WarehouseID = w.ID
		} else {
			var active bool
			err := tx.QueryRow(ctx, `SELECT active FROM warehouses WHERE id = $1`, r.WarehouseID).Scan(&active)
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
				return domain.ErrInvalidWarehouse
			}
			if err != nil {
				return fmt.Errorf("check warehouse: %w", err)
			}
		}
		keys := map[string]bool{}
		for _, l := range r.Lines {
			keys[levelKey(r.WarehouseID, l.ProductID)] = true
		}
		levels, ordered, err := lockLevels(ctx, tx, r.TenantID, keys, now)
		if err != nil {
			return err
		}
		for _, l := range r.Lines {
			if err := levels[levelKey(r.WarehouseID, l.ProductID)].Reserve(l.QtyMilli, allowNegative); err != nil {
				return err // todo o nada: la transacción se revierte
			}
		}
		lines, err := json.Marshal(r.Lines)
		if err != nil {
			return fmt.Errorf("encode lines: %w", err)
		}
		r.Status, r.CreatedAt = domain.ReservationActive, now
		if _, err := tx.Exec(ctx, `INSERT INTO reservations (id, tenant_id, warehouse_id, lines, status, reference_type,
			reference_id, idempotency_key, request_hash, expires_at, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
			r.ID, r.TenantID, r.WarehouseID, string(lines), r.Status, r.ReferenceType, r.ReferenceID, r.IdempotencyKey,
			hash, r.ExpiresAt, now); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return errConcurrentKey
			}
			return fmt.Errorf("insert reservation: %w", err)
		}
		low, saved, err := saveLevels(ctx, tx, levels, ordered, now)
		if err != nil {
			return err
		}
		evs, err := events(saved, low)
		if err != nil {
			return err
		}
		for _, e := range evs {
			if err := insertOutbox(ctx, tx, e); err != nil {
				return err
			}
		}
		out = r
		return nil
	})
	if errors.Is(err, errConcurrentKey) {
		return s.Reserve(ctx, r, hash, allowNegative, newWarehouseID, now, events)
	}
	return out, err
}

// Finish confirma (SALE: baja existencia y reserva) o libera/vence (devuelve lo apartado) una
// reserva ACTIVE. Repetir sobre una ya terminada en el mismo sentido devuelve su estado.
func (s *Store) Finish(ctx context.Context, tenantID, id string, to domain.ReservationStatus, actorService string,
	now time.Time, newID func() string, events EventsFor) (domain.Reservation, error) {
	var out domain.Reservation
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		r, _, err := scanReservation(tx.QueryRow(ctx, `SELECT `+reservationCols+`, request_hash FROM reservations
			WHERE id = $1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		out = r
		if r.Status == to || (to == domain.ReservationReleased && r.Status == domain.ReservationExpired) {
			return nil // idempotente
		}
		if r.Status != domain.ReservationActive {
			return domain.ErrInvalidTransition
		}
		if to == domain.ReservationCommitted && !now.Before(r.ExpiresAt) {
			return domain.ErrInvalidTransition // vencida: ya no protege existencias
		}
		keys := map[string]bool{}
		for _, l := range r.Lines {
			keys[levelKey(r.WarehouseID, l.ProductID)] = true
		}
		levels, ordered, err := lockLevels(ctx, tx, tenantID, keys, now)
		if err != nil {
			return err
		}
		for _, l := range r.Lines {
			lv := levels[levelKey(r.WarehouseID, l.ProductID)]
			lv.Unreserve(l.QtyMilli)
			if to != domain.ReservationCommitted {
				continue
			}
			m := domain.Movement{ID: newID(), WarehouseID: r.WarehouseID, ProductID: l.ProductID, Type: domain.Sale,
				DeltaMilli: -l.QtyMilli, ReferenceType: r.ReferenceType, ReferenceID: r.ReferenceID, ActorService: actorService}
			// R5: la venta de un producto con lotes sale FEFO de los lotes no vencidos.
			parts, err := resolveLots(ctx, tx, tenantID, m, now, map[string][]domain.Allocation{})
			if err != nil {
				return err
			}
			key := "commit:" + r.ID + ":" + l.ProductID
			for _, pm := range parts {
				if err := lv.Apply(pm); err != nil {
					return err
				}
				if err := insertMovement(ctx, tx, tenantID, pm, key, []byte(key), now); err != nil {
					return fmt.Errorf("insert commit movement: %w", err)
				}
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE reservations SET status = $2, updated_at = $3 WHERE id = $1`, id, to, now); err != nil {
			return fmt.Errorf("update reservation: %w", err)
		}
		low, saved, err := saveLevels(ctx, tx, levels, ordered, now)
		if err != nil {
			return err
		}
		evs, err := events(saved, low)
		if err != nil {
			return err
		}
		for _, e := range evs {
			if err := insertOutbox(ctx, tx, e); err != nil {
				return err
			}
		}
		out.Status = to
		return nil
	})
	return out, err
}

// DueReservations lista reservas ACTIVE vencidas (job de 30 s, R4).
func (s *Store) DueReservations(ctx context.Context, now time.Time, limit int) ([]domain.Reservation, error) {
	var out []domain.Reservation
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+reservationCols+`, request_hash FROM reservations
			WHERE status = 1 AND expires_at <= $1 ORDER BY expires_at LIMIT $2`, now, limit)
		if err != nil {
			return fmt.Errorf("due reservations: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			r, _, err := scanReservation(rows)
			if err != nil {
				return err
			}
			out = append(out, r)
		}
		return rows.Err()
	})
	return out, err
}
