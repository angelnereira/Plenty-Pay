package domain

import (
	"errors"
	"testing"
)

func TestR8_OrderStatusIsDerivedFromSubOrders(t *testing.T) {
	cases := []struct {
		paid bool
		subs []SubStatus
		want OrderStatus
	}{
		{false, []SubStatus{SubPendingPayment, SubPendingPayment}, OrderPendingPayment},
		{false, []SubStatus{SubCancelled, SubCancelled}, OrderCancelled},
		{true, []SubStatus{SubAwaitingAcceptance, SubAccepted}, OrderPaid},
		{true, []SubStatus{SubAccepted, SubRejected}, OrderPartiallyFulfilled},
		{true, []SubStatus{SubCompleted, SubReady}, OrderPartiallyFulfilled},
		{true, []SubStatus{SubCompleted, SubRejected}, OrderCompleted},
		{true, []SubStatus{SubRejected, SubCancelled}, OrderRefunded},
		{true, []SubStatus{SubCompleted, SubCompleted}, OrderCompleted},
	}
	for _, c := range cases {
		if got := Derive(c.paid, c.subs); got != c.want {
			t.Errorf("paid=%v %v → %v, se esperaba %v", c.paid, c.subs, got, c.want)
		}
	}
}

func TestSPEC8_10_SubOrderTransitions(t *testing.T) {
	if !SubAwaitingAcceptance.CanTransition(SubAccepted) || !SubAwaitingAcceptance.CanTransition(SubRejected) {
		t.Fatal("aceptar o rechazar desde la espera")
	}
	if SubPendingPayment.CanTransition(SubAccepted) {
		t.Fatal("no se acepta un pedido sin pagar")
	}
	if SubCompleted.CanTransition(SubRejected) || SubRejected.CanTransition(SubAccepted) {
		t.Fatal("los terminales no cambian")
	}
}

func TestSPEC4_CartLimits(t *testing.T) {
	var items []CartItem
	for i := 0; i < MaxCartLines+1; i++ {
		items = append(items, CartItem{TenantID: "t"})
	}
	if !errors.Is(CheckCartLimits(items), ErrCartLimit) {
		t.Fatal("51 líneas")
	}
	items = nil
	for i := 0; i < MaxCartMerchants+1; i++ {
		items = append(items, CartItem{TenantID: string(rune('a' + i))})
	}
	if !errors.Is(CheckCartLimits(items), ErrCartLimit) {
		t.Fatal("11 comercios")
	}
}

func TestR1_LineSnapshotWithTaxIncluded(t *testing.T) {
	l := Line{UnitPriceMinor: 1070, QtyMilli: 2000, TaxRateBps: 700}
	if err := l.Price(); err != nil || l.TotalMinor != 2140 || l.TaxMinor != 140 {
		t.Fatalf("%v %+v", err, l)
	}
	q := Quote{Merchants: []MerchantQuote{{Lines: []Line{l}}, {Lines: []Line{{TotalMinor: 500}}, Unavailable: []string{"p"}}}}
	if err := q.Sum(); err != nil || q.TotalMinor != 2640 || q.Merchants[0].AllInStock != true || q.Merchants[1].AllInStock {
		t.Fatalf("%v %+v", err, q)
	}
}
