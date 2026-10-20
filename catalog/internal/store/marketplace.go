package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/catalog/internal/domain"
)

// ── Estado del negocio (proyección de identity.TenantStatusChanged) ────────────────────────

// TenantStatus lee la proyección; ok=false si nunca llegó un evento de ese negocio.
func (s *Store) TenantStatus(ctx context.Context, tenantID string) (int16, bool, error) {
	var st int16
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT status FROM tenant_status WHERE tenant_id = $1`, tenantID).Scan(&st)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("read tenant status: %w", err)
	}
	return st, true, nil
}

// ApplyTenantStatus guarda el estado (consumidor idempotente por event_id; `eventID` vacío = dato
// leído de identity como respaldo). R4: un negocio que deja de estar ACTIVE despublica todo, con
// su ProductChanged por producto, en la misma transacción.
func (s *Store) ApplyTenantStatus(ctx context.Context, eventID, tenantID string, status int16, at time.Time,
	event func(domain.Product) (OutboxEvent, error)) (bool, error) {
	applied := false
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		if eventID != "" {
			tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id, tenant_id, processed_at) VALUES ($1, $2, $3)
				ON CONFLICT (event_id) DO NOTHING`, eventID, tenantID, at)
			if err != nil {
				return fmt.Errorf("record processed event: %w", err)
			}
			if tag.RowsAffected() == 0 {
				return nil
			}
		}
		if _, err := tx.Exec(ctx, `INSERT INTO tenant_status (tenant_id, status, updated_at) VALUES ($1, $2, $3)
			ON CONFLICT (tenant_id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
			tenantID, status, at); err != nil {
			return fmt.Errorf("upsert tenant status: %w", err)
		}
		applied = true
		if status == domain.TenantActive {
			return nil
		}
		rows, err := tx.Query(ctx, `UPDATE listings SET listed = false, updated_at = $2
			WHERE tenant_id = $1 AND listed RETURNING product_id`, tenantID, at)
		if err != nil {
			return fmt.Errorf("unlist tenant: %w", err)
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return fmt.Errorf("scan unlisted: %w", err)
			}
			ids = append(ids, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for _, id := range ids {
			p, err := scanProduct(tx.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id = $1`, id))
			if err != nil {
				return err
			}
			e, err := event(p)
			if err != nil {
				return err
			}
			if err := insertOutbox(ctx, tx, e); err != nil {
				return err
			}
		}
		return nil
	})
	return applied, err
}

// ApplyStock guarda la existencia de un producto en una bodega (R5, consumidor idempotente).
func (s *Store) ApplyStock(ctx context.Context, eventID, tenantID, productID, warehouseID string, availableMilli int64, at time.Time) (bool, error) {
	applied := false
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id, tenant_id, processed_at) VALUES ($1, $2, $3)
			ON CONFLICT (event_id) DO NOTHING`, eventID, tenantID, at)
		if err != nil {
			return fmt.Errorf("record processed event: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		// Un evento viejo no pisa uno más nuevo (los relays publican en orden, pero se reentregan).
		if _, err := tx.Exec(ctx, `INSERT INTO product_stock (tenant_id, product_id, warehouse_id, available_milli, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (product_id, warehouse_id) DO UPDATE SET available_milli = EXCLUDED.available_milli,
				updated_at = EXCLUDED.updated_at WHERE product_stock.updated_at <= EXCLUDED.updated_at`,
			tenantID, productID, warehouseID, availableMilli, at); err != nil {
			return fmt.Errorf("upsert product stock: %w", err)
		}
		applied = true
		return nil
	})
	return applied, err
}

// ── Listados y vitrina (del comercio, bajo RLS) ────────────────────────────────────────────

// SetListing publica o despublica un producto del tenant. `check` decide con el producto actual.
func (s *Store) SetListing(ctx context.Context, l domain.Listing, check func(domain.Product) error,
	event func(domain.Product) (OutboxEvent, error)) (domain.Listing, error) {
	err := s.inTenant(ctx, l.TenantID, func(tx pgx.Tx) error {
		p, err := scanProduct(tx.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id = $1 FOR UPDATE`, l.ProductID))
		if err != nil {
			return err
		}
		if err := check(p); err != nil {
			return err
		}
		var price any
		if l.PriceMinor > 0 {
			price = l.PriceMinor
		}
		if err := tx.QueryRow(ctx, `INSERT INTO listings (product_id, tenant_id, listed, price_minor, delivery, pickup, published_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $3 THEN $7::timestamptz END, $7)
			ON CONFLICT (product_id) DO UPDATE SET listed = EXCLUDED.listed, price_minor = EXCLUDED.price_minor,
				delivery = EXCLUDED.delivery, pickup = EXCLUDED.pickup, updated_at = EXCLUDED.updated_at,
				published_at = CASE WHEN EXCLUDED.listed AND NOT listings.listed THEN EXCLUDED.updated_at
				                    WHEN EXCLUDED.listed THEN listings.published_at END
			RETURNING coalesce(published_at, 'epoch'::timestamptz)`,
			l.ProductID, l.TenantID, l.Listed, price, l.Delivery, l.Pickup, l.UpdatedAt).Scan(&l.PublishedAt); err != nil {
			return fmt.Errorf("upsert listing: %w", err)
		}
		e, err := event(p)
		if err != nil {
			return err
		}
		return insertOutbox(ctx, tx, e)
	})
	return l, err
}

