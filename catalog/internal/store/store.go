// Package store implementa la persistencia de catalog sobre postgres-db con pgx v5.
// Cada transacción fija `app.tenant_id` (RLS, ADR 0014) y escribe su fila de outbox en la MISMA
// transacción que el cambio (ADR 0012): si falla una, no ocurre ninguna.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/catalog/internal/domain"
)

// Store es el repositorio de catalog.
type Store struct {
	pool *pgxpool.Pool
}

// Open conecta el pool (el DSN apunta a PgBouncer en modo transacción: sin sentencias preparadas
// con nombre).
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

// Ping verifica la base (readiness).
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

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
	_, err := tx.Exec(ctx, `
		INSERT INTO outbox (id, tenant_id, aggregate_id, subject, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, e.ID, e.TenantID, e.AggregateID, e.Subject, e.Payload, e.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

// uniqueViolation traduce una violación de índice único a su error de dominio (R1).
func uniqueViolation(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}
	switch {
	case pgErr.Code == "23505" && pgErr.ConstraintName == "products_sku":
		return domain.ErrSKUTaken
	case pgErr.Code == "23505" && pgErr.ConstraintName == "products_barcode":
		return domain.ErrBarcodeTaken
	case pgErr.Code == "23505" && pgErr.ConstraintName == "categories_name":
		return domain.ErrCategoryTaken
	}
	return err
}

const productCols = `id, tenant_id, sku, coalesce(barcode, ''), name, description, coalesce(category_id::text, ''),
	brand, unit_type, price_minor, currency, tax_rate_bps, cpbs_code, image_object_keys, attributes, status,
	tracks_inventory, coalesce(created_by::text, ''), created_at, updated_at, version,
	tracks_lots,
	coalesce((SELECT l.listed FROM listings l WHERE l.product_id = products.id), false)`

func scanProduct(row pgx.Row) (domain.Product, error) {
	var p domain.Product
	var attrs []byte
	err := row.Scan(&p.ID, &p.TenantID, &p.SKU, &p.Barcode, &p.Name, &p.Description, &p.CategoryID,
		&p.Brand, &p.UnitType, &p.PriceMinor, &p.Currency, &p.TaxRateBps, &p.CPBSCode, &p.ImageObjectKeys,
		&attrs, &p.Status, &p.TracksInventory, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt, &p.Version, &p.TracksLots, &p.Listed)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	if err != nil {
		return p, fmt.Errorf("scan product: %w", err)
	}
	p.Currency = strings.TrimSpace(p.Currency)
	if err := json.Unmarshal(attrs, &p.Attributes); err != nil {
		return p, fmt.Errorf("decode attributes: %w", err)
	}
	return p, nil
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// categoryVisible verifica, bajo RLS, que la categoría exista en el tenant (la FK no ve la RLS).
func categoryVisible(ctx context.Context, tx pgx.Tx, id string) error {
	if id == "" {
		return nil
	}
	var one int
	err := tx.QueryRow(ctx, `SELECT 1 FROM categories WHERE id = $1`, id).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrInvalidCategory
	}
	if err != nil {
		return fmt.Errorf("check category: %w", err)
	}
	return nil
}

// CreateProduct inserta el producto y su ProductChanged en una transacción.
func (s *Store) CreateProduct(ctx context.Context, p domain.Product, event func(domain.Product) (OutboxEvent, error)) error {
	attrs, err := json.Marshal(p.Attributes)
	if err != nil {
		return fmt.Errorf("encode attributes: %w", err)
	}
	return s.inTenant(ctx, p.TenantID, func(tx pgx.Tx) error {
		if err := categoryVisible(ctx, tx, p.CategoryID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO products (id, tenant_id, sku, barcode, name, description, category_id, brand, unit_type,
				price_minor, currency, tax_rate_bps, cpbs_code, image_object_keys, attributes, status,
				tracks_inventory, created_by, created_at, updated_at, version, tracks_lots)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20,$21)`,
			p.ID, p.TenantID, p.SKU, nullable(p.Barcode), p.Name, p.Description, nullable(p.CategoryID), p.Brand,
			p.UnitType, p.PriceMinor, p.Currency, p.TaxRateBps, p.CPBSCode, p.ImageObjectKeys, string(attrs), p.Status,
			p.TracksInventory, nullable(p.CreatedBy), p.CreatedAt, p.Version, p.TracksLots)
		if err != nil {
			return uniqueViolation(fmt.Errorf("insert product: %w", err))
		}
		e, err := event(p)
		if err != nil {
			return err
		}
		return insertOutbox(ctx, tx, e)
	})
}

