// Package migrate aplica las migraciones SQL versionadas de fiscal-invoicing
// (fiscal-invoicing/migrations/) contra PostgreSQL. Lo ejecuta el Job migrate-fiscal-invoicing
// antes de cada despliegue (data-standards.md seccion 5) o el subcomando
// `fiscal-invoicing migrate` en desarrollo. El servicio NUNCA migra al arrancar.
package migrate

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Resultado de la ultima aplicacion ejecutada por Up.
type Result struct {
	Version uint
	Dirty   bool
	Applied bool // false cuando no habia migraciones pendientes (idempotencia)
}

// Up aplica todas las migraciones pendientes del sistema de archivos recibido
// (main.go las embebe: go:embed no puede usar rutas con ..) y devuelve el
// resultado. Es idempotente: ejecutarla dos veces seguidas devuelve
// Applied=false la segunda vez (migrate registra la version en schema_migrations).
//
// El DSN recibido apunta al servidor DIRECTIVO (postgres-db:5432), no al
// PgBouncer: el driver lib/pq de golang-migrate envia parametros de arranque
// (extra_float_digits) que PgBouncer en modo transaccion rechaza. El servicio
// en tiempo de ejecucion si usa PgBouncer con pgx v5 (PP_DB_DSN), que no envia
// esos parametros.
func Up(ctx context.Context, dsn string, files fs.FS) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()
	applied := true

	src, err := iofs.New(files, "migrations")
	if err != nil {
		return Result{}, fmt.Errorf("load embedded migrations: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		return Result{}, fmt.Errorf("create migrate instance: %w", err)
	}
	defer m.Close()

	err = m.Up()
	switch {
	case err == nil:
		// Se aplicaron migraciones nuevas.
	case errors.Is(err, migrate.ErrNoChange):
		applied = false
	default:
		version, dirty, verErr := m.Version()
		if verErr == nil {
			return Result{Version: version, Dirty: dirty}, fmt.Errorf("apply migrations: %w", err)
		}
		return Result{}, fmt.Errorf("apply migrations: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil {
		if errors.Is(err, migrate.ErrNilVersion) {
			return Result{}, nil // base de datos sin migraciones aplicadas aun
		}
		return Result{}, fmt.Errorf("read migration version: %w", err)
	}
	return Result{Version: version, Dirty: dirty, Applied: applied}, nil
}

// Timeout por defecto de las operaciones de migracion.
var defaultTimeout = 30 * time.Second
