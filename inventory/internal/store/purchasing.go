package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/inventory/internal/domain"
)

// ── Proveedores (S-INV-07) ──────────────────────────────────────────────────────────────

const supplierCols = `id, tenant_id, name, tax_id, check_digit, email, phone, lead_time_days, active`

func scanSupplier(row pgx.Row) (domain.Supplier, error) {
	var s domain.Supplier
	err := row.Scan(&s.ID, &s.TenantID, &s.Name, &s.TaxID, &s.CheckDigit, &s.Email, &s.Phone, &s.LeadTimeDays, &s.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return s, domain.ErrNotFound
	}
	if err != nil {
		return s, fmt.Errorf("scan supplier: %w", err)
	}
	return s, nil
}

// CreateSupplier es idempotente por clave dentro del negocio.
func (s *Store) CreateSupplier(ctx context.Context, sup domain.Supplier, key string, now time.Time) (domain.Supplier, error) {
	var out domain.Supplier
	err := s.inTenant(ctx, sup.TenantID, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO suppliers (id, tenant_id, name, tax_id, check_digit, email, phone, lead_time_days, active,
				idempotency_key, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
			sup.ID, sup.TenantID, sup.Name, sup.TaxID, sup.CheckDigit, sup.Email, sup.Phone, sup.LeadTimeDays, sup.Active,
			key, now); err != nil {
			return fmt.Errorf("insert supplier: %w", err)
		}
		var err error
		out, err = scanSupplier(tx.QueryRow(ctx, `SELECT `+supplierCols+` FROM suppliers WHERE idempotency_key = $1`, key))
		return err
	})
	return out, err
}

// UpdateSupplier cambia un proveedor del negocio (RLS).
func (s *Store) UpdateSupplier(ctx context.Context, sup domain.Supplier, now time.Time) (domain.Supplier, error) {
	var out domain.Supplier
	err := s.inTenant(ctx, sup.TenantID, func(tx pgx.Tx) error {
		var err error
		out, err = scanSupplier(tx.QueryRow(ctx, `
			UPDATE suppliers SET name = $2, tax_id = $3, check_digit = $4, email = $5, phone = $6, lead_time_days = $7,
				active = $8, updated_at = $9 WHERE id = $1 RETURNING `+supplierCols,
			sup.ID, sup.Name, sup.TaxID, sup.CheckDigit, sup.Email, sup.Phone, sup.LeadTimeDays, sup.Active, now))
		return err
	})
	return out, err
}

// ListSuppliers por nombre, paginado por id.
func (s *Store) ListSuppliers(ctx context.Context, tenantID, after string, limit int) ([]domain.Supplier, string, error) {
	var out []domain.Supplier
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+supplierCols+` FROM suppliers
			WHERE ($1 = '' OR (lower(name), id::text) > (SELECT lower(name), id::text FROM suppliers WHERE id::text = $1))
			ORDER BY lower(name), id LIMIT $2`, after, limit+1)
		if err != nil {
			return fmt.Errorf("list suppliers: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			sup, err := scanSupplier(rows)
			if err != nil {
				return err
			}
			out = append(out, sup)
		}
		return rows.Err()
	})
	next := ""
	if len(out) > limit {
		out = out[:limit]
		next = out[limit-1].ID
	}
	return out, next, err
}

// ── Órdenes de compra (S-INV-05) ────────────────────────────────────────────────────────

const poCols = `o.id, o.tenant_id, o.supplier_id, s.name, o.warehouse_id, o.status, o.expected_at, o.total_minor,
	o.created_at, o.version`

func scanPO(row pgx.Row) (domain.PurchaseOrder, error) {
	var o domain.PurchaseOrder
	var status int16
	err := row.Scan(&o.ID, &o.TenantID, &o.SupplierID, &o.SupplierName, &o.WarehouseID, &status, &o.ExpectedAt,
		&o.TotalMinor, &o.CreatedAt, &o.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, domain.ErrNotFound
	}
	if err != nil {
		return o, fmt.Errorf("scan purchase order: %w", err)
	}
	o.Status = domain.POStatus(status)
	return o, nil
}

