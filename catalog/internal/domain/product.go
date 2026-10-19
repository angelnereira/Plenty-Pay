package domain

import "errors"

var ErrInvalidName = errors.New("invalid product name")
var ErrInvalidPrice = errors.New("invalid price")

type Product struct {
	ID          string
	TenantID    string
	Name        string
	Description string
	Status      int
	TaxRateBps  int
	Unit        string
}

func (p Product) Validate() error {
	if len(p.Name) < 1 || len(p.Name) > 200 {
		return ErrInvalidName
	}
	return nil
}

type Variant struct {
	ID         string
	ProductID  string
	TenantID   string
	SKU        string
	Barcode    string
	PriceMinor int64
	Currency   string
	Active     bool
}

func (v Variant) Validate() error {
	if v.SKU == "" {
		return ErrInvalidName
	}
	if v.PriceMinor < 0 {
		return ErrInvalidPrice
	}
	if v.Currency == "" {
		v.Currency = "USD"
	}
	return nil
}

type Category struct {
	ID       string
	TenantID string
	ParentID string
	Name     string
	Slug     string
	Position int
}

func (c Category) Validate() error {
	if c.Name == "" || c.Slug == "" {
		return ErrInvalidName
	}
	return nil
}

// BulkImportRow representa una fila de importación CSV.
type BulkImportRow struct {
	Name      string
	SKU       string
	PriceMinor int64
	Currency  string
	Category  string
}

func (r BulkImportRow) Validate() error {
	if r.Name == "" {
		return ErrInvalidName
	}
	if r.SKU == "" {
		return ErrInvalidName
	}
	if r.PriceMinor < 0 {
		return ErrInvalidPrice
	}
	if r.Currency == "" {
		r.Currency = "USD"
	}
	return nil
}

type Listing struct {
	ID        string
	TenantID  string
	ProductID string
	Published bool
	Fulfillment []string
	InStock   bool
	RankScore int
}

func (l Listing) Validate() error {
	if l.TenantID == "" || l.ProductID == "" {
		return ErrInvalidName
	}
	return nil
}

type Storefront struct {
	TenantID    string
	Slug        string
	DisplayName string
}

func (s Storefront) Validate() error {
	if s.Slug == "" || s.DisplayName == "" {
		return ErrInvalidName
	}
	return nil
}

type SearchQuery struct {
	TenantID string
	Text     string
	Category string
	Limit    int
	Offset   int
}

func (q *SearchQuery) Validate() error {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	if q.Limit > 100 {
		q.Limit = 100
	}
	return nil
}
