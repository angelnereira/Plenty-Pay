package domain

import "errors"

var ErrInsufficientStock = errors.New("insufficient stock")
var ErrInvalidQty = errors.New("qty must be > 0")

type StockLevel struct {
	VariantID  string
	WarehouseID string
	TenantID   string
	OnHand     int64
	Reserved   int64
}

func (s *StockLevel) Available() int64 {
	return s.OnHand - s.Reserved
}

func (s *StockLevel) Reserve(qty int64) error {
	if qty <= 0 {
		return ErrInvalidQty
	}
	if s.Available() < qty {
		return ErrInsufficientStock
	}
	s.Reserved += qty
	return nil
}

func (s *StockLevel) Release(qty int64) {
	s.Reserved -= qty
	if s.Reserved < 0 {
		s.Reserved = 0
	}
}

func (s *StockLevel) Adjust(qty int64) {
	s.OnHand += qty
	if s.OnHand < 0 {
		s.OnHand = 0
	}
}

type Movement struct {
	ID          string
	TenantID    string
	VariantID   string
	WarehouseID string
	MovementType string
	Qty         int64
	Reason      string
}

func (m Movement) Validate() error {
	if m.TenantID == "" || m.VariantID == "" || m.WarehouseID == "" {
		return ErrInvalidMovement
	}
	if m.Qty == 0 {
		return ErrInvalidQty
	}
	return nil
}

var ErrInvalidMovement = errors.New("invalid movement")

type Reservation struct {
	ID          string
	TenantID    string
	VariantID   string
	WarehouseID string
	Qty         int64
	Status      string
}

func (r Reservation) Validate() error {
	if r.TenantID == "" || r.VariantID == "" || r.WarehouseID == "" {
		return ErrInvalidReservation
	}
	if r.Qty <= 0 {
		return ErrInvalidQty
	}
	return nil
}

var ErrInvalidReservation = errors.New("invalid reservation")

type Transfer struct {
	ID          string
	TenantID    string
	VariantID   string
	FromWarehouse string
	ToWarehouse   string
	Qty         int64
}

func (t Transfer) Validate() error {
	if t.TenantID == "" || t.VariantID == "" || t.FromWarehouse == "" || t.ToWarehouse == "" {
		return ErrInvalidTransfer
	}
	if t.Qty <= 0 {
		return ErrInvalidQty
	}
	if t.FromWarehouse == t.ToWarehouse {
		return ErrInvalidTransfer
	}
	return nil
}

var ErrInvalidTransfer = errors.New("invalid transfer")

type Supplier struct {
	ID       string
	TenantID string
	Name     string
}

func (s Supplier) Validate() error {
	if s.TenantID == "" || s.Name == "" {
		return ErrInvalidSupplier
	}
	return nil
}

var ErrInvalidSupplier = errors.New("invalid supplier")

type PurchaseOrder struct {
	ID         string
	TenantID   string
	SupplierID string
	Status     string
}

func (po PurchaseOrder) Validate() error {
	if po.TenantID == "" || po.SupplierID == "" {
		return ErrInvalidPurchaseOrder
	}
	return nil
}

var ErrInvalidPurchaseOrder = errors.New("invalid purchase order")

type ReorderSuggestion struct {
	VariantID   string
	WarehouseID string
	CurrentStock int64
	ReorderPoint int64
	SuggestedQty int64
}

func (r ReorderSuggestion) ShouldReorder() bool {
	return r.CurrentStock <= r.ReorderPoint
}
