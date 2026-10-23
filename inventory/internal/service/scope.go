package service

import (
	"context"
	"fmt"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/store"
)

// F16.9 (R11, ADR 0018): alcance por sucursal de quien llega por el gateway. El servidor lo pone
// en el contexto de cada petición de una persona; las llamadas de servicio (pos, orders) y las
// pruebas que llaman al servicio directamente no lo llevan y no se filtran.

type scopeKey struct{}

// WithBranchScope marca la petición con el alcance de la persona.
func WithBranchScope(ctx context.Context, sc domain.BranchScope) context.Context {
	return context.WithValue(ctx, scopeKey{}, sc)
}

// BranchScopeFrom devuelve el alcance de la petición (false = servicio o prueba, sin filtro).
func BranchScopeFrom(ctx context.Context) (domain.BranchScope, bool) { return scopeFrom(ctx) }

func scopeFrom(ctx context.Context) (domain.BranchScope, bool) {
	sc, ok := ctx.Value(scopeKey{}).(domain.BranchScope)
	return sc, ok
}

// Branches lista las sucursales visibles para la persona que llama (identity.ListBranches con su
// identidad; R11).
type Branches interface {
	ListBranches(ctx context.Context) ([]domain.Branch, error)
}

// UseBranches conecta identity (F16.9). Sin él, crear una bodega con alcance `*` no puede validar
// la sucursal y la Casa Matriz no se asigna.
func (s *Inventory) UseBranches(b Branches) { s.branches = b }

// visibleWarehouses: bodegas que la persona alcanza; nil = todas (servicio, prueba o alcance `*`).
func (s *Inventory) visibleWarehouses(ctx context.Context, tenantID string) (store.WarehouseSet, error) {
	sc, ok := scopeFrom(ctx)
	if !ok || sc.All {
		return nil, nil
	}
	ws, err := s.store.ListWarehouses(ctx, tenantID, s.newID(), s.now())
	if err != nil {
		return nil, err
	}
	out := store.WarehouseSet{}
	for _, w := range ws {
		if sc.Allows(w.BranchID) {
			out = append(out, w.ID)
		}
	}
	return out, nil
}

// requireWarehouse: la bodega (vacía = la por defecto) está en el alcance; devuelve su id.
func (s *Inventory) requireWarehouse(ctx context.Context, tenantID, warehouseID string) (string, error) {
	set, err := s.visibleWarehouses(ctx, tenantID)
	if err != nil || set == nil {
		return warehouseID, err
	}
	if warehouseID == "" {
		w, err := s.store.DefaultWarehouse(ctx, tenantID, s.newID(), s.now())
		if err != nil {
			return "", err
		}
		warehouseID = w.ID
	}
	if !set.Contains(warehouseID) {
		return "", domain.ErrBranchOutOfScope
	}
	return warehouseID, nil
}

// readScope: para una lectura con filtro de bodega opcional, el conjunto a consultar (nil = todas)
// o ErrBranchOutOfScope si la bodega pedida está fuera.
func (s *Inventory) readScope(ctx context.Context, tenantID, warehouseID string) (store.WarehouseSet, error) {
	set, err := s.visibleWarehouses(ctx, tenantID)
	if err != nil || set == nil {
		return set, err
	}
	if warehouseID != "" && !set.Contains(warehouseID) {
		return nil, domain.ErrBranchOutOfScope
	}
	return set, nil
}

// assignMainBranch pone la Casa Matriz a las bodegas sin sucursal (solo con alcance `*`, R11).
// Si identity no responde, la lista sigue funcionando y la asignación espera a la próxima vez.
func (s *Inventory) assignMainBranch(ctx context.Context, tenantID string, ws []domain.Warehouse) ([]domain.Warehouse, error) {
	pending := false
	for _, w := range ws {
		if w.BranchID == "" {
			pending = true
			break
		}
	}
	if !pending || s.branches == nil {
		return ws, nil
	}
	list, err := s.branches.ListBranches(ctx)
	if err != nil {
		return ws, fmt.Errorf("list branches for main branch: %w", err)
	}
	main := ""
	for _, b := range list {
		if b.Code == domain.MainBranchCode {
			main = b.ID
			break
		}
	}
	if main == "" {
		return ws, nil // sin Casa Matriz visible: nada que asignar
	}
	if _, err := s.store.AssignMainBranch(ctx, tenantID, main, s.now()); err != nil {
		return ws, err
	}
	for i := range ws {
		if ws[i].BranchID == "" {
			ws[i].BranchID = main
		}
	}
	return ws, nil
}

// checkBranchForWarehouse: la sucursal de una bodega que se crea o edita es válida para la persona.
func (s *Inventory) checkBranchForWarehouse(ctx context.Context, branchID string) error {
	sc, ok := scopeFrom(ctx)
	if !ok {
		return nil // servicio o prueba: sin validación de alcance
	}
	if branchID == "" {
		return domain.ErrInvalidWarehouse
	}
	if !sc.All {
		if !sc.Allows(branchID) {
			return domain.ErrBranchOutOfScope
		}
		return nil
	}
	if s.branches == nil {
		return fmt.Errorf("%w: identity", ErrBranchesUnavailable)
	}
	list, err := s.branches.ListBranches(ctx)
	if err != nil {
		return err
	}
	for _, b := range list {
		if b.ID == branchID && b.Active {
			return nil
		}
	}
	return domain.ErrBranchOutOfScope
}
