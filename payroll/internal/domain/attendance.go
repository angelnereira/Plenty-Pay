package domain

import (
	"errors"
	"time"
)

// Reasons de marcaje (SPEC §4).
var (
	ErrInvalidClockSequence = errors.New("INVALID_CLOCK_SEQUENCE")
	ErrInvalidPIN           = errors.New("INVALID_PIN")
	ErrOverrideReasonNeeded = errors.New("OVERRIDE_REASON_REQUIRED")
	ErrLowLiveness          = errors.New("LOW_LIVENESS")
	ErrBiometricNotEnrolled = errors.New("BIOMETRIC_NOT_ENROLLED")
	ErrKioskSessionInvalid  = errors.New("KIOSK_SESSION_INVALID")
	ErrConsentRequired      = errors.New("CONSENT_REQUIRED")
	ErrDuplicateClock       = errors.New("DUPLICATE_CLOCK")
)

// ClockKind y ClockMethod (glosario).
const (
	ClockIn         = "IN"
	ClockOut        = "OUT"
	ClockBreakStart = "BREAK_START"
	ClockBreakEnd   = "BREAK_END"

	MethodPIN       = 1
	MethodDynamicQR = 2
	MethodNFC       = 3
	MethodBiometric = 4
	MethodKioskFace = 5
)

// AttendanceEvent es un marcaje aceptado.
type AttendanceEvent struct {
	EmployeeID     string
	Kind           string
	Method         int
	RecordedAt     time.Time
	InsideGeofence bool
	NeedsReview    bool
	DeviceID       string
}

// ClockState mantiene la secuencia por empleado para validar R4.
type ClockState struct {
	Open           bool
	BreakOpen      bool
	LastKind       string
	LastRecordedAt time.Time
}

// ClockContext agrupa lo que el servidor necesita para decidir sin Guardar datos sensibles.
type ClockContext struct {
	EmployeeID       string
	HasGeofence      bool
	HasBiometric     bool
	BiometricConsent bool
	Method           int
	Kind             string
	RecordedAt       time.Time
	InsideGeofence   bool
	LivenessOK       bool
	ClientTxnID      string
	OverrideReason   string
	OverrideBy       string
	DuplicatesWindow time.Duration
	DeviceID         string
}

// ApplyClock valida R1–R4 y devuelve el evento a persistir.
func ApplyClock(st ClockState, c ClockContext) (AttendanceEvent, ClockState, error) {
	// R4: duplicados en la ventana de gracia se ignoran (idempotencia por client_txn_id).
	win := c.DuplicatesWindow
	if win == 0 {
		win = 60 * time.Second
	}
	if st.LastRecordedAt != (time.Time{}) && c.RecordedAt.Sub(st.LastRecordedAt) < win && st.LastKind == c.Kind {
		return AttendanceEvent{}, st, ErrDuplicateClock
	}

	switch c.Method {
	case MethodBiometric, MethodKioskFace:
		// R1: la comparación ocurre en el dispositivo; el servidor solo recibe método+resultado.
		if !c.HasBiometric {
			return AttendanceEvent{}, st, ErrBiometricNotEnrolled
		}
		if !c.BiometricConsent {
			return AttendanceEvent{}, st, ErrConsentRequired
		}
		if !c.LivenessOK {
			return AttendanceEvent{}, st, ErrLowLiveness
		}
	case MethodDynamicQR, MethodNFC:
		// R2: el código rotativo se valida en el borde; aquí solo se acepta si viene firmado.
		if !c.LivenessOK {
			return AttendanceEvent{}, st, ErrLowLiveness
		}
	}

	// R4: IN → (BREAK_START → BREAK_END)* → OUT.
	switch c.Kind {
	case ClockIn:
		if st.Open {
			return AttendanceEvent{}, st, ErrInvalidClockSequence
		}
	case ClockBreakStart:
		if !st.Open || st.BreakOpen {
			return AttendanceEvent{}, st, ErrInvalidClockSequence
		}
	case ClockBreakEnd:
		if !st.Open || !st.BreakOpen {
			return AttendanceEvent{}, st, ErrInvalidClockSequence
		}
	case ClockOut:
		if !st.Open || st.BreakOpen {
			return AttendanceEvent{}, st, ErrInvalidClockSequence
		}
	default:
		return AttendanceEvent{}, st, ErrInvalidClockSequence
	}

	// R3: geocerca.
	needsReview := false
	inside := c.InsideGeofence
	if c.HasGeofence && !inside {
		needsReview = true
	}

	ev := AttendanceEvent{
		EmployeeID:     c.EmployeeID,
		Kind:           c.Kind,
		Method:         c.Method,
		RecordedAt:     c.RecordedAt,
		InsideGeofence: inside,
		NeedsReview:    needsReview,
		DeviceID:       c.DeviceID,
	}

	switch c.Kind {
	case ClockIn:
		st.Open = true
	case ClockBreakStart:
		st.BreakOpen = true
	case ClockBreakEnd:
		st.BreakOpen = false
	case ClockOut:
		st.Open = false
	}
	st.LastKind = c.Kind
	st.LastRecordedAt = c.RecordedAt

	return ev, st, nil
}

// ValidateOverride: la anulación por gerente exige motivo y queda auditada (R4).
func ValidateOverride(reason, by string) error {
	if reason == "" || by == "" {
		return ErrOverrideReasonNeeded
	}
	return nil
}

// KioskSession (F19.4): token de dispositivo de 12 h renovable.
type KioskSession struct {
	ID        string
	TenantID  string
	ExpiresAt time.Time
	RevokedAt *time.Time
}

func (k KioskSession) ValidAt(now time.Time) bool {
	if k.RevokedAt != nil {
		return false
	}
	return now.Before(k.ExpiresAt)
}