// UpdateProduct bloquea la fila, aplica `mutate` y guarda con su evento. `expectedVersion` > 0
// activa el bloqueo optimista (catalog.proto `version`).
func (s *Store) UpdateProduct(ctx context.Context, tenantID, id string, expectedVersion int32,
	mutate func(*domain.Product) error, event func(domain.Product) (OutboxEvent, error)) (domain.Product, error) {
	var out domain.Product
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		p, err := scanProduct(tx.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id = $1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		if expectedVersion > 0 && p.Version != expectedVersion {
			return domain.ErrVersionConflict
		}
		if err := mutate(&p); err != nil {
			return err
		}
		if err := categoryVisible(ctx, tx, p.CategoryID); err != nil {
			return err
		}
		attrs, err := json.Marshal(p.Attributes)
		if err != nil {
			return fmt.Errorf("encode attributes: %w", err)
		}
		_, err = tx.Exec(ctx, `
			UPDATE products SET sku=$2, barcode=$3, name=$4, description=$5, category_id=$6, brand=$7,
				unit_type=$8, price_minor=$9, currency=$10, tax_rate_bps=$11, cpbs_code=$12,
				image_object_keys=$13, attributes=$14, status=$15, tracks_inventory=$16, updated_at=$17,
				version=$18, tracks_lots=$19
			WHERE id = $1`,
			p.ID, p.SKU, nullable(p.Barcode), p.Name, p.Description, nullable(p.CategoryID), p.Brand, p.UnitType,
			p.PriceMinor, p.Currency, p.TaxRateBps, p.CPBSCode, p.ImageObjectKeys, string(attrs), p.Status,
			p.TracksInventory, p.UpdatedAt, p.Version, p.TracksLots)
		if err != nil {
			return uniqueViolation(fmt.Errorf("update product: %w", err))
		}
		out = p
		e, err := event(p)
		if err != nil {
			return err
		}
		return insertOutbox(ctx, tx, e)
	})
	return out, err
}

