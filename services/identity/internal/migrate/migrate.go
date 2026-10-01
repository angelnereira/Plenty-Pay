// Package migrate aplica migraciones SQL embebidas, en orden, con checksum
// y atomicidad por migración. Fail secure: un checksum distinto al registrado
// detiene el arranque (señal de historial alterado — inaceptable en fintech).
package migrate

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var files embed.FS

const trackingDDL = `
create table if not exists identity_migrations (
  version     int primary key,
  name        text not null,
  checksum    text not null,
  applied_at  timestamptz not null default now()
);
`

type Migration struct {
	Version  int
	Name     string
	Checksum string
	SQL      string
}

// List devuelve las migraciones embebidas ordenadas por versión.
func List() ([]Migration, error) {
	entries, err := files.ReadDir("migrations")
	if err != nil {
		return nil, fmt.Errorf("leyendo migraciones: %w", err)
	}
	var out []Migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		content, err := files.ReadFile("migrations/" + e.Name())
		if err != nil {
			return nil, err
		}
		m, err := parse(e.Name(), content)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	return out, nil
}

// parse acepta NNNN_nombre.sql; valida NNNN estricto (fail fast, §21).
func parse(name string, content []byte) (Migration, error) {
	base := strings.TrimSuffix(name, ".sql")
	idx := strings.Index(base, "_")
	if idx != 4 {
		return Migration{}, fmt.Errorf("migración %s: nombre inválido (esperado NNNN_nombre.sql)", name)
	}
	var version int
	if _, err := fmt.Sscanf(base[:4], "%04d", &version); err != nil {
		return Migration{}, fmt.Errorf("migración %s: versión inválida", name)
	}
	sum := sha256.Sum256(content)
	return Migration{
		Version:  version,
		Name:     base,
		Checksum: hex.EncodeToString(sum[:]),
		SQL:      string(content),
	}, nil
}

// Up aplica las migraciones pendientes. Cada migración corre en SU
// transacción (atomicidad). Idempotente: volver a arrancar no re-aplica nada.
func Up(ctx context.Context, pool *pgxpool.Pool) ([]string, error) {
	if _, err := pool.Exec(ctx, trackingDDL); err != nil {
		return nil, fmt.Errorf("creando tabla de tracking: %w", err)
	}
	migs, err := List()
	if err != nil {
		return nil, err
	}
	var applied []string
	for _, m := range migs {
		var checksum string
		err := pool.QueryRow(ctx,
			`select checksum from identity_migrations where version = $1`, m.Version,
		).Scan(&checksum)
		switch {
		case err == nil:
			// Ya aplicada: fail secure si el contenido cambió.
			if checksum != m.Checksum {
				return nil, fmt.Errorf(
					"migración %s modificada tras aplicarse (checksum divergente): rechazado", m.Name)
			}
			continue
		case errors.Is(err, pgx.ErrNoRows):
			// Pendiente: aplicar.
		default:
			return nil, fmt.Errorf("leyendo estado de %s: %w", m.Name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, m.SQL); err != nil {
			_ = tx.Rollback(ctx)
			return nil, fmt.Errorf("aplicando %s: %w", m.Name, err)
		}
		if _, err := tx.Exec(ctx,
			`insert into identity_migrations (version, name, checksum) values ($1, $2, $3)`,
			m.Version, m.Name, m.Checksum,
		); err != nil {
			_ = tx.Rollback(ctx)
			return nil, fmt.Errorf("registrando %s: %w", m.Name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		applied = append(applied, m.Name)
	}
	return applied, nil
}
