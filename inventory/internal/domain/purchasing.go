package domain

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"time"
)

// Errores de compras (SPEC §4; glosario §7.3).
var (
	ErrInvalidSupplier = errors.New("invalid supplier")
	ErrInvalidOrder    = errors.New("invalid purchase order")
	ErrPOTransition    = errors.New("purchase order does not allow that change")
	ErrOverReceipt     = errors.New("received more than ordered")
	ErrNotInOrder      = errors.New("product not in the purchase order")
	// ErrCloseReasonRequired: «Cerrar con faltante» sin motivo (F16.12).
	ErrCloseReasonRequired = errors.New("close reason required")
)

// POStatus sigue domain-model §8.12 (mismos números que PurchaseOrderStatus del contrato).
type POStatus int

const (
	PODraft     POStatus = 1
	POSent      POStatus = 2
	POPartial   POStatus = 3
	POReceived  POStatus = 4
	POCancelled POStatus = 5
	// POClosedShort: cerrada con faltante (F16.12); final.
	POClosedShort POStatus = 6
)

// CanChangeTo dice si una persona puede pedir el cambio (la recepción mueve a PARTIAL/RECEIVED).
func (s POStatus) CanChangeTo(to POStatus) bool {
	switch {
	case s == PODraft && (to == POSent || to == POCancelled):
		return true
	case s == POSent && to == POCancelled:
		return true
	case s == POPartial && to == POClosedShort:
		return true
	}
	return false
}

// Receivable: solo una orden enviada (o recibida en parte) recibe mercancía.
func (s POStatus) Receivable() bool { return s == POSent || s == POPartial }

// Supplier es un proveedor del negocio.
type Supplier struct {
	ID           string
	TenantID     string
	Name         string
	TaxID        string
	CheckDigit   string
	Email        string
	Phone        string
	LeadTimeDays int
	Active       bool
}

// DefaultLeadTimeDays: plazo de entrega cuando el proveedor no lo declara (R6).
const DefaultLeadTimeDays = 7

var (
	dvRe    = regexp.MustCompile(`^[0-9]{2}$`)
	phoneRe = regexp.MustCompile(`^\+?[0-9 ()-]{7,20}$`)
)

// Normalize y Validate (S-INV-07): nombre obligatorio; RUC con DV de 2 dígitos si se da; correo y
// teléfono con formato válido si se dan; plazo de entrega de 0 a 365 días.
func (s Supplier) Normalize() Supplier {
	s.Name = strings.Join(strings.Fields(s.Name), " ")
	s.TaxID = strings.ToUpper(strings.TrimSpace(s.TaxID))
	s.CheckDigit = strings.TrimSpace(s.CheckDigit)
	s.Email = strings.ToLower(strings.TrimSpace(s.Email))
	s.Phone = strings.TrimSpace(s.Phone)
	if s.LeadTimeDays == 0 {
		s.LeadTimeDays = DefaultLeadTimeDays
	}
	return s
}

func (s Supplier) Validate() error {
	if n := len([]rune(s.Name)); n == 0 || n > 120 {
		return ErrInvalidSupplier
	}
	if (s.TaxID == "") != (s.CheckDigit == "") || (s.CheckDigit != "" && !dvRe.MatchString(s.CheckDigit)) || len(s.TaxID) > 30 {
		return ErrInvalidSupplier
	}
	if s.Email != "" {
		if a, err := mail.ParseAddress(s.Email); err != nil || a.Address != s.Email {
			return ErrInvalidSupplier
		}
	}
	if s.Phone != "" && !phoneRe.MatchString(s.Phone) {
		return ErrInvalidSupplier
	}
	if s.LeadTimeDays < 0 || s.LeadTimeDays > 365 {
		return ErrInvalidSupplier
	}
	return nil
}