// GetProduct lee un producto del tenant.
func (s *Store) GetProduct(ctx context.Context, tenantID, id string) (domain.Product, error) {
	var p domain.Product
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		p, err = scanProduct(tx.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id = $1`, id))
		return err
	})
	return p, err
}

// LookupByBarcode busca por código de barras exacto en el tenant (caja y recepción).
func (s *Store) LookupByBarcode(ctx context.Context, tenantID, barcode string) (domain.Product, error) {
	var p domain.Product
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		p, err = scanProduct(tx.QueryRow(ctx,
			`SELECT `+productCols+` FROM products WHERE barcode = $1 AND status = 1`, barcode))
		return err
	})
	return p, err
}

// ListFilter filtra ListProducts.
type ListFilter struct {
	Query      string
	CategoryID string
	Status     domain.Status // 0 = solo activos
	PageSize   int
	After      Cursor
}

// Cursor es la posición de keyset (nombre en minúsculas, id).
type Cursor struct {
	Name string
	ID   string
}

// ListProducts devuelve una página por nombre; `next` vacío si no hay más.
func (s *Store) ListProducts(ctx context.Context, tenantID string, f ListFilter) ([]domain.Product, *Cursor, error) {
	if f.Status == 0 {
		f.Status = domain.StatusActive
	}
	var out []domain.Product
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT `+productCols+` FROM products
			WHERE status = $1
			  AND ($2 = '' OR category_id::text = $2)
			  AND ($3 = '' OR search @@ plainto_tsquery('spanish', $3) OR sku ILIKE $3 || '%' OR barcode = $3
			       OR lower(name) LIKE '%' || lower($3) || '%')
			  AND ($4 = '' OR (lower(name), id::text) > ($4, $5))
			ORDER BY lower(name), id
			LIMIT $6`, f.Status, f.CategoryID, strings.TrimSpace(f.Query), f.After.Name, f.After.ID, f.PageSize+1)
		if err != nil {
			return fmt.Errorf("list products: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			p, err := scanProduct(rows)
			if err != nil {
				return err
			}
			out = append(out, p)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, err
	}
	if len(out) > f.PageSize {
		out = out[:f.PageSize]
		last := out[len(out)-1]
		return out, &Cursor{Name: strings.ToLower(last.Name), ID: last.ID}, nil
	}
	return out, nil, nil
}

// UpsertCategory crea o renombra una categoría; la profundidad se calcula del padre.
func (s *Store) UpsertCategory(ctx context.Context, c domain.Category) (domain.Category, error) {
	err := s.inTenant(ctx, c.TenantID, func(tx pgx.Tx) error {
		c.Depth = 1
		if c.ParentID != "" {
			var parentDepth int16
			err := tx.QueryRow(ctx, `SELECT depth FROM categories WHERE id = $1`, c.ParentID).Scan(&parentDepth)
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrInvalidCategory
			}
			if err != nil {
				return fmt.Errorf("load parent category: %w", err)
			}
			c.Depth = parentDepth + 1
		}
		if err := c.Validate(); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO categories (id, tenant_id, parent_id, name, depth, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $6)
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at`,
			c.ID, c.TenantID, nullable(c.ParentID), strings.TrimSpace(c.Name), c.Depth, c.UpdatedAt)
		if err != nil {
			return uniqueViolation(fmt.Errorf("upsert category: %w", err))
		}
		return nil
	})
	return c, err
}

// CategoryExists indica si el id ya existe en el tenant (para distinguir alta de cambio).
func (s *Store) CategoryExists(ctx context.Context, tenantID, id string) (bool, error) {
	var ok bool
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1)`, id).Scan(&ok)
	})
	return ok, err
}

// ListCategories devuelve el árbol plano del tenant.
func (s *Store) ListCategories(ctx context.Context, tenantID string) ([]domain.Category, error) {
	var out []domain.Category
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, tenant_id, coalesce(parent_id::text, ''), name, depth, created_at, updated_at
			FROM categories ORDER BY depth, lower(name)`)
		if err != nil {
			return fmt.Errorf("list categories: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var c domain.Category
			if err := rows.Scan(&c.ID, &c.TenantID, &c.ParentID, &c.Name, &c.Depth, &c.CreatedAt, &c.UpdatedAt); err != nil {
				return fmt.Errorf("scan category: %w", err)
			}
			out = append(out, c)
		}
		return rows.Err()
	})
	return out, err
}

// OutboxPending lee eventos sin publicar en orden de creación (relay).
func (s *Store) OutboxPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	var out []OutboxEvent
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, tenant_id, aggregate_id, subject, payload, created_at FROM outbox
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

// OutboxMarkPublished marca el evento como publicado tras el ack de JetStream.
func (s *Store) OutboxMarkPublished(ctx context.Context, id string, at time.Time) error {
	return s.asSystem(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = $2 WHERE id = $1`, id, at); err != nil {
			return fmt.Errorf("mark outbox published: %w", err)
		}
		return nil
	})
}

// OutboxBacklog cuenta lo pendiente (métrica pp_outbox_pending).
func (s *Store) OutboxBacklog(ctx context.Context) (int64, error) {
	var n int64
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL`).Scan(&n)
	})
	return n, err
}

// Pool expone el pool para los stores hermanos (idempotencia).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }
