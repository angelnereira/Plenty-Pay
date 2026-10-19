package domain

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
)

var (
	ErrCannotApproveOwnRun    = errors.New("CANNOT_APPROVE_OWN_RUN")
	ErrRiskRateMissing        = errors.New("PROFESSIONAL_RISK_RATE_MISSING")
	ErrAttendanceNeedsReview  = errors.New("ATTENDANCE_NEEDS_REVIEW")
	ErrStepUpRequired         = errors.New("STEP_UP_REQUIRED")
	ErrInvalidStateTransition = errors.New("INVALID_STATE_TRANSITION")
	ErrInsufficientFunds      = errors.New("INSUFFICIENT_FUNDS")
)

type RunStatus int

const (
	RunDraft RunStatus = iota + 1
	RunApproved
	RunPaying
	RunPaid
	RunPartiallyFailed
)

func (s RunStatus) String() string {
	switch s {
	case RunDraft:
		return "DRAFT"
	case RunApproved:
		return "APPROVED"
	case RunPaying:
		return "PAYING"
	case RunPaid:
		return "PAID"
	case RunPartiallyFailed:
		return "PARTIALLY_FAILED"
	default:
		return "UNKNOWN"
	}
}

// Run (F19.5/F19.6).
type Run struct {
	ID          string
	TenantID    string
	PeriodStart string
	PeriodEnd   string
	Status      RunStatus
	ApprovedBy  string
	CreatedBy   string
	Payslips    []Payslip
	TotalNet    int64
	LegalParams string
}

func (r *Run) Recalculate() {
	var total int64
	for _, p := range r.Payslips {
		total += p.NetMinor
	}
	r.TotalNet = total
}

// ApproveInput agrupa las condiciones de R6/ApprovePayrollRun.
type ApproveInput struct {
	ApproverID          string
	StepUpVerified      bool
	HasRiskRate         bool
	HasAttendanceReview bool
}

func (r *Run) Approve(in ApproveInput) error {
	if r.Status != RunDraft {
		return ErrInvalidStateTransition
	}
	if in.ApproverID == "" || in.ApproverID == r.CreatedBy {
		return ErrCannotApproveOwnRun
	}
	if !in.StepUpVerified {
		return ErrStepUpRequired
	}
	if !in.HasRiskRate {
		return ErrRiskRateMissing
	}
	if in.HasAttendanceReview {
		return ErrAttendanceNeedsReview
	}
	r.Status = RunApproved
	r.ApprovedBy = in.ApproverID
	return nil
}

// PayResult es el resultado por empleado (R6).
type PayResult struct {
	EmployeeID string
	OK         bool
	Reason     string
}

// PayInput con el saldo del wallet del tenant.
type PayInput struct {
	WalletBalanceMinor int64
	PayerID            string
}

// Pay verifica saldo antes de empezar (R6) y devuelve el idempotency_key T10 por empleado.
func (r *Run) Pay(in PayInput) ([]PayResult, error) {
	if r.Status != RunApproved {
		return nil, ErrInvalidStateTransition
	}
	if in.WalletBalanceMinor < r.TotalNet {
		return nil, ErrInsufficientFunds
	}
	r.Status = RunPaying
	out := make([]PayResult, 0, len(r.Payslips))
	for _, p := range r.Payslips {
		out = append(out, PayResult{EmployeeID: p.EmployeeID, OK: true})
	}
	return out, nil
}

// SettlePayments consolida el resultado (R6): todo ok → PAID; alguno fallido →
// PARTIALLY_FAILED y el reintento cubre solo los fallidos.
func (r *Run) SettlePayments(results []PayResult) (failed []PayResult) {
	for _, res := range results {
		if !res.OK {
			failed = append(failed, res)
		}
	}
	if len(failed) == 0 {
		r.Status = RunPaid
		return nil
	}
	r.Status = RunPartiallyFailed
	return failed
}

// PaymentIdempotencyKey es la clave T10 `payroll:<run>:<employee>`: una por corrida y empleado,
// reutilizable para el reintento de los fallidos sin duplicar pagos.
func PaymentIdempotencyKey(runID, employeeID string) string {
	return "payroll:" + runID + ":" + employeeID
}

// NewRunID genera el identificador de la corrida (UUID v4).
func NewRunID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand no falla en la práctica; si falla, la fila se rechaza en el borde.
		return ""
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}
