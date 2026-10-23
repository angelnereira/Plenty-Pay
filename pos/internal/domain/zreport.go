package domain

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
)

// ErrInvalidCount: el conteo por denominación trae una denominación que la moneda no tiene, una
// cantidad negativa o no cuadra con el monto contado (R16).
var ErrInvalidCount = errors.New("invalid cash count")

// Denominaciones de billetes y monedas por moneda, en centavos (R16). Son de la moneda, no valores
// legales variables: USD y PAB circulan juntos en Panamá con las mismas denominaciones.
var denominations = map[string][]int64{
	"USD": {1, 5, 10, 25, 50, 100, 500, 1000, 2000, 5000, 10000},
	"PAB": {1, 5, 10, 25, 50, 100, 500, 1000, 2000, 5000, 10000},
}

// Denominations devuelve las denominaciones de la moneda (nil si no hay tabla).
func Denominations(currency string) []int64 { return denominations[currency] }

// CashCount: cantidad de billetes o monedas de una denominación.
type CashCount struct {
	DenominationMinor int64 `json:"denomination_minor"`
	Quantity          int32 `json:"quantity"`
}

// ResolveCounted aplica R16 al arqueo: sin conteo por denominación rige el monto contado; con
// conteo, el contado es Σ denominación × cantidad y, si además llegó un monto distinto, se rechaza.
// Devuelve el contado y el conteo sin las denominaciones en cero, de menor a mayor.
func ResolveCounted(counted int64, hasCounted bool, counts []CashCount, currency string) (int64, []CashCount, error) {
	if len(counts) == 0 {
		if counted < 0 {
			return 0, nil, ErrInvalidAmount
		}
		return counted, nil, nil
	}
	valid := map[int64]bool{}
	for _, d := range denominations[currency] {
		valid[d] = true
	}
	byDen := map[int64]int32{}
	for _, c := range counts {
		if !valid[c.DenominationMinor] || c.Quantity < 0 {
			return 0, nil, fmt.Errorf("%w: denomination %d quantity %d", ErrInvalidCount, c.DenominationMinor, c.Quantity)
		}
		if _, dup := byDen[c.DenominationMinor]; dup {
			return 0, nil, fmt.Errorf("%w: denomination %d repeated", ErrInvalidCount, c.DenominationMinor)
		}
		byDen[c.DenominationMinor] = c.Quantity
	}
	var total int64
	var out []CashCount
	for _, d := range denominations[currency] {
		q := byDen[d]
		if q == 0 {
			continue
		}
		total += d * int64(q) // máx. 10000 × 2^31 por denominación: no desborda int64
		out = append(out, CashCount{DenominationMinor: d, Quantity: q})
	}
	if hasCounted && counted != total {
		return 0, nil, fmt.Errorf("%w: counted %d does not match denominations %d", ErrInvalidCount, counted, total)
	}
	return total, out, nil
}

// ZReportLine es una línea del reporte Z: monto en centavos y número de documentos o movimientos.
type ZReportLine struct {
	Key         string `json:"key"`
	AmountMinor int64  `json:"amount_minor"`
	Count       int32  `json:"count"`
}

// ZReport es el resumen de una sesión de caja al cerrarla (R16).
type ZReport struct {
	Lines           []ZReportLine `json:"lines"`
	GrossSalesMinor int64         `json:"gross_sales_minor"`
	RefundsMinor    int64         `json:"refunds_minor"`
	NetSalesMinor   int64         `json:"net_sales_minor"`
	SalesCount      int32         `json:"sales_count"`
}

// ZRefund es lo que el reporte necesita de una devolución hecha desde la caja.
type ZRefund struct {
	CashMinor   int64
	WalletMinor int64
	Failed      bool // el reintegro al saldo falló: esa parte no salió
}

// RailName da el nombre del medio en las claves del reporte.
func RailName(rail int16) string {
	switch rail {
	case RailCash:
		return "CASH"
	case RailWallet:
		return "WALLET"
	}
	return fmt.Sprintf("RAIL_%d", rail)
}

// zacc acumula líneas con suma comprobada (ADR 0013: nunca desbordar en silencio).
type zacc struct {
	m     map[string]*ZReportLine
	rates map[string]int64 // tasa de las claves taxable:/tax:, para ordenarlas
	err   error
}