// Listing lee la publicación de un producto del tenant (sin fila = no publicado).
func (s *Store) Listing(ctx context.Context, tenantID, productID string) (domain.Listing, error) {
	l := domain.Listing{ProductID: productID, TenantID: tenantID, Pickup: true}
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var price *int64
		var pub *time.Time
		err := tx.QueryRow(ctx, `SELECT listed, price_minor, delivery, pickup, published_at, updated_at FROM listings WHERE product_id = $1`,
			productID).Scan(&l.Listed, &price, &l.Delivery, &l.Pickup, &pub, &l.UpdatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read listing: %w", err)
		}
		if price != nil {
			l.PriceMinor = *price
		}
		if pub != nil {
			l.PublishedAt = *pub
		}
		return nil
	})
	return l, err
}

// UpsertStorefront guarda la vitrina del tenant.
func (s *Store) UpsertStorefront(ctx context.Context, sf domain.Storefront) error {
	if len(sf.AddressJSON) == 0 {
		sf.AddressJSON = []byte("{}")
	}
	return s.inTenant(ctx, sf.TenantID, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO storefronts (tenant_id, display_name, description, logo_object_key, address, published, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (tenant_id) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description,
				logo_object_key = EXCLUDED.logo_object_key, address = EXCLUDED.address, published = EXCLUDED.published,
				updated_at = EXCLUDED.updated_at`,
			sf.TenantID, strings.TrimSpace(sf.DisplayName), strings.TrimSpace(sf.Description), sf.LogoObjectKey,
			string(sf.AddressJSON), sf.Published, sf.UpdatedAt)
		if err != nil {
			return fmt.Errorf("upsert storefront: %w", err)
		}
		return nil
	})
}

// Storefront lee la vitrina de un comercio (lectura pública).
func (s *Store) Storefront(ctx context.Context, tenantID string) (domain.Storefront, error) {
	var sf domain.Storefront
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `SELECT tenant_id, display_name, description, logo_object_key, address, published, updated_at
			FROM storefronts WHERE tenant_id = $1`, tenantID).
			Scan(&sf.TenantID, &sf.DisplayName, &sf.Description, &sf.LogoObjectKey, &sf.AddressJSON, &sf.Published, &sf.UpdatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("read storefront: %w", err)
		}
		return nil
	})
	return sf, err
}

// ── Marketplace (lectura pública entre comercios) ──────────────────────────────────────────

// MarketFilter filtra SearchMarketplace.
type MarketFilter struct {
	Query    string
	TenantID string
	MinPrice int64
	MaxPrice int64
	Sort     string
	Limit    int
	Offset   int
}

// marketBase: R7 en la propia consulta: listado, producto ACTIVE y negocio ACTIVE en la proyección.
const marketBase = `
	FROM listings l
	JOIN products p ON p.id = l.product_id
	JOIN tenant_status ts ON ts.tenant_id = l.tenant_id AND ts.status = 2
	LEFT JOIN storefronts sf ON sf.tenant_id = l.tenant_id
	LEFT JOIN LATERAL (SELECT coalesce(sum(available_milli), 0) AS available FROM product_stock ps WHERE ps.product_id = p.id) st ON true
	WHERE l.listed AND p.status = 1`

const marketCols = `p.id, p.tenant_id, p.sku, coalesce(p.barcode, ''), p.name, p.description, coalesce(p.category_id::text, ''),
	p.brand, p.unit_type, p.price_minor, p.currency, p.tax_rate_bps, p.cpbs_code, p.image_object_keys, p.attributes, p.status,
	p.tracks_inventory, coalesce(p.created_by::text, ''), p.created_at, p.updated_at, p.version,
	coalesce(l.price_minor, 0), l.delivery, l.pickup, coalesce(l.published_at, 'epoch'::timestamptz),
	coalesce(sf.display_name, ''), coalesce(sf.description, ''), coalesce(sf.logo_object_key, ''),
	(NOT p.tracks_inventory OR st.available > 0)`

func scanMarket(row pgx.Row) (domain.MarketItem, error) {
	var it domain.MarketItem
	var attrs []byte
	p := &it.Product
	err := row.Scan(&p.ID, &p.TenantID, &p.SKU, &p.Barcode, &p.Name, &p.Description, &p.CategoryID,
		&p.Brand, &p.UnitType, &p.PriceMinor, &p.Currency, &p.TaxRateBps, &p.CPBSCode, &p.ImageObjectKeys,
		&attrs, &p.Status, &p.TracksInventory, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt, &p.Version,
		&it.Listing.PriceMinor, &it.Listing.Delivery, &it.Listing.Pickup, &it.Listing.PublishedAt,
		&it.Storefront.DisplayName, &it.Storefront.Description, &it.Storefront.LogoObjectKey, &it.InStock)
	if errors.Is(err, pgx.ErrNoRows) {
		return it, domain.ErrNotFound
	}
	if err != nil {
		return it, fmt.Errorf("scan market item: %w", err)
	}
	p.Currency = strings.TrimSpace(p.Currency)
	if err := json.Unmarshal(attrs, &p.Attributes); err != nil {
		return it, fmt.Errorf("decode attributes: %w", err)
	}
	it.Listing.ProductID, it.Listing.TenantID, it.Listing.Listed = p.ID, p.TenantID, true
	it.Storefront.TenantID = p.TenantID
	return it, nil
}

// SearchMarketplace busca entre los comercios ACTIVE (R7). Pagina por desplazamiento acotado.
func (s *Store) SearchMarketplace(ctx context.Context, f MarketFilter) ([]domain.MarketItem, bool, error) {
	order := `ts_rank(p.search, plainto_tsquery('spanish', $1)) DESC, l.published_at DESC, p.id`
	switch f.Sort {
	case "PRICE_ASC":
		order = `coalesce(l.price_minor, p.price_minor) ASC, p.id`
	case "PRICE_DESC":
		order = `coalesce(l.price_minor, p.price_minor) DESC, p.id`
	case "NEWEST":
		order = `l.published_at DESC, p.id`
	}
	var out []domain.MarketItem
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+marketCols+marketBase+`
			AND ($1 = '' OR p.search @@ plainto_tsquery('spanish', $1) OR lower(p.name) LIKE '%' || lower($1) || '%')
			AND ($2 = '' OR l.tenant_id::text = $2)
			AND ($3 = 0 OR coalesce(l.price_minor, p.price_minor) >= $3)
			AND ($4 = 0 OR coalesce(l.price_minor, p.price_minor) <= $4)
			ORDER BY `+order+` LIMIT $5 OFFSET $6`,
			strings.TrimSpace(f.Query), f.TenantID, f.MinPrice, f.MaxPrice, f.Limit+1, f.Offset)
		if err != nil {
			return fmt.Errorf("search marketplace: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			it, err := scanMarket(rows)
			if err != nil {
				return err
			}
			out = append(out, it)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, false, err
	}
	more := len(out) > f.Limit
	if more {
		out = out[:f.Limit]
	}
	return out, more, nil
}

// MarketplaceProduct lee un producto publicado (mismas reglas R7 que la búsqueda).
func (s *Store) MarketplaceProduct(ctx context.Context, productID string) (domain.MarketItem, error) {
	var it domain.MarketItem
	err := s.asSystem(ctx, func(tx pgx.Tx) error {
		var err error
		it, err = scanMarket(tx.QueryRow(ctx, `SELECT `+marketCols+marketBase+` AND p.id = $1`, productID))
		return err
	})
	return it, err
}
