package domain

import (
	"errors"
	"slices"
	"strings"
	"unicode/utf8"
)

// Preferencias de documento (fiscal.CheckoutPreference; mismos números del contrato).
const (
	PrefAlwaysFiscal  int32 = 1
	PrefInternalOnly  int32 = 2
	PrefAskAlways     int32 = 3
	PrefAutoThreshold int32 = 4
)

// MaxReceiptFooter: largo máximo del pie del recibo (R14).
const MaxReceiptFooter = 200

var (
	// ErrInvalidSettings: configuración fuera de sus límites (R14).
	ErrInvalidSettings = errors.New("invalid pos settings")
	// ErrSettingsConflict: otra persona guardó la configuración antes (R14).
	ErrSettingsConflict = errors.New("pos settings changed")
)

// Settings es la configuración de caja del comercio (F17.11, R14). Version 0 = nunca guardada.
type Settings struct {
	CheckoutPreference int32   `json:"checkout_preference"`
	AutoThresholdMinor int64   `json:"auto_threshold_minor"`
	CashEnabled        bool    `json:"cash_enabled"`
	EnabledRails       []int16 `json:"enabled_rails"` // medios electrónicos activos (hoy solo saldo PlentyPay)
	ReceiptFooter      string  `json:"receipt_footer"`
	MaxDiscountBps     int32   `json:"max_discount_bps"`
	Version            int32   `json:"-"`
}

// DefaultSettings: lo que rige sin configuración guardada. La preferencia es «Solo recibo
// interno» porque es lo único que la caja emite hasta que exista la factura desde la venta (F13.5).
func DefaultSettings() Settings {
	return Settings{CheckoutPreference: PrefInternalOnly, CashEnabled: true, EnabledRails: []int16{RailWallet}}
}

// Normalize ordena y deduplica los medios y recorta el pie.
func (s Settings) Normalize() Settings {
	s.ReceiptFooter = strings.TrimSpace(s.ReceiptFooter)
	rails := slices.Clone(s.EnabledRails)
	slices.Sort(rails)
	s.EnabledRails = slices.Compact(rails)
	if s.CheckoutPreference != PrefAutoThreshold {
		s.AutoThresholdMinor = 0
	}
	return s
}

// Validate aplica R14.
func (s Settings) Validate() error {
	switch s.CheckoutPreference {
	case PrefAlwaysFiscal, PrefInternalOnly, PrefAskAlways:
	case PrefAutoThreshold:
		if s.AutoThresholdMinor <= 0 {
			return ErrInvalidSettings
		}
	default:
		return ErrInvalidSettings
	}
	if s.AutoThresholdMinor < 0 || s.MaxDiscountBps < 0 || s.MaxDiscountBps > 10000 {
		return ErrInvalidSettings
	}
	for _, r := range s.EnabledRails {
		if r != RailWallet { // los demás medios electrónicos esperan a sus PSP (Q-02, Q-03)
			return ErrInvalidSettings
		}
	}
	if !s.CashEnabled && len(s.EnabledRails) == 0 {
		return ErrInvalidSettings
	}
	if utf8.RuneCountInString(s.ReceiptFooter) > MaxReceiptFooter {
		return ErrInvalidSettings
	}
	return nil
}

// SameContent: mismo contenido sin mirar la versión (un reintento de un guardado ya aplicado).
func (s Settings) SameContent(o Settings) bool {
	a, b := s.Normalize(), o.Normalize()
	return a.CheckoutPreference == b.CheckoutPreference && a.AutoThresholdMinor == b.AutoThresholdMinor &&
		a.CashEnabled == b.CashEnabled && slices.Equal(a.EnabledRails, b.EnabledRails) &&
		a.ReceiptFooter == b.ReceiptFooter && a.MaxDiscountBps == b.MaxDiscountBps
}

// RailEnabled: el medio está activo en la caja (R14).
func (s Settings) RailEnabled(rail int16) bool {
	if rail == RailCash {
		return s.CashEnabled
	}
	return slices.Contains(s.EnabledRails, rail)
}

// DiscountWithinLimit (R3): el descuento de la línea no pasa `max_discount_bps` de su importe
// bruto (precio × cantidad, half_up). Por encima hace falta `pos:discount:apply`.
func (s Settings) DiscountWithinLimit(l Line) (bool, error) {
	if l.DiscountMinor <= 0 {
		return true, nil
	}
	gross, err := HalfUp(l.UnitPriceMinor, l.QtyMilli, 1000)
	if err != nil {
		return false, err
	}
	// descuento / bruto ≤ max / 10000, en enteros: descuento × 10000 ≤ max × bruto.
	return l.DiscountMinor*10000 <= int64(s.MaxDiscountBps)*gross, nil
}
