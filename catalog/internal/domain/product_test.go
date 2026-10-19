package domain

import "testing"

func TestProduct_Validate_OK(t *testing.T) {
	p := Product{Name: "Widget"}
	if err := p.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestProduct_Validate_EmptyName(t *testing.T) {
	p := Product{Name: ""}
	if err := p.Validate(); err != ErrInvalidName {
		t.Fatalf("expected ErrInvalidName, got %v", err)
	}
}

func TestVariant_Validate_OK(t *testing.T) {
	v := Variant{SKU: "SKU-1", PriceMinor: 1000, Currency: "USD"}
	if err := v.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestVariant_Validate_NegativePrice(t *testing.T) {
	v := Variant{SKU: "SKU-1", PriceMinor: -1}
	if err := v.Validate(); err != ErrInvalidPrice {
		t.Fatalf("expected ErrInvalidPrice, got %v", err)
	}
}

func TestCategory_Validate_OK(t *testing.T) {
	c := Category{Name: "Electronics", Slug: "electronics"}
	if err := c.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestCategory_Validate_EmptyName(t *testing.T) {
	c := Category{Name: "", Slug: "x"}
	if err := c.Validate(); err != ErrInvalidName {
		t.Fatalf("expected ErrInvalidName, got %v", err)
	}
}

func TestBulkImportRow_Validate_OK(t *testing.T) {
	r := BulkImportRow{Name: "Widget", SKU: "W-1", PriceMinor: 1000, Currency: "USD"}
	if err := r.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestBulkImportRow_Validate_EmptyName(t *testing.T) {
	r := BulkImportRow{Name: "", SKU: "W-1", PriceMinor: 1000}
	if err := r.Validate(); err != ErrInvalidName {
		t.Fatalf("expected ErrInvalidName, got %v", err)
	}
}

func TestListing_Validate_OK(t *testing.T) {
	l := Listing{TenantID: "t1", ProductID: "p1"}
	if err := l.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestStorefront_Validate_OK(t *testing.T) {
	s := Storefront{Slug: "my-store", DisplayName: "My Store"}
	if err := s.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestSearchQuery_Validate_DefaultLimit(t *testing.T) {
	q := SearchQuery{Limit: 0}
	q.Validate()
	if q.Limit != 50 {
		t.Fatalf("expected 50, got %d", q.Limit)
	}
}

func TestSearchQuery_Validate_CapLimit(t *testing.T) {
	q := SearchQuery{Limit: 200}
	q.Validate()
	if q.Limit != 100 {
		t.Fatalf("expected 100, got %d", q.Limit)
	}
}
