// Package domain contiene las reglas puras de inventory (SPEC §5): sin E/S, sin pb, sin SQL.
// Las cantidades van en milésimas (`_milli`) para admitir kg, litros y metros sin decimales.
package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Errores tipados; server los traduce a `reason`.
var (
	ErrInvalidQty          = errors.New("quantity must be non-zero")
	ErrInvalidMovementType = errors.New("invalid movement type")
	ErrReasonRequired      = errors.New("movement reason required")
	ErrOutOfStock          = errors.New("out of stock")
	ErrSameWarehouse       = errors.New("same warehouse")
	ErrProductNotFound     = errors.New("product not found")
	ErrNotTracked          = errors.New("product does not track inventory")
	ErrNotFound            = errors.New("not found")
	ErrInvalidWarehouse    = errors.New("invalid warehouse")
	ErrKeyReused           = errors.New("idempotency key reused")
	ErrServiceOnly         = errors.New("movement type reserved to services")
	ErrInvalidTransition   = errors.New("invalid state transition")
	ErrExceedsBlocked      = errors.New("exceeds blocked stock")
)

// MovementType (inventory.proto MovementType).
type MovementType int16

const (
	Receipt     MovementType = 1
	Sale        MovementType = 2
	Adjustment  MovementType = 3
	TransferOut MovementType = 4
	TransferIn  MovementType = 5
	Return      MovementType = 6
	WriteOff    MovementType = 7
	Block       MovementType = 8 // F16.10: aparta existencia física como no vendible
	Unblock     MovementType = 9 // F16.10: la libera
)

// Physical: el tipo cambia la existencia física (on_hand). BLOCK y UNBLOCK solo cambian lo
// bloqueado (R1: on_hand = Σ movimientos físicos; bloqueado = Σ BLOCK/UNBLOCK).
func (t MovementType) Physical() bool { return t != Block && t != Unblock }

// MaxReasonLength del motivo de un ajuste.
const MaxReasonLength = 300

// Movement es un movimiento inmutable (R1). `DeltaMilli` lleva signo: + entra, − sale.
type Movement struct {
	ID             string
	TenantID       string
	WarehouseID    string
	ProductID      string
	Type           MovementType
	DeltaMilli     int64
	Reason         string
	ReferenceType  string
	ReferenceID    string
	ActorUserID    string
	ActorService   string
	IdempotencyKey string
	OccurredAt     time.Time

	// F16.4 (R5). Entrada: LotCode crea o suma al lote. Salida: LotCode toma ese lote; vacío =
	// FEFO si el producto tiene lotes. RequireLot lo fija el servicio con la marca del catálogo.
	LotID        string
	LotCode      string
	LotExpiresOn *time.Time
	RequireLot   bool

	// OnArrival (F16.12): BLOCK de lo que llega dañado en una recepción; no compite con reservas.
	OnArrival bool
}

// ServiceTypes solo los generan pos y orders al vender o devolver (SPEC §4 AdjustStock).
var ServiceTypes = map[MovementType]bool{Sale: true, Return: true}

// SellingServices pueden registrar SALE y RETURN.
var SellingServices = map[string]bool{"pos": true, "orders": true}

// Validate aplica el signo de cada tipo y el motivo obligatorio (SPEC §4): RECEIPT y RETURN
// entran (+), SALE y WRITE_OFF salen (−), ADJUSTMENT va en cualquier sentido con motivo. F16.10:
// BLOCK suma a lo bloqueado (+) y UNBLOCK resta (−), ambos con motivo.
func (m Movement) Validate() error {
	if m.DeltaMilli == 0 {
		return ErrInvalidQty
	}
	switch m.Type {
	case Receipt, Return, TransferIn:
		if m.DeltaMilli < 0 {
			return ErrInvalidQty
		}
	case Sale, WriteOff, TransferOut, Unblock:
		if m.DeltaMilli > 0 {
			return ErrInvalidQty
		}
	case Block:
		if m.DeltaMilli < 0 {
			return ErrInvalidQty
		}
	case Adjustment:
	default:
		return ErrInvalidMovementType
	}
	reason := strings.TrimSpace(m.Reason)
	if (m.Type == Adjustment || m.Type == WriteOff || !m.Type.Physical()) && reason == "" {
		return ErrReasonRequired
	}
	if utf8.RuneCountInString(reason) > MaxReasonLength {
		return ErrReasonRequired
	}
	return nil
}

// AllowedFor: SALE/RETURN solo desde pos u orders; las personas usan RECEIPT, ADJUSTMENT y
// WRITE_OFF. Las transferencias solo se crean con TransferStock (par OUT/IN atómico).
func (m Movement) AllowedFor(service string) error {
	if m.Type == TransferOut || m.Type == TransferIn {
		return ErrInvalidMovementType
	}
	if ServiceTypes[m.Type] && !SellingServices[service] {
		return ErrServiceOnly
	}
	return nil
}