func (z *zacc) add(key string, amount int64, n int32) {
	if z.err != nil {
		return
	}
	l, ok := z.m[key]
	if !ok {
		l = &ZReportLine{Key: key}
		z.m[key] = l
	}
	if (amount > 0 && l.AmountMinor > math.MaxInt64-amount) || (amount < 0 && l.AmountMinor < math.MinInt64-amount) {
		z.err = ErrOverflow
		return
	}
	l.AmountMinor += amount
	l.Count += n
}

func (z *zacc) get(key string) ZReportLine {
	if l, ok := z.m[key]; ok {
		return *l
	}
	return ZReportLine{Key: key}
}

// zOrder fija el orden de las claves; las de tasa van por tasa ascendente (base y luego ITBMS).
func zOrder(key string, rates map[string]int64) (int, int64) {
	fixed := map[string]int{"rail:CASH": 0, "rail:WALLET": 1, "refund:CASH": 3, "refund:WALLET": 4,
		"discounts": 5, "exempt": 7, "cash_in": 8, "cash_out": 9, "voids": 10}
	if g, ok := fixed[key]; ok {
		return g, 0
	}
	if bps, ok := rates[key]; ok {
		if strings.HasPrefix(key, "tax:") {
			return 6, bps*2 + 1
		}
		return 6, bps * 2
	}
	if strings.HasPrefix(key, "rail:") {
		return 2, 0
	}
	return 11, 0
}

// BuildZReport calcula el reporte Z de una sesión (R16) con las ventas, devoluciones y movimientos
// de efectivo de esa sesión. Función pura: montos enteros en centavos, orden fijo, solo las líneas
// con movimiento.
func BuildZReport(sales []Sale, refunds []ZRefund, movements []CashMovement) (ZReport, error) {
	z := &zacc{m: map[string]*ZReportLine{}, rates: map[string]int64{}}
	var r ZReport
	for _, s := range sales {
		switch s.Status {
		case Paid, PartiallyRefunded, Refunded:
		case Voided:
			z.add("voids", s.TotalMinor, 1)
			continue
		default:
			continue
		}
		r.SalesCount++
		z.add("gross", s.TotalMinor, 1)
		for _, t := range s.Tenders {
			if t.Status == TenderCaptured {
				z.add("rail:"+RailName(t.Rail), t.AmountMinor, 1)
			}
		}
		for _, l := range s.Lines {
			if l.DiscountMinor > 0 {
				z.add("discounts", l.DiscountMinor, 1)
			}
			if l.TaxRateBps <= 0 {
				z.add("exempt", l.LineTotalMinor, 1)
				continue
			}
			base, tax := fmt.Sprintf("taxable:%d", l.TaxRateBps), fmt.Sprintf("tax:%d", l.TaxRateBps)
			z.rates[base], z.rates[tax] = int64(l.TaxRateBps), int64(l.TaxRateBps)
			z.add(base, l.LineTotalMinor-l.TaxMinor, 1)
			z.add(tax, l.TaxMinor, 1)
		}
	}
	for _, f := range refunds {
		if f.CashMinor > 0 {
			z.add("refund:CASH", f.CashMinor, 1)
			z.add("refunds", f.CashMinor, 0)
		}
		if f.WalletMinor > 0 && !f.Failed {
			z.add("refund:WALLET", f.WalletMinor, 1)
			z.add("refunds", f.WalletMinor, 0)
		}
	}
	for _, m := range movements {
		if m.Direction == "IN" {
			z.add("cash_in", m.AmountMinor, 1)
		} else {
			z.add("cash_out", m.AmountMinor, 1)
		}
	}
	if z.err != nil {
		return ZReport{}, z.err
	}
	r.GrossSalesMinor, r.RefundsMinor = z.get("gross").AmountMinor, z.get("refunds").AmountMinor
	r.NetSalesMinor = r.GrossSalesMinor - r.RefundsMinor
	for k, l := range z.m {
		if k != "gross" && k != "refunds" {
			r.Lines = append(r.Lines, *l)
		}
	}
	sort.Slice(r.Lines, func(i, j int) bool {
		gi, si := zOrder(r.Lines[i].Key, z.rates)
		gj, sj := zOrder(r.Lines[j].Key, z.rates)
		if gi != gj {
			return gi < gj
		}
		if si != sj {
			return si < sj
		}
		return r.Lines[i].Key < r.Lines[j].Key
	})
	return r, nil
}
