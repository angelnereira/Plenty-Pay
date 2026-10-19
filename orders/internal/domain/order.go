package domain

import "errors"

// OrderStatus per domain-model.md §8.10.
type OrderStatus int

const (
	OrderCreated OrderStatus = iota + 1
	OrderPendingAcceptance
	OrderAccepted
	OrderPreparing
	OrderReadyForPickup
	OrderOutForDelivery
	OrderDelivered
	OrderCompleted
	OrderRejected
	OrderCancelled
	OrderRefunded
)

func (s OrderStatus) String() string {
	names := []string{"", "CREATED", "PENDING_ACCEPTANCE", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "REJECTED", "CANCELLED", "REFUNDED"}
	if int(s) < len(names) {
		return names[s]
	}
	return "UNKNOWN"
}

// CanTransition checks if a status transition is valid.
func (s OrderStatus) CanTransition(to OrderStatus) bool {
	// simplified: terminal states can't transition
	switch s {
	case OrderCompleted, OrderRejected, OrderCancelled, OrderRefunded:
		return false
	case OrderCreated:
		return to == OrderPendingAcceptance || to == OrderCancelled
	case OrderPendingAcceptance:
		return to == OrderAccepted || to == OrderRejected || to == OrderCancelled
	case OrderAccepted:
		return to == OrderPreparing || to == OrderCancelled
	case OrderPreparing:
		return to == OrderReadyForPickup || to == OrderOutForDelivery || to == OrderCancelled
	case OrderReadyForPickup:
		return to == OrderCompleted || to == OrderCancelled
	case OrderOutForDelivery:
		return to == OrderDelivered || to == OrderCancelled
	case OrderDelivered:
		return to == OrderCompleted
	}
	return false
}

// CartItem represents an item in a user's cart.
type CartItem struct {
	UserID    string
	ListingID string
	TenantID  string
	VariantID string
	QtyMilli  int64
}

func (c CartItem) Validate() error {
	if c.UserID == "" || c.ListingID == "" || c.TenantID == "" {
		return ErrInvalidCart
	}
	if c.QtyMilli <= 0 {
		return ErrInvalidQty
	}
	return nil
}

var ErrInvalidCart = errors.New("invalid cart item")
var ErrInvalidQty = errors.New("qty must be > 0")

// Order represents a marketplace order.
type Order struct {
	ID            string
	BuyerUserID   string
	Status        OrderStatus
	Currency      string
	ItemsMinor    int64
	ShippingMinor int64
	DiscountMinor int64
	TotalMinor    int64
	RejectedReason string
}

func (o Order) Validate() error {
	if o.BuyerUserID == "" {
		return ErrInvalidOrder
	}
	if o.TotalMinor < 0 {
		return ErrInvalidOrder
	}
	return nil
}

var ErrInvalidOrder = errors.New("invalid order")

// Checkout validates and creates an order from cart items.
func Checkout(userID string, items []CartItem) (Order, error) {
	if userID == "" {
		return Order{}, ErrInvalidOrder
	}
	if len(items) == 0 {
		return Order{}, ErrInvalidOrder
	}
	var itemsMinor int64
	for _, ci := range items {
		if err := ci.Validate(); err != nil {
			return Order{}, err
		}
		itemsMinor += ci.QtyMilli // simplified
	}
	return Order{
		ID:          "order-1",
		BuyerUserID: userID,
		Status:      OrderCreated,
		Currency:    "USD",
		ItemsMinor:  itemsMinor,
		TotalMinor:  itemsMinor,
	}, nil
}

// AcceptOrder transitions an order to ACCEPTED.
func AcceptOrder(o Order) (Order, error) {
	if !o.Status.CanTransition(OrderAccepted) {
		return o, errors.New("invalid state transition")
	}
	o.Status = OrderAccepted
	return o, nil
}

// RejectOrder transitions an order to REJECTED with a reason.
func RejectOrder(o Order, reason string) (Order, error) {
	if !o.Status.CanTransition(OrderRejected) {
		return o, errors.New("invalid state transition")
	}
	o.Status = OrderRejected
	o.RejectedReason = reason
	return o, nil
}

// MarkReady transitions an order to READY_FOR_PICKUP.
func MarkReady(o Order) (Order, error) {
	if !o.Status.CanTransition(OrderReadyForPickup) {
		return o, errors.New("invalid state transition")
	}
	o.Status = OrderReadyForPickup
	return o, nil
}