// Level es la existencia de un producto en una bodega.
type Level struct {
	TenantID          string
	WarehouseID       string
	ProductID         string
	OnHandMilli       int64
	ReservedMilli     int64
	BlockedMilli      int64 // F16.10: físico no vendible
	ReorderPointMilli int64
	LowNotifiedOn     time.Time // R7: a lo sumo un StockLow por día y producto
	Version           int64
}

// Available = on_hand − reserved − blocked (F16.10): ni reservas ni ventas toman lo bloqueado.
func (l Level) Available() int64 { return l.OnHandMilli - l.ReservedMilli - l.BlockedMilli }

// Apply suma el movimiento. R2: por defecto `available` no puede quedar < 0; una venta física
// (SALE) sí puede dejarlo negativo: ya ocurrió y se marca para revisión con StockLow.
// F16.10: BLOCK solo toma lo disponible y UNBLOCK no libera más de lo bloqueado; ninguno cambia
// on_hand.
func (l *Level) Apply(m Movement) error {
	switch m.Type {
	case Block:
		// F16.12: lo que llega dañado en una recepción se aparta aunque haya reservas: son unidades
		// que acaban de entrar, nunca estuvieron disponibles.
		if !m.OnArrival && l.Available() < m.DeltaMilli {
			return ErrOutOfStock
		}
		l.BlockedMilli += m.DeltaMilli
	case Unblock:
		if l.BlockedMilli < -m.DeltaMilli {
			return ErrExceedsBlocked
		}
		l.BlockedMilli += m.DeltaMilli
	default:
		if m.DeltaMilli < 0 && m.Type != Sale && l.Available()+m.DeltaMilli < 0 {
			return ErrOutOfStock
		}
		l.OnHandMilli += m.DeltaMilli
	}
	l.Version++
	return nil
}

// IsLow (R7 parcial): available ≤ punto de reorden definido, o negativo.
func (l Level) IsLow() bool {
	return l.Available() < 0 || (l.ReorderPointMilli > 0 && l.Available() <= l.ReorderPointMilli)
}

// ShouldNotifyLow: bajo y sin aviso hoy (fecha UTC).
func (l Level) ShouldNotifyLow(now time.Time) bool {
	if !l.IsLow() {
		return false
	}
	y1, m1, d1 := l.LowNotifiedOn.UTC().Date()
	y2, m2, d2 := now.UTC().Date()
	return !(y1 == y2 && m1 == m2 && d1 == d2)
}

// Warehouse es una bodega del comercio.
type Warehouse struct {
	ID         string
	TenantID   string
	Name       string
	BranchCode string
	Active     bool
	IsDefault  bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Validate: nombre 1–80.
func (w Warehouse) Validate() error {
	n := utf8.RuneCountInString(strings.TrimSpace(w.Name))
	if n < 1 || n > 80 {
		return ErrInvalidWarehouse
	}
	return nil
}

// ReservationStatus (inventory.proto ReservationStatus).
type ReservationStatus int16

const (
	ReservationActive    ReservationStatus = 1
	ReservationCommitted ReservationStatus = 2
	ReservationReleased  ReservationStatus = 3
	ReservationExpired   ReservationStatus = 4
)

// Límites de una reserva (R4: ninguna reserva es indefinida).
const (
	DefaultReservationTTL = 900
	MaxReservationTTL     = 24 * 3600
	MaxReservationLines   = 50
)

// ReservationLine es un producto y su cantidad reservada.
type ReservationLine struct {
	ProductID string `json:"product_id"`
	QtyMilli  int64  `json:"qty_milli"`
}

// Reservation protege existencias entre el carrito y el pago confirmado.
type Reservation struct {
	ID             string
	TenantID       string
	WarehouseID    string
	Lines          []ReservationLine
	Status         ReservationStatus
	ReferenceType  string
	ReferenceID    string
	IdempotencyKey string
	ExpiresAt      time.Time
	CreatedAt      time.Time
}

// Validate: al menos una línea, cantidades > 0, productos sin repetir.
func (r Reservation) Validate() error {
	if len(r.Lines) == 0 || len(r.Lines) > MaxReservationLines {
		return ErrInvalidQty
	}
	seen := map[string]bool{}
	for _, l := range r.Lines {
		if l.QtyMilli <= 0 || l.ProductID == "" || seen[l.ProductID] {
			return ErrInvalidQty
		}
		seen[l.ProductID] = true
	}
	return nil
}

// Reserve aparta `qty` (R2: available no queda < 0 salvo decisión explícita).
func (l *Level) Reserve(qty int64, allowNegative bool) error {
	if qty <= 0 {
		return ErrInvalidQty
	}
	if !allowNegative && l.Available() < qty {
		return ErrOutOfStock
	}
	l.ReservedMilli += qty
	l.Version++
	return nil
}

// Unreserve devuelve lo apartado (liberar o vencer).
func (l *Level) Unreserve(qty int64) {
	l.ReservedMilli -= qty
	if l.ReservedMilli < 0 {
		l.ReservedMilli = 0
	}
	l.Version++
}
