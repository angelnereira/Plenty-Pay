package domain

import (
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Errores de lotes (F16.4, R5); server los traduce a los `reason` del glosario.
var (
	ErrLotRequired = errors.New("lot required")
	ErrLotExpired  = errors.New("lot expired")
	ErrLotNotFound = errors.New("lot not found")
	ErrInvalidLot  = errors.New("invalid lot code")
)

var lotCodePattern = regexp.MustCompile(`^[A-Za-z0-9._/-]{1,40}$`)

// NormalizeLotCode recorta y valida el código impreso del lote del proveedor.
func NormalizeLotCode(code string) (string, error) {
	code = strings.TrimSpace(code)
	if !lotCodePattern.MatchString(code) {
		return "", ErrInvalidLot
	}
	return code, nil
}

// panama es la zona del negocio: «hoy» y «vencido» se deciden en America/Panama (UTC−5, sin
// horario de verano). Si la base de zonas no está en la imagen se usa el desfase fijo.
var panama = func() *time.Location {
	if loc, err := time.LoadLocation("America/Panama"); err == nil {
		return loc
	}
	return time.FixedZone("America/Panama", -5*60*60)
}()

// Today es la fecha de hoy en Panamá, a las 00:00 UTC de ese día (fecha pura).
func Today(now time.Time) time.Time {
	y, m, d := now.In(panama).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// DateOnly reduce un instante a su fecha en Panamá (fecha pura, 00:00 UTC). Es idempotente: un
// valor que ya es fecha pura (00:00:00 UTC) se conserva, para que normalizar dos veces no corra
// el día. Por contrato, un vencimiento llega como las 00:00 de ese día en Panamá (05:00 UTC).
func DateOnly(t time.Time) time.Time {
	u := t.UTC()
	if u.Hour() == 0 && u.Minute() == 0 && u.Second() == 0 && u.Nanosecond() == 0 {
		return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC)
	}
	return Today(t)
}

// Lot es un lote de un producto en una bodega.
type Lot struct {
	ID          string
	TenantID    string
	WarehouseID string
	ProductID   string
	Code        string
	ExpiresOn   *time.Time // fecha pura; nil = no vence
	OnHandMilli int64
}

// Expired: vence antes de hoy. Un lote que vence hoy aún se vende hoy.
func (l Lot) Expired(today time.Time) bool { return l.ExpiresOn != nil && l.ExpiresOn.Before(today) }

// Allocation es la parte de una salida que toma un lote.
type Allocation struct {
	Lot   Lot
	Milli int64
}

// AllocateFEFO reparte una salida entre los lotes con existencia: primero el que vence antes
// (los que no vencen, al final), con el código como desempate para que un reintento produzca el
// mismo reparto (R5). Con includeExpired=false los vencidos no se tocan (una venta nunca sale de
// un lote vencido). Devuelve lo que no alcanzó a cubrirse.
func AllocateFEFO(lots []Lot, qtyMilli int64, today time.Time, includeExpired bool) ([]Allocation, int64) {
	candidates := make([]Lot, 0, len(lots))
	for _, l := range lots {
		if l.OnHandMilli <= 0 || (!includeExpired && l.Expired(today)) {
			continue
		}
		candidates = append(candidates, l)
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		a, b := candidates[i].ExpiresOn, candidates[j].ExpiresOn
		switch {
		case a == nil && b == nil:
			return candidates[i].Code < candidates[j].Code
		case a == nil:
			return false
		case b == nil:
			return true
		case !a.Equal(*b):
			return a.Before(*b)
		}
		return candidates[i].Code < candidates[j].Code
	})
	var out []Allocation
	remaining := qtyMilli
	for _, l := range candidates {
		if remaining <= 0 {
			break
		}
		take := min(l.OnHandMilli, remaining)
		out = append(out, Allocation{Lot: l, Milli: take})
		remaining -= take
	}
	return out, remaining
}
