package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Errores del marketplace (SPEC §4).
var (
	ErrTenantNotActive   = errors.New("tenant not active")
	ErrListingIncomplete = errors.New("listing incomplete")
	ErrInvalidStorefront = errors.New("invalid storefront")
)

// TenantActive es identity.TenantStatus ACTIVE.
const TenantActive int16 = 2

// Listing es la publicación de un producto en el marketplace.
type Listing struct {
	ProductID   string
	TenantID    string
	Listed      bool
	PriceMinor  int64 // 0 = el precio del producto
	Delivery    bool
	Pickup      bool
	PublishedAt time.Time
	UpdatedAt   time.Time
}

// CanPublish (SPEC SetListing): negocio ACTIVE, producto activo, precio > 0, al menos una foto y
// una modalidad de entrega.
func (l Listing) CanPublish(p Product, tenantStatus int16) error {
	if !l.Listed {
		return nil // despublicar siempre se puede
	}
	if tenantStatus != TenantActive {
		return ErrTenantNotActive
	}
	if p.Status != StatusActive {
		return ErrInvalidTransition
	}
	price := l.PriceMinor
	if price == 0 {
		price = p.PriceMinor
	}
	if price <= 0 || len(p.ImageObjectKeys) == 0 || (!l.Delivery && !l.Pickup) {
		return ErrListingIncomplete
	}
	return nil
}

// Storefront es la vitrina pública del comercio.
type Storefront struct {
	TenantID      string
	DisplayName   string
	Description   string
	LogoObjectKey string
	AddressJSON   []byte
	Published     bool
	UpdatedAt     time.Time
}

// Validate: nombre 1–80, descripción ≤ 2000.
func (s Storefront) Validate() error {
	n := utf8.RuneCountInString(strings.TrimSpace(s.DisplayName))
	if n < 1 || n > 80 || utf8.RuneCountInString(s.Description) > 2000 {
		return ErrInvalidStorefront
	}
	return nil
}

// MarketItem es un resultado del marketplace (listado + producto + comercio + disponibilidad).
type MarketItem struct {
	Product    Product
	Listing    Listing
	Storefront Storefront
	InStock    bool
}

// MarketSort son los órdenes de SearchMarketplace.
var MarketSort = map[string]bool{"": true, "RELEVANCE": true, "PRICE_ASC": true, "PRICE_DESC": true, "NEWEST": true}
