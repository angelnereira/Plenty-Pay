package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/pos/internal/domain"
)

// Settings lee la configuración de caja del comercio; sin fila, los valores por defecto (R14).
func (s *Store) Settings(ctx context.Context, tenantID string) (domain.Settings, error) {
	out := domain.DefaultSettings()
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		out, err = readSettings(ctx, tx, tenantID, false)
		return err
	})
	return out, err
}

func readSettings(ctx context.Context, tx pgx.Tx, tenantID string, lock bool) (domain.Settings, error) {
	q := `SELECT settings::text, version FROM pos_settings WHERE tenant_id = $1`
	if lock {
		q += ` FOR UPDATE`
	}
	var raw string
	var version int32
	err := tx.QueryRow(ctx, q, tenantID).Scan(&raw, &version)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DefaultSettings(), nil
	}
	if err != nil {
		return domain.Settings{}, fmt.Errorf("read pos settings: %w", err)
	}
	var st domain.Settings
	if err := json.Unmarshal([]byte(raw), &st); err != nil {
		return domain.Settings{}, fmt.Errorf("decode pos settings: %w", err)
	}
	st.Version = version
	return st, nil
}

// SaveSettings guarda con concurrencia optimista: `st.Version` debe ser la vigente (0 si nunca se
// guardó). Si no coincide pero el contenido es el mismo (reintento de un guardado ya aplicado),
// devuelve lo guardado; si difiere, ErrSettingsConflict.
func (s *Store) SaveSettings(ctx context.Context, tenantID string, st domain.Settings, actorID string, now time.Time) (domain.Settings, error) {
	var out domain.Settings
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		// Bloquea la fila (o, si no existe, serializa la primera inserción con el índice primario).
		cur, err := readSettings(ctx, tx, tenantID, true)
		if err != nil {
			return err
		}
		if st.Version != cur.Version {
			if st.SameContent(cur) {
				out = cur
				return nil
			}
			return domain.ErrSettingsConflict
		}
		raw, err := json.Marshal(st)
		if err != nil {
			return fmt.Errorf("encode pos settings: %w", err)
		}
		var by any
		if actorID != "" {
			by = actorID
		}
		tag, err := tx.Exec(ctx, `INSERT INTO pos_settings (tenant_id, settings, version, updated_by, updated_at)
			VALUES ($1, $2::jsonb, 1, $3, $4)
			ON CONFLICT (tenant_id) DO UPDATE SET settings = EXCLUDED.settings, version = pos_settings.version + 1,
			  updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
			WHERE pos_settings.version = $5`, tenantID, string(raw), by, now, cur.Version)
		if err != nil {
			if isUnique(err, "pos_settings_pkey") {
				return domain.ErrSettingsConflict
			}
			return fmt.Errorf("save pos settings: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return domain.ErrSettingsConflict
		}
		out = st
		out.Version = cur.Version + 1
		return nil
	})
	return out, err
}
