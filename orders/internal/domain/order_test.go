package domain

import "testing"

func TestOrderStatus_CanTransition(t *testing.T) {
	if !OrderCreated.CanTransition(OrderPendingAcceptance) {
		t.Fatal("CREATED -> PENDING_ACCEPTANCE should be valid")
	}
	if OrderCompleted.CanTransition(OrderCancelled) {
		t.Fatal("COMPLETED -> CANCELLED should be invalid")
	}
	if !OrderPendingAcceptance.CanTransition(OrderAccepted) {
		t.Fatal("PENDING_ACCEPTANCE -> ACCEPTED should be valid")
	}
	if !OrderPendingAcceptance.CanTransition(OrderRejected) {
		t.Fatal("PENDING_ACCEPTANCE -> REJECTED should be valid")
	}
}

func TestCartItem_Validate_OK(t *testing.T) {
	c := CartItem{UserID: "u1", ListingID: "l1", TenantID: "t1", QtyMilli: 1000}
	if err := c.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestCartItem_Validate_InvalidQty(t *testing.T) {
	c := CartItem{UserID: "u1", ListingID: "l1", TenantID: "t1", QtyMilli: 0}
	if err := c.Validate(); err != ErrInvalidQty {
		t.Fatalf("expected ErrInvalidQty, got %v", err)
	}
}

func TestOrder_Validate_OK(t *testing.T) {
	o := Order{BuyerUserID: "u1", TotalMinor: 1000}
	if err := o.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestCheckout_OK(t *testing.T) {
	items := []CartItem{{UserID: "u1", ListingID: "l1", TenantID: "t1", QtyMilli: 1000}}
	o, err := Checkout("u1", items)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if o.Status != OrderCreated {
		t.Fatalf("expected CREATED, got %v", o.Status)
	}
}

func TestCheckout_EmptyCart(t *testing.T) {
	_, err := Checkout("u1", nil)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestAcceptOrder_OK(t *testing.T) {
	o := Order{BuyerUserID: "u1", Status: OrderPendingAcceptance}
	o2, err := AcceptOrder(o)
	if err != nil || o2.Status != OrderAccepted {
		t.Fatalf("expected ACCEPTED, got %v, %v", o2.Status, err)
	}
}

func TestRejectOrder_OK(t *testing.T) {
	o := Order{BuyerUserID: "u1", Status: OrderPendingAcceptance}
	o2, err := RejectOrder(o, "out of stock")
	if err != nil || o2.Status != OrderRejected {
		t.Fatalf("expected REJECTED, got %v, %v", o2.Status, err)
	}
	if o2.RejectedReason != "out of stock" {
		t.Fatalf("bad reason: %s", o2.RejectedReason)
	}
}

func TestAcceptOrder_InvalidTransition(t *testing.T) {
	o := Order{BuyerUserID: "u1", Status: OrderCompleted}
	_, err := AcceptOrder(o)
	if err == nil {
		t.Fatal("expected error")
	}
}
