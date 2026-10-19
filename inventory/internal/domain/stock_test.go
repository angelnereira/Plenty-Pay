package domain

import "testing"

func TestStockLevel_Available(t *testing.T) {
	s := StockLevel{OnHand: 100, Reserved: 30}
	if s.Available() != 70 {
		t.Fatalf("expected 70, got %d", s.Available())
	}
}

func TestStockLevel_Reserve_OK(t *testing.T) {
	s := StockLevel{OnHand: 100, Reserved: 0}
	if err := s.Reserve(30); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if s.Reserved != 30 {
		t.Fatalf("expected 30, got %d", s.Reserved)
	}
}

func TestStockLevel_Reserve_Insufficient(t *testing.T) {
	s := StockLevel{OnHand: 10, Reserved: 0}
	if err := s.Reserve(20); err != ErrInsufficientStock {
		t.Fatalf("expected ErrInsufficientStock, got %v", err)
	}
}

func TestStockLevel_Release(t *testing.T) {
	s := StockLevel{OnHand: 100, Reserved: 30}
	s.Release(10)
	if s.Reserved != 20 {
		t.Fatalf("expected 20, got %d", s.Reserved)
	}
}

func TestStockLevel_Adjust(t *testing.T) {
	s := StockLevel{OnHand: 100}
	s.Adjust(-20)
	if s.OnHand != 80 {
		t.Fatalf("expected 80, got %d", s.OnHand)
	}
}

func TestMovement_Validate_OK(t *testing.T) {
	m := Movement{TenantID: "t1", VariantID: "v1", WarehouseID: "w1", Qty: 10}
	if err := m.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestMovement_Validate_EmptyTenant(t *testing.T) {
	m := Movement{VariantID: "v1", WarehouseID: "w1", Qty: 10}
	if err := m.Validate(); err != ErrInvalidMovement {
		t.Fatalf("expected ErrInvalidMovement, got %v", err)
	}
}

func TestReservation_Validate_OK(t *testing.T) {
	r := Reservation{TenantID: "t1", VariantID: "v1", WarehouseID: "w1", Qty: 5}
	if err := r.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestReservation_Validate_InvalidQty(t *testing.T) {
	r := Reservation{TenantID: "t1", VariantID: "v1", WarehouseID: "w1", Qty: 0}
	if err := r.Validate(); err != ErrInvalidQty {
		t.Fatalf("expected ErrInvalidQty, got %v", err)
	}
}

func TestTransfer_Validate_OK(t *testing.T) {
	tr := Transfer{TenantID: "t1", VariantID: "v1", FromWarehouse: "w1", ToWarehouse: "w2", Qty: 5}
	if err := tr.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestTransfer_Validate_SameWarehouse(t *testing.T) {
	tr := Transfer{TenantID: "t1", VariantID: "v1", FromWarehouse: "w1", ToWarehouse: "w1", Qty: 5}
	if err := tr.Validate(); err != ErrInvalidTransfer {
		t.Fatalf("expected ErrInvalidTransfer, got %v", err)
	}
}

func TestSupplier_Validate_OK(t *testing.T) {
	s := Supplier{TenantID: "t1", Name: "Acme"}
	if err := s.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestPurchaseOrder_Validate_OK(t *testing.T) {
	po := PurchaseOrder{TenantID: "t1", SupplierID: "s1", Status: "DRAFT"}
	if err := po.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestReorderSuggestion_ShouldReorder(t *testing.T) {
	r := ReorderSuggestion{CurrentStock: 5, ReorderPoint: 10}
	if !r.ShouldReorder() {
		t.Fatal("expected should reorder")
	}
	r2 := ReorderSuggestion{CurrentStock: 15, ReorderPoint: 10}
	if r2.ShouldReorder() {
		t.Fatal("expected should not reorder")
	}
}