func loadLines(ctx context.Context, tx pgx.Tx, o *domain.PurchaseOrder, lock bool) error {
	q := `SELECT product_id, ordered_milli, received_milli, unit_cost_minor FROM purchase_order_lines
		WHERE purchase_order_id = $1 ORDER BY product_id`
	if lock {
		q += ` FOR UPDATE`
	}
	rows, err := tx.Query(ctx, q, o.ID)
	if err != nil {
		return fmt.Errorf("load lines: %w", err)
	}
	defer rows.Close()
	o.Lines = nil
	for rows.Next() {
		var l domain.POLine
		if err := rows.Scan(&l.ProductID, &l.OrderedMilli, &l.ReceivedMilli, &l.UnitCostMinor); err != nil {
			return fmt.Errorf("scan line: %w", err)
		}
		o.Lines = append(o.Lines, l)
	}
	return rows.Err()
}

func getPO(ctx context.Context, tx pgx.Tx, id string, lock bool) (domain.PurchaseOrder, error) {
	q := `SELECT ` + poCols + ` FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE o.id::text = $1`
	if lock {
		q += ` FOR UPDATE OF o`
	}
	o, err := scanPO(tx.QueryRow(ctx, q, id))
	if err != nil {
		return o, err
	}
	return o, loadLines(ctx, tx, &o, lock)
}

// CreatePurchaseOrder guarda la orden en borrador. La misma clave con el mismo contenido devuelve
// la original; con otro contenido, ErrKeyReused.
func (s *Store) CreatePurchaseOrder(ctx context.Context, o domain.PurchaseOrder, key string, hash []byte,
	createdBy string, now time.Time) (domain.PurchaseOrder, error) {
	var out domain.PurchaseOrder
	err := s.inTenant(ctx, o.TenantID, func(tx pgx.Tx) error {
		var prevID string
		var prevHash []byte
		err := tx.QueryRow(ctx, `SELECT id, request_hash FROM purchase_orders WHERE idempotency_key = $1`, key).Scan(&prevID, &prevHash)
		if err == nil {
			if !bytes.Equal(prevHash, hash) {
				return domain.ErrKeyReused
			}
			out, err = getPO(ctx, tx, prevID, false)
			return err
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("load idempotent order: %w", err)
		}
		var active bool
		if err := tx.QueryRow(ctx, `SELECT active FROM suppliers WHERE id::text = $1`, o.SupplierID).Scan(&active); err != nil || !active {
			if err == nil || errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrInvalidSupplier
			}
			return fmt.Errorf("check supplier: %w", err)
		}
		if err := tx.QueryRow(ctx, `SELECT active FROM warehouses WHERE id::text = $1`, o.WarehouseID).Scan(&active); err != nil || !active {
			if err == nil || errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrInvalidWarehouse
			}
			return fmt.Errorf("check warehouse: %w", err)
		}
		var by any
		if createdBy != "" {
			by = createdBy
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO purchase_orders (id, tenant_id, supplier_id, warehouse_id, status, expected_at, total_minor,
				idempotency_key, request_hash, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
			o.ID, o.TenantID, o.SupplierID, o.WarehouseID, int16(domain.PODraft), o.ExpectedAt, o.TotalMinor,
			key, hash, by, now); err != nil {
			return fmt.Errorf("insert purchase order: %w", err)
		}
		for _, l := range o.Lines {
			if _, err := tx.Exec(ctx, `
				INSERT INTO purchase_order_lines (purchase_order_id, tenant_id, product_id, ordered_milli, unit_cost_minor)
				VALUES ($1,$2,$3,$4,$5)`, o.ID, o.TenantID, l.ProductID, l.OrderedMilli, l.UnitCostMinor); err != nil {
				return fmt.Errorf("insert line: %w", err)
			}
		}
		out, err = getPO(ctx, tx, o.ID, false)
		return err
	})
	return out, err
}

// GetPurchaseOrder devuelve una orden del negocio con sus líneas.
func (s *Store) GetPurchaseOrder(ctx context.Context, tenantID, id string) (domain.PurchaseOrder, error) {
	var out domain.PurchaseOrder
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		out, err = getPO(ctx, tx, id, false)
		return err
	})
	return out, err
}

