package domain

import "testing"

func TestComputeSaleTotals_OK(t *testing.T) {
	bases := []int64{10000, 5000}
	rates := []uint32{700, 0}
	tot, err := ComputeSaleTotals(bases, rates, 0)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if tot.SubtotalMinor != 15000 {
		t.Fatalf("expected subtotal 15000, got %d", tot.SubtotalMinor)
	}
	if tot.TotalMinor != tot.SubtotalMinor+tot.TaxMinor {
		t.Fatalf("total mismatch")
	}
}

func TestComputeSaleTotals_Discount(t *testing.T) {
	bases := []int64{10000}
	rates := []uint32{700}
	tot, err := ComputeSaleTotals(bases, rates, 500)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if tot.TotalMinor != tot.SubtotalMinor+tot.TaxMinor-500 {
		t.Fatalf("discount not applied")
	}
}

func TestComputeSaleTotals_MismatchedLengths(t *testing.T) {
	_, err := ComputeSaleTotals([]int64{100}, []uint32{}, 0)
	if err != ErrTotalsMismatch {
		t.Fatalf("expected ErrTotalsMismatch, got %v", err)
	}
}

func TestCashSession_OpenClose(t *testing.T) {
	c := CashSession{OpeningFloatMinor: 10000, ExpectedCashMinor: 15000}
	c.Open()
	if !c.IsOpen() {
		t.Fatal("expected open")
	}
	c.Close(14500)
	if c.Status != "CLOSED" {
		t.Fatalf("expected CLOSED, got %s", c.Status)
	}
	if c.DifferenceMinor != -500 {
		t.Fatalf("expected -500, got %d", c.DifferenceMinor)
	}
}

func TestSale_ParkResume(t *testing.T) {
	s := Sale{ID: "s1", Status: "DRAFT"}
	s.Park("mesa 3")
	if !s.Parked || s.Status != "PARKED" {
		t.Fatalf("expected parked, got %s", s.Status)
	}
	s.Resume()
	if s.Parked || s.Status != "DRAFT" {
		t.Fatalf("expected draft, got %s", s.Status)
	}
}

func TestCheckout_Validate_OK(t *testing.T) {
	c := Checkout{SaleID: "s1", Total: 10000, Tenders: []Tender{{Kind: "CASH", Amount: 5000}, {Kind: "WALLET", Amount: 5000}}}
	if err := c.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestCheckout_Validate_Mismatch(t *testing.T) {
	c := Checkout{SaleID: "s1", Total: 10000, Tenders: []Tender{{Kind: "CASH", Amount: 5000}}}
	if err := c.Validate(); err == nil {
		t.Fatal("expected error")
	}
}

func TestCustomerCredit_ChargePay(t *testing.T) {
	c := CustomerCredit{CustomerID: "u1", TenantID: "t1"}
	c.Charge(10000)
	if c.BalanceMinor != 10000 {
		t.Fatalf("expected 10000, got %d", c.BalanceMinor)
	}
	if !c.Pay(3000) {
		t.Fatal("expected pay ok")
	}
	if c.BalanceMinor != 7000 {
		t.Fatalf("expected 7000, got %d", c.BalanceMinor)
	}
	if c.Pay(10000) {
		t.Fatal("expected pay fail")
	}
}
