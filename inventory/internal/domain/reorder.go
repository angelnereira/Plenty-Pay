package domain

import "sort"

// Sugerencias de reorden (SPEC §5 R6). Todo en milésimas de unidad y enteros.

// VelocityWindowDays es la ventana de ventas que se mira (R6: 28 días completos, sin el de hoy).
const VelocityWindowDays = 28

// SafetyDays y CoverDays de R6: sugerir si la cobertura < plazo + 7; pedir para plazo + 14 días.
const (
	SafetyDays = 7
	CoverDays  = 14
)

// Velocity es la media ponderada exponencial (α = 0,3) de las ventas diarias, del día más antiguo
// al más reciente, en milésimas por día, con redondeo half-up: s = (3·x + 7·s) / 10.
func Velocity(daily []int64) int64 {
	if len(daily) == 0 {
		return 0
	}
	s := daily[0]
	for _, x := range daily[1:] {
		s = halfUp(3*x+7*s, 10)
	}
	return s
}

// Suggestion es el resultado de R6 para un producto en una bodega.
type Suggestion struct {
	ProductID      string
	WarehouseID    string
	AvailableMilli int64
	InTransitMilli int64
	VelocityMilli  int64 // venta diaria promedio
	DaysOfCover    int32
	SuggestedMilli int64
	LeadTimeDays   int
	ABC            string
}

// NoCover son los días de cobertura que se informan cuando no hay ventas.
const NoCover = 999

// Suggest aplica R6: cobertura = disponible / velocidad; si es menor que plazo + 7, pide
// velocidad × (plazo + 14) − disponible − en tránsito, redondeado hacia arriba a unidades enteras.
// Sin ventas no hay sugerencia (la alerta por punto de reorden es R7).
func Suggest(available, inTransit, velocity int64, leadDays int) (cover int32, suggested int64) {
	if velocity <= 0 {
		return NoCover, 0
	}
	days := available / velocity
	if available < 0 {
		days = 0
	}
	if days > NoCover {
		days = NoCover
	}
	cover = int32(days)
	if days >= int64(leadDays+SafetyDays) {
		return cover, 0
	}
	need := velocity*int64(leadDays+CoverDays) - available - inTransit
	if need <= 0 {
		return cover, 0
	}
	return cover, (need + 999) / 1000 * 1000
}

// ClassifyABC reparte los productos por su peso en lo vendido: A hasta el 80 % acumulado, B hasta el
// 95 %, C el resto (y lo que no vendió).
func ClassifyABC(sold map[string]int64) map[string]string {
	type kv struct {
		id string
		n  int64
	}
	var list []kv
	var total int64
	for id, n := range sold {
		list = append(list, kv{id, n})
		if n > 0 {
			total += n
		}
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].n != list[j].n {
			return list[i].n > list[j].n
		}
		return list[i].id < list[j].id
	})
	out := map[string]string{}
	var acc int64
	for _, e := range list {
		if total == 0 || e.n <= 0 {
			out[e.id] = "C"
			continue
		}
		before := acc
		acc += e.n
		switch {
		case before*100 < total*80:
			out[e.id] = "A"
		case before*100 < total*95:
			out[e.id] = "B"
		default:
			out[e.id] = "C"
		}
	}
	return out
}