// ListPurchaseOrders de la más nueva a la más vieja (cursor = id de la última).
func (s *Store) ListPurchaseOrders(ctx context.Context, tenantID string, status domain.POStatus, after string, limit int) ([]domain.PurchaseOrder, string, error) {
	var out []domain.PurchaseOrder
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+poCols+` FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id
			WHERE ($1 = 0 OR o.status = $1)
			  AND ($2 = '' OR (o.created_at, o.id) < (SELECT created_at, id FROM purchase_orders WHERE id::text = $2))
			ORDER BY o.created_at DESC, o.id DESC LIMIT $3`, int16(status), after, limit+1)
		if err != nil {
			return fmt.Errorf("list purchase orders: %w", err)
		}
		for rows.Next() {
			o, err := scanPO(rows)
			if err != nil {
				rows.Close()
				return err
			}
			out = append(out, o)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for i := range out {
			if err := loadLines(ctx, tx, &out[i], false); err != nil {
				return err
			}
		}
		return nil
	})
	next := ""
	if len(out) > limit {
		out = out[:limit]
		next = out[limit-1].ID
	}
	return out, next, err
}

// UpdatePurchaseOrderStatus aplica un cambio pedido por una persona (enviar o cancelar).
func (s *Store) UpdatePurchaseOrderStatus(ctx context.Context, tenantID, id string, to domain.POStatus, now time.Time) (domain.PurchaseOrder, error) {
	var out domain.PurchaseOrder
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		o, err := getPO(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if o.Status == to {
			out = o
			return nil // reintento
		}
		if !o.Status.CanChangeTo(to) {
			return domain.ErrPOTransition
		}
		if _, err := tx.Exec(ctx, `UPDATE purchase_orders SET status = $2, updated_at = $3, version = version + 1 WHERE id = $1`,
			o.ID, int16(to), now); err != nil {
			return fmt.Errorf("update purchase order: %w", err)
		}
		out, err = getPO(ctx, tx, id, false)
		return err
	})
	return out, err
}

// ReceiptHook devuelve el gancho de Apply que registra la recepción en la misma transacción que los
// movimientos RECEIPT: bloquea la orden, aplica la recepción (sin pasar lo pedido) y guarda el
// nuevo estado. Los movimientos van a la bodega de la orden (PurchaseOrderWarehouse); si la orden
// cambió de bodega entre la lectura y el bloqueo, la recepción se rechaza.
func ReceiptHook(tenantID, poID, receiptID, invoice, key string, hash []byte, createdBy string, in []domain.Received,
	now time.Time, warehouseID string) func(ctx context.Context, tx pgx.Tx) error {
	return func(ctx context.Context, tx pgx.Tx) error {
		o, err := getPO(ctx, tx, poID, true)
		if err != nil {
			return err
		}
		if o.WarehouseID != warehouseID {
			return domain.ErrInvalidWarehouse
		}
		if err := o.Receive(in); err != nil {
			return err
		}
		for _, l := range o.Lines {
			if _, err := tx.Exec(ctx, `UPDATE purchase_order_lines SET received_milli = $3
				WHERE purchase_order_id = $1 AND product_id = $2`, o.ID, l.ProductID, l.ReceivedMilli); err != nil {
				return fmt.Errorf("update received: %w", err)
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE purchase_orders SET status = $2, updated_at = $3, version = version + 1 WHERE id = $1`,
			o.ID, int16(o.Status), now); err != nil {
			return fmt.Errorf("update order status: %w", err)
		}
		var by any
		if createdBy != "" {
			by = createdBy
		}
		if _, err := tx.Exec(ctx, `INSERT INTO purchase_receipts (id, tenant_id, purchase_order_id, supplier_invoice,
				idempotency_key, request_hash, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			receiptID, tenantID, o.ID, invoice, key, hash, by, now); err != nil {
			return fmt.Errorf("insert receipt: %w", err)
		}
		return nil
	}
}

// PurchaseOrderWarehouse lee la bodega de una orden (para armar los movimientos antes de aplicar).
func (s *Store) PurchaseOrderWarehouse(ctx context.Context, tenantID, id string) (string, error) {
	var wh string
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `SELECT warehouse_id::text FROM purchase_orders WHERE id::text = $1`, id).Scan(&wh)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	})
	return wh, err
}

