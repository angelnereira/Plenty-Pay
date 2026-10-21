package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/store"
)

// validKey: clave de idempotencia de 16 a 100 caracteres (grpc-conventions §3).
func validKey(k string) bool { return len(k) >= 16 && len(k) <= 100 }

// UpsertSupplier crea (con clave) o actualiza (con id) un proveedor del negocio (S-INV-07).
func (s *Inventory) UpsertSupplier(ctx context.Context, c Caller, sup domain.Supplier, key string) (domain.Supplier, error) {
	sup = sup.Normalize()
	sup.TenantID = c.TenantID
	if err := sup.Validate(); err != nil {
		return sup, err
	}
	if sup.ID != "" {
		return s.store.UpdateSupplier(ctx, sup, s.now())
	}
	if !validKey(key) {
		return sup, domain.ErrInvalidSupplier
	}
	sup.ID, sup.Active = s.newID(), true
	return s.store.CreateSupplier(ctx, sup, key, s.now())
}

// ListSuppliers del negocio.
func (s *Inventory) ListSuppliers(ctx context.Context, tenantID, after string, limit int) ([]domain.Supplier, string, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	return s.store.ListSuppliers(ctx, tenantID, after, limit)
}

// CreatePurchaseOrder valida los productos (existen, activos, con inventario) y guarda el borrador
// con su total (S-INV-05). Idempotente por clave.
func (s *Inventory) CreatePurchaseOrder(ctx context.Context, c Caller, o domain.PurchaseOrder, key string) (domain.PurchaseOrder, error) {
	if !validKey(key) {
		return o, domain.ErrInvalidOrder
	}
	o.TenantID, o.ID, o.Status = c.TenantID, s.newID(), domain.PODraft
	if o.WarehouseID == "" {
		w, err := s.store.DefaultWarehouse(ctx, c.TenantID, s.newID(), s.now())
		if err != nil {
			return o, err
		}
		o.WarehouseID = w.ID
	}
	if err := o.Prepare(); err != nil {
		return o, err
	}
	parts := []string{"po", o.SupplierID, o.WarehouseID}
	if o.ExpectedAt != nil {
		parts = append(parts, o.ExpectedAt.UTC().Format(time.RFC3339))
	}
	lines := append([]domain.POLine(nil), o.Lines...)
	sort.Slice(lines, func(i, j int) bool { return lines[i].ProductID < lines[j].ProductID })
	for _, l := range lines {
		if err := s.validateProduct(ctx, l.ProductID, domain.Receipt); err != nil {
			return o, err
		}
		parts = append(parts, fmt.Sprintf("%s:%d:%d", l.ProductID, l.OrderedMilli, l.UnitCostMinor))
	}
	return s.store.CreatePurchaseOrder(ctx, o, key, requestHash(parts...), c.UserID, s.now())
}

// GetPurchaseOrder del negocio.
func (s *Inventory) GetPurchaseOrder(ctx context.Context, tenantID, id string) (domain.PurchaseOrder, error) {
	return s.store.GetPurchaseOrder(ctx, tenantID, id)
}

// ListPurchaseOrders del negocio, opcionalmente por estado.
func (s *Inventory) ListPurchaseOrders(ctx context.Context, tenantID string, status domain.POStatus, after string, limit int) ([]domain.PurchaseOrder, string, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.store.ListPurchaseOrders(ctx, tenantID, status, after, limit)
}

// UpdatePurchaseOrderStatus: enviar o cancelar (domain-model §8.12).
func (s *Inventory) UpdatePurchaseOrderStatus(ctx context.Context, tenantID, id string, to domain.POStatus) (domain.PurchaseOrder, error) {
	return s.store.UpdatePurchaseOrderStatus(ctx, tenantID, id, to, s.now())
}

// ReceiveGoods registra la recepción (S-INV-06): un movimiento RECEIPT por línea en la bodega de la
// orden y la orden actualizada, todo en una transacción. Idempotente por clave.
func (s *Inventory) ReceiveGoods(ctx context.Context, c Caller, poID, key, invoice string, in []domain.Received) (domain.PurchaseOrder, error) {
	invoice = strings.TrimSpace(invoice)
	if !validKey(key) || len(in) == 0 || len(in) > 200 || len([]rune(invoice)) > 60 {
		return domain.PurchaseOrder{}, domain.ErrInvalidOrder
	}
	wh, err := s.store.PurchaseOrderWarehouse(ctx, c.TenantID, poID)
	if err != nil {
		return domain.PurchaseOrder{}, err
	}
	parts := []string{"receipt", poID, invoice}
	moves := make([]domain.Movement, 0, len(in))
	seen := map[string]bool{}
	for _, r := range in {
		if seen[r.ProductID] {
			return domain.PurchaseOrder{}, domain.ErrInvalidOrder
		}
		seen[r.ProductID] = true
		m := domain.Movement{ID: s.newID(), WarehouseID: wh, ProductID: r.ProductID, Type: domain.Receipt,
			DeltaMilli: r.ReceivedMilli, ReferenceType: "purchase_order", ReferenceID: poID, ActorUserID: c.UserID,
			ActorService: c.Service, Reason: "recepción de compra"}
		if err := m.Validate(); err != nil {
			return domain.PurchaseOrder{}, err
		}
		parts = append(parts, fmt.Sprintf("%s:%d", r.ProductID, r.ReceivedMilli))
		moves = append(moves, m)
	}
	hash := requestHash(parts...)
	now := s.now()
	if _, err := s.store.Apply(ctx, store.Batch{
		TenantID: c.TenantID, IdempotencyKey: key, RequestHash: hash, Movements: moves, NewWarehouseID: s.newID(), Now: now,
		Hook: store.ReceiptHook(c.TenantID, poID, s.newID(), invoice, key, hash, c.UserID, in, now, wh),
	}, s.eventsFor); err != nil {
		return domain.PurchaseOrder{}, err
	}
	return s.store.GetPurchaseOrder(ctx, c.TenantID, poID)
}

// ReorderSuggestions aplica R6 a las existencias del negocio (o de una bodega): solo productos con
// algo que pedir, de la menor a la mayor cobertura.
func (s *Inventory) ReorderSuggestions(ctx context.Context, tenantID, warehouseID string) ([]domain.Suggestion, map[string]store.ReorderRow, error) {
	rows, err := s.store.ReorderData(ctx, tenantID, warehouseID, s.now())
	if err != nil {
		return nil, nil, err
	}
	sold := map[string]int64{}
	for _, r := range rows {
		for _, d := range r.Daily {
			sold[r.ProductID] += d
		}
	}
	abc := domain.ClassifyABC(sold)
	byKey := map[string]store.ReorderRow{}
	var out []domain.Suggestion
	for _, r := range rows {
		v := domain.Velocity(r.Daily)
		cover, qty := domain.Suggest(r.AvailableMilli, r.InTransitMilli, v, r.LeadTimeDays)
		if qty <= 0 {
			continue
		}
		byKey[r.WarehouseID+"/"+r.ProductID] = r
		out = append(out, domain.Suggestion{ProductID: r.ProductID, WarehouseID: r.WarehouseID,
			AvailableMilli: r.AvailableMilli, InTransitMilli: r.InTransitMilli, VelocityMilli: v, DaysOfCover: cover,
			SuggestedMilli: qty, LeadTimeDays: r.LeadTimeDays, ABC: abc[r.ProductID]})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].DaysOfCover != out[j].DaysOfCover {
			return out[i].DaysOfCover < out[j].DaysOfCover
		}
		return out[i].ProductID < out[j].ProductID
	})
	return out, byKey, nil
}