// POLine es una línea de orden de compra. Cantidades en milésimas; costo en centavos por unidad.
type POLine struct {
	ProductID     string
	OrderedMilli  int64
	ReceivedMilli int64
	UnitCostMinor int64
	DamagedMilli  int64 // F16.12: parte de lo recibido que llegó dañada
}

// ShortMilli: lo que falta por recibir de la línea.
func (l POLine) ShortMilli() int64 { return l.OrderedMilli - l.ReceivedMilli }

// PurchaseOrder es una orden de compra a un proveedor.
type PurchaseOrder struct {
	ID           string
	TenantID     string
	SupplierID   string
	SupplierName string
	WarehouseID  string
	Status       POStatus
	Lines        []POLine
	ExpectedAt   *time.Time
	TotalMinor   int64
	CreatedAt    time.Time
	Version      int
	CloseReason  string // F16.12
}

// MaxCloseReasonLength del motivo de «Cerrar con faltante».
const MaxCloseReasonLength = 300

// CloseReason normaliza y valida el motivo de «Cerrar con faltante» (1–300 caracteres).
func CloseReason(reason string) (string, error) {
	r := strings.TrimSpace(reason)
	if r == "" || len([]rune(r)) > MaxCloseReasonLength {
		return r, ErrCloseReasonRequired
	}
	return r, nil
}

// halfUp divide redondeando la mitad hacia arriba (domain-model §4); n y d > 0.
func halfUp(n, d int64) int64 { return (n + d/2) / d }

// Prepare valida las líneas y calcula el total: Σ half_up(cantidad × costo / 1000) (ADR 0013).
func (o *PurchaseOrder) Prepare() error {
	if o.SupplierID == "" || len(o.Lines) == 0 || len(o.Lines) > 200 {
		return ErrInvalidOrder
	}
	seen := map[string]bool{}
	var total int64
	for i, l := range o.Lines {
		if l.ProductID == "" || seen[l.ProductID] || l.OrderedMilli <= 0 || l.OrderedMilli > 1_000_000_000 ||
			l.UnitCostMinor < 0 || l.UnitCostMinor > 1_000_000_000 {
			return ErrInvalidOrder
		}
		seen[l.ProductID] = true
		o.Lines[i].ReceivedMilli = 0
		total += halfUp(l.OrderedMilli*l.UnitCostMinor, 1000)
	}
	o.TotalMinor = total
	return nil
}

// Received es lo que llega en una recepción.
type Received struct {
	ProductID     string
	ReceivedMilli int64
	LotCode       string     // F16.8: lote del proveedor (obligatorio si el producto maneja lotes)
	LotExpiresOn  *time.Time // vencimiento del lote
	DamagedMilli  int64      // F16.12: parte de ReceivedMilli que llegó dañada (entra bloqueada)
}

// Receive aplica una recepción: suma a cada línea sin pasar lo pedido y devuelve el nuevo estado
// (RECEIVED si todo llegó, si no PARTIALLY_RECEIVED).
func (o *PurchaseOrder) Receive(in []Received) error {
	if !o.Status.Receivable() {
		return ErrPOTransition
	}
	if len(in) == 0 {
		return ErrInvalidOrder
	}
	idx := map[string]int{}
	for i, l := range o.Lines {
		idx[l.ProductID] = i
	}
	for _, r := range in {
		i, ok := idx[r.ProductID]
		if !ok {
			return ErrNotInOrder
		}
		if r.ReceivedMilli <= 0 || r.DamagedMilli < 0 || r.DamagedMilli > r.ReceivedMilli {
			return ErrInvalidOrder
		}
		l := &o.Lines[i]
		if l.ReceivedMilli+r.ReceivedMilli > l.OrderedMilli {
			return ErrOverReceipt
		}
		l.ReceivedMilli += r.ReceivedMilli
		l.DamagedMilli += r.DamagedMilli
	}
	o.Status = POReceived
	for _, l := range o.Lines {
		if l.ReceivedMilli < l.OrderedMilli {
			o.Status = POPartial
			break
		}
	}
	return nil
}