// ── Reorden (R6) ────────────────────────────────────────────────────────────────────────

// ReorderRow son los datos de R6 de un producto en una bodega.
type ReorderRow struct {
	ProductID      string
	WarehouseID    string
	AvailableMilli int64
	ReorderPoint   int64
	InTransitMilli int64
	SupplierID     string
	SupplierName   string
	LeadTimeDays   int
	Daily          []int64 // ventas por día, del más antiguo al de hoy (VelocityWindowDays)
}

// ReorderData junta existencias, lo que viene en camino, el proveedor habitual (el de la última
// orden con el producto) y las ventas diarias de los 28 días completos anteriores a hoy, en hora de
// Panamá (hoy va a medias: contarlo bajaría la velocidad).
func (s *Store) ReorderData(ctx context.Context, tenantID, warehouseID string, now time.Time) ([]ReorderRow, error) {
	var out []ReorderRow
	err := s.inTenant(ctx, tenantID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT l.product_id::text, l.warehouse_id::text, l.on_hand_milli - l.reserved_milli, l.reorder_point_milli,
			  coalesce((SELECT sum(pl.ordered_milli - pl.received_milli) FROM purchase_order_lines pl
			            JOIN purchase_orders po ON po.id = pl.purchase_order_id
			            WHERE pl.product_id = l.product_id AND po.warehouse_id = l.warehouse_id AND po.status IN (2, 3)), 0)::bigint,
			  coalesce(last.supplier_id, ''), coalesce(last.name, ''), coalesce(last.lead_time_days, $2)
			FROM stock_levels l
			LEFT JOIN LATERAL (
			  SELECT s.id::text AS supplier_id, s.name, s.lead_time_days FROM purchase_order_lines pl
			  JOIN purchase_orders po ON po.id = pl.purchase_order_id JOIN suppliers s ON s.id = po.supplier_id
			  WHERE pl.product_id = l.product_id AND po.status <> 5 ORDER BY po.created_at DESC LIMIT 1) last ON true
			WHERE ($1 = '' OR l.warehouse_id::text = $1)
			ORDER BY l.product_id, l.warehouse_id`, warehouseID, domain.DefaultLeadTimeDays)
		if err != nil {
			return fmt.Errorf("reorder data: %w", err)
		}
		idx := map[string]int{}
		for rows.Next() {
			var r ReorderRow
			if err := rows.Scan(&r.ProductID, &r.WarehouseID, &r.AvailableMilli, &r.ReorderPoint, &r.InTransitMilli,
				&r.SupplierID, &r.SupplierName, &r.LeadTimeDays); err != nil {
				rows.Close()
				return fmt.Errorf("scan reorder row: %w", err)
			}
			r.Daily = make([]int64, domain.VelocityWindowDays)
			idx[r.WarehouseID+"/"+r.ProductID] = len(out)
			out = append(out, r)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		sales, err := tx.Query(ctx, `
			SELECT product_id::text, warehouse_id::text,
			  ((($2::timestamptz AT TIME ZONE 'America/Panama')::date) - ((created_at AT TIME ZONE 'America/Panama')::date)) AS ago,
			  -sum(delta_milli)::bigint
			FROM movements
			WHERE type = 2 AND created_at > $2::timestamptz - make_interval(days => $3 + 1) AND ($1 = '' OR warehouse_id::text = $1)
			GROUP BY 1, 2, 3`, warehouseID, now, domain.VelocityWindowDays)
		if err != nil {
			return fmt.Errorf("daily sales: %w", err)
		}
		defer sales.Close()
		for sales.Next() {
			var p, w string
			var ago int
			var sold int64
			if err := sales.Scan(&p, &w, &ago, &sold); err != nil {
				return fmt.Errorf("scan daily sales: %w", err)
			}
			i, ok := idx[w+"/"+p]
			if !ok || ago < 1 || ago > domain.VelocityWindowDays {
				continue
			}
			out[i].Daily[domain.VelocityWindowDays-ago] += sold
		}
		return sales.Err()
	})
	return out, err
}
