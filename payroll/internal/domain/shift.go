package domain

import (
	"errors"
	"time"
)

// Shift (F19.2). Guardado en hora local de la sucursal; el cálculo convierte a UTC
// con la zona del empleado (N-STD-09).
type Shift struct {
	ID           string
	TenantID     string
	Name         string
	StartLocal   time.Time
	EndLocal     time.Time
	BreakMinutes int
	GraceMinutes int
}

func (s Shift) Validate() error {
	if s.TenantID == "" || s.Name == "" {
		return errors.New("INVALID_SHIFT")
	}
	if !s.EndLocal.After(s.StartLocal) {
		return errors.New("INVALID_SHIFT")
	}
	if s.BreakMinutes < 0 || s.GraceMinutes < 0 {
		return errors.New("INVALID_SHIFT")
	}
	return nil
}

// WorkedMinutes descuenta el descanso del tiempo entre marcajes.
func (s Shift) WorkedMinutes(in, out time.Time) int64 {
	if !out.After(in) {
		return 0
	}
	d := int64(out.Sub(in)/time.Minute) - int64(s.BreakMinutes)
	if d < 0 {
		return 0
	}
	return d
}

// ShiftKind: diurno, nocturno o mixto (N-LAB-01). Los límites son la jornada legal
// vigente y llegan por parámetro; aquí solo se aplica la clasificación.
type ShiftKind int

const (
	ShiftKindDiurnal ShiftKind = iota + 1
	ShiftKindNocturnal
	ShiftKindMixed
)

func (k ShiftKind) String() string {
	switch k {
	case ShiftKindDiurnal:
		return "DIURNAL"
	case ShiftKindNocturnal:
		return "NOCTURNAL"
	case ShiftKindMixed:
		return "MIXED"
	default:
		return "UNKNOWN"
	}
}

// ClassifyShift decide la clase a partir de las horas trabajadas del turno.
func ClassifyShift(startHour, endHour int) ShiftKind {
	if startHour == endHour {
		if startHour >= 6 && startHour < 18 {
			return ShiftKindDiurnal
		}
		return ShiftKindNocturnal
	}
	if startHour >= 6 && startHour < 18 && endHour >= 6 && endHour < 18 {
		return ShiftKindDiurnal
	}
	if startHour >= 6 && startHour < 18 && (endHour >= 18 || endHour < 6) {
		return ShiftKindMixed
	}
	return ShiftKindNocturnal
}
