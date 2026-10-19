package domain

import (
	"errors"
	"fmt"
)

var (
	ErrNetNegative   = errors.New("NET_NEGATIVE")
	ErrNoLegalParams = errors.New("LEGAL_PARAMS_MISSING")
)

// OvertimeRates son las tasas legales de recargo (N-LAB-02/03/04) y llegan como
// parámetros `legal.pa.*` vigentes en la fecha del hecho, nunca como constantes.
type OvertimeRates struct {
	DayMinor   int64 // recargo diurno
	NightMinor int64 // recargo nocturno
	MixedMinor int64 // recargo mixto
}

// LegalParams agrupa los parámetros vigentes capturados por la corrida.
// pp.legal_param_version se registra en la traza (AGENTS.md §8).
type LegalParams struct {
	Version         string
	MinWageMinor    int64
	Rates           OvertimeRates
	SocialSecPctBps int64 // CSS
	EduSecPctBps    int64 // Seguro Educativo
	// ISRBracket progressive: cada tasa se aplica solo al tramo dentro del límite
	// (N-LAB-09); el último tramo sin tope cubre el resto.
	ISRBracket []ISRBracket
	// OvertimeExcessBps: recargo del excedente diario/semanal (N-LAB-03, N-LAB-04).
	OvertimeExcessBps int64
}

// ISRBracket es un tramo del ISR con su tasa vigente (parámetro legal, no constante).
type ISRBracket struct {
	UpToMinor int64
	RateBps   int64
}

// DayWork: horas trabajadas de un día ya clasificadas.
type DayWork struct {
	Date        string
	ShiftKind   ShiftKind
	WorkedMin   int64
	RegularMin  int64
	OvertimeMin int64
}

// HoursSummary de un período.
type HoursSummary struct {
	TotalWorkedMin int64
	RegularMin     int64
	OvertimeMin    int64
	Days           []DayWork
}

// PayslipInput es una fila de la corrida.
type PayslipInput struct {
	Employee  Employee
	Hours     HoursSummary
	ShiftKind ShiftKind
}

// Payslip (F19.5).
type Payslip struct {
	EmployeeID  string
	GrossMinor  int64
	Deductions  []Deduction
	NetMinor    int64
	LegalParams string
}

type Deduction struct {
	Code  string
	Minor int64
}

// Recargo de la clase de turno (N-LAB-02).
func (lp LegalParams) RecargoFor(k ShiftKind) int64 {
	switch k {
	case ShiftKindDiurnal:
		return lp.Rates.DayMinor
	case ShiftKindNocturnal:
		return lp.Rates.NightMinor
	default:
		return lp.Rates.MixedMinor
	}
}

// ComputePayslip aplica R5 con los parámetros legales vigentes del período.
func ComputePayslip(in PayslipInput, lp LegalParams) (Payslip, error) {
	if lp.Version == "" {
		return Payslip{}, ErrNoLegalParams
	}
	ps := Payslip{EmployeeID: in.Employee.ID, LegalParams: lp.Version}

	switch in.Employee.PayType {
	case PayTypeSalary:
		ps.GrossMinor = prorateSalary(in.Employee, in.Hours)
	case PayTypeHourly:
		rate := in.Employee.HourlyRateMinor
		regular := mulDiv(in.Hours.RegularMin, rate, 60)
		overtime := mulDiv(in.Hours.OvertimeMin, rate, 60)
		recargo := lp.RecargoFor(in.ShiftKind)
		ps.GrossMinor = regular + overtime + mulDiv(overtime, recargo, 10000)
	default:
		return Payslip{}, fmt.Errorf("%w: unknown pay type", ErrInvalidEmployee)
	}

	// Deducciones y aportes con tasas vigentes (N-LAB-07 a N-LAB-11); valores ◐/⚠ (Q-13):
	// el mecanismo existe, el valor llega del parámetro legal.
	ps.Deductions = []Deduction{
		{Code: "CSS", Minor: mulDiv(ps.GrossMinor, lp.SocialSecPctBps, 10000)},
		{Code: "SEGURO_EDUCATIVO", Minor: mulDiv(ps.GrossMinor, lp.EduSecPctBps, 10000)},
	}
	// ISR progresivo: cada tasa aplica solo a su slice (N-LAB-09). UpToMinor es el
	// techo acumulado del tramo; el último con UpToMinor = 0 toma el resto.
	var prevCeiling int64
	for i, br := range lp.ISRBracket {
		ceiling := int64(-1)
		if br.UpToMinor > 0 {
			ceiling = br.UpToMinor
		}
		sliceTop := ps.GrossMinor
		if ceiling >= 0 && ceiling < sliceTop {
			sliceTop = ceiling
		}
		slice := sliceTop - prevCeiling
		if ceiling >= 0 {
			prevCeiling = ceiling
		} else {
			prevCeiling = sliceTop
		}
		if slice <= 0 {
			continue
		}
		ps.Deductions = append(ps.Deductions, Deduction{Code: fmt.Sprintf("ISR_TRAMO_%d", i+1), Minor: mulDiv(slice, br.RateBps, 10000)})
	}
	// El neto parte del bruto y resta deducciones y aportes; redondeo half-up por
	// concepto y `net ≥ 0` (R5, ADR 0013).
	ps.NetMinor = ps.GrossMinor
	for _, d := range ps.Deductions {
		ps.NetMinor -= d.Minor
	}
	if ps.NetMinor < 0 {
		return Payslip{}, ErrNetNegative
	}
	return ps, nil
}

// prorateSalary prorratea el salario fijo por la frecuencia de pago del empleado.
func prorateSalary(e Employee, h HoursSummary) int64 {
	var periodsPerYear int64
	switch e.PayFrequency {
	case PayFrequencyWeekly:
		periodsPerYear = 52
	case PayFrequencyBiweekly:
		periodsPerYear = 26
	case PayFrequencySemimonthly:
		periodsPerYear = 24
	default:
		periodsPerYear = 12
	}
	return e.BaseSalaryMinor / periodsPerYear
}

// mulDiv redondea half-up.
func mulDiv(a, b, c int64) int64 {
	if c == 0 {
		return 0
	}
	return (a*b + c/2) / c
}
