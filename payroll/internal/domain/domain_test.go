package domain

import (
	"bytes"
	"testing"
	"time"
)

func TestR5_EmployeeValidate_SalaryOK(t *testing.T) {
	e := Employee{TenantID: "t1", FullName: "Ana", PayType: PayTypeSalary, BaseSalaryMinor: 250000, PayFrequency: PayFrequencySemimonthly}
	if err := e.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestF19_1_EmployeeValidate_RejectsMissingData(t *testing.T) {
	e := Employee{PayType: PayTypeSalary, BaseSalaryMinor: 1, PayFrequency: PayFrequencyMonthly}
	if err := e.Validate(); err != ErrInvalidEmployee {
		t.Fatalf("expected ErrInvalidEmployee, got %v", err)
	}
}

// F19.1 / N-DAT-04: la cédula nunca sale del contenedor; la vista no la incluye.
func TestF19_1_EmployeeView_OmitsNationalID(t *testing.T) {
	e := Employee{ID: "e1", FullName: "Ana", NationalIDCiphertext: []byte("cipher"), PayType: PayTypeSalary}
	v := e.View()
	if v.FullName == "" || v.ID != "e1" {
		t.Fatalf("unexpected view %+v", v)
	}
	// la vista no tiene campo de cédula (el tipo EmployeeView no lo declara).
	if v.ID == "" || v.FullName == "" {
		t.Fatalf("unexpected empty view %+v", v)
	}
	if bytes.Contains([]byte(v.FullName), []byte("cipher")) {
		t.Fatal("leak: ciphertext in view")
	}
}

func TestF19_1_EmployeeValidateSalaryLegal_BelowMinimumWage(t *testing.T) {
	e := Employee{TenantID: "t1", FullName: "Ana", PayType: PayTypeSalary, BaseSalaryMinor: 1000, PayFrequency: PayFrequencyMonthly, LegalParamsVersionTag: "2026-10-01"}
	if err := e.ValidateSalaryLegal(120000); err == nil {
		t.Fatal("expected BELOW_MINIMUM_WAGE")
	}
	if err := e.ValidateSalaryLegal(500); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

// F19.2 / N-LAB-01: clasificación de turno.
func TestF19_2_ClassifyShift(t *testing.T) {
	cases := []struct {
		start, end int
		want       ShiftKind
	}{
		{9, 17, ShiftKindDiurnal},
		{22, 6, ShiftKindNocturnal},
		{17, 23, ShiftKindMixed},
	}
	for _, c := range cases {
		if got := ClassifyShift(c.start, c.end); got != c.want {
			t.Fatalf("ClassifyShift(%d,%d) = %s, want %s", c.start, c.end, got, c.want)
		}
	}
}

func TestF19_2_ShiftWorkedMinutes_SubsBreak(t *testing.T) {
	s := Shift{TenantID: "t1", Name: "mañana", BreakMinutes: 60, GraceMinutes: 5}
	in := time.Date(2026, 10, 19, 9, 0, 0, 0, time.UTC)
	out := time.Date(2026, 10, 19, 18, 0, 0, 0, time.UTC)
	if got := s.WorkedMinutes(in, out); got != 480 {
		t.Fatalf("expected 480, got %d", got)
	}
}

// R4: secuencia IN → (BREAK_START → BREAK_END)* → OUT.
func TestR4_ClockSequence_Valid(t *testing.T) {
	ts := time.Date(2026, 10, 19, 9, 0, 0, 0, time.UTC)
	st := ClockState{}
	step := func(kind string, at time.Time) ClockState {
		t.Helper()
		_, next, err := ApplyClock(st, ClockContext{EmployeeID: "e1", Kind: kind, Method: MethodPIN, RecordedAt: at})
		if err != nil {
			t.Fatalf("kind %s: %v", kind, err)
		}
		return next
	}
	st = step(ClockIn, ts)
	st = step(ClockBreakStart, ts.Add(4*time.Hour))
	st = step(ClockBreakEnd, ts.Add(5*time.Hour))
	st = step(ClockOut, ts.Add(9*time.Hour))
	if st.Open {
		t.Fatal("expected closed sequence")
	}
}

func TestR4_ClockSequence_InvalidOutWithoutIn(t *testing.T) {
	st := ClockState{}
	_, _, err := ApplyClock(st, ClockContext{EmployeeID: "e1", Kind: ClockOut, Method: MethodPIN, RecordedAt: time.Now()})
	if err != ErrInvalidClockSequence {
		t.Fatalf("expected ErrInvalidClockSequence, got %v", err)
	}
}

func TestR4_ClockSequence_DuplicateWithinWindow(t *testing.T) {
	ts := time.Date(2026, 10, 19, 9, 0, 0, 0, time.UTC)
	_, st, err := ApplyClock(ClockState{}, ClockContext{EmployeeID: "e1", Kind: ClockIn, Method: MethodPIN, RecordedAt: ts})
	if err != nil {
		t.Fatalf("first IN: %v", err)
	}
	_, _, err = ApplyClock(st, ClockContext{EmployeeID: "e1", Kind: ClockIn, Method: MethodPIN, RecordedAt: ts.Add(30 * time.Second)})
	if err == nil {
		t.Fatal("expected duplicate rejection")
	}
}

// R1: biometría solo en dispositivo, con consentimiento y prueba de vida.
func TestR1_Biometric_RequiresEnrollment(t *testing.T) {
	_, _, err := ApplyClock(ClockState{}, ClockContext{EmployeeID: "e1", Kind: ClockIn, Method: MethodBiometric, HasBiometric: false})
	if err != ErrBiometricNotEnrolled {
		t.Fatalf("expected ErrBiometricNotEnrolled, got %v", err)
	}
}

func TestR1_Biometric_LowLiveness(t *testing.T) {
	_, _, err := ApplyClock(ClockState{}, ClockContext{
		EmployeeID: "e1", Kind: ClockIn, Method: MethodBiometric,
		HasBiometric: true, BiometricConsent: true, LivenessOK: false,
	})
	if err != ErrLowLiveness {
		t.Fatalf("expected ErrLowLiveness, got %v", err)
	}
}

func TestR1_Biometric_RequiresConsent(t *testing.T) {
	_, _, err := ApplyClock(ClockState{}, ClockContext{
		EmployeeID: "e1", Kind: ClockIn, Method: MethodBiometric,
		HasBiometric: true, BiometricConsent: false, LivenessOK: true,
	})
	if err != ErrConsentRequired {
		t.Fatalf("expected ErrConsentRequired, got %v", err)
	}
}

// R3: fuera de geocerca el marcaje se acepta pero queda para revisión.
func TestR3_Geofence_OutsideMarksNeedsReview(t *testing.T) {
	ev, _, err := ApplyClock(ClockState{}, ClockContext{
		EmployeeID: "e1", Kind: ClockIn, Method: MethodPIN,
		HasGeofence: true, InsideGeofence: false,
	})
	if err != nil {
		t.Fatalf("expected accepted, got %v", err)
	}
	if !ev.NeedsReview {
		t.Fatal("expected needs_review=true")
	}
}

func TestR3_Geofence_InsideClean(t *testing.T) {
	ev, _, err := ApplyClock(ClockState{}, ClockContext{
		EmployeeID: "e1", Kind: ClockIn, Method: MethodPIN,
		HasGeofence: true, InsideGeofence: true,
	})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if ev.NeedsReview {
		t.Fatal("expected needs_review=false")
	}
}

func TestR4_Override_RequiresReason(t *testing.T) {
	if err := ValidateOverride("", "mgr1"); err != ErrOverrideReasonNeeded {
		t.Fatalf("expected ErrOverrideReasonNeeded, got %v", err)
	}
	if err := ValidateOverride("ajuste", "mgr1"); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

// F19.4: la sesión de quiosco caduca a las 12 h y se puede revocar.
func TestF19_4_KioskSession_Expiry(t *testing.T) {
	now := time.Now()
	k := KioskSession{ID: "k1", TenantID: "t1", ExpiresAt: now.Add(12 * time.Hour)}
	if !k.ValidAt(now.Add(11 * time.Hour)) {
		t.Fatal("expected valid")
	}
	if k.ValidAt(now.Add(13 * time.Hour)) {
		t.Fatal("expected expired")
	}
	rev := now
	k2 := KioskSession{ID: "k2", TenantID: "t1", ExpiresAt: now.Add(12 * time.Hour), RevokedAt: &rev}
	if k2.ValidAt(now) {
		t.Fatal("expected revoked -> invalid")
	}
}

func lpFixture() LegalParams {
	return LegalParams{
		Version:         "legal.pa@2026-10-01",
		MinWageMinor:    120000,
		Rates:           OvertimeRates{DayMinor: 2500, NightMinor: 5000, MixedMinor: 7500},
		SocialSecPctBps: 975, // 9.75 %
		EduSecPctBps:    100, // 1 %
		ISRBracket: []ISRBracket{
			{UpToMinor: 5000, RateBps: 0},
			{UpToMinor: 10000, RateBps: 1500},
			{UpToMinor: 0, RateBps: 2000},
		},
	}
}

// R5: cálculo de nómina — deducciones, redono half-up y net ≥ 0.
func TestR5_ComputePayslip_HourlyWithOvertime(t *testing.T) {
	e := Employee{ID: "e1", TenantID: "t1", FullName: "Luis", PayType: PayTypeHourly, HourlyRateMinor: 1000, PayFrequency: PayFrequencyBiweekly}
	in := PayslipInput{
		Employee:  e,
		Hours:     HoursSummary{RegularMin: 480, OvertimeMin: 60},
		ShiftKind: ShiftKindDiurnal,
	}
	ps, err := ComputePayslip(in, lpFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	// regular 8h * 1000 = 8000; extra 1h = 1000 + 25 % = 1250 → gross 9250
	if ps.GrossMinor != 9250 {
		t.Fatalf("expected gross 9250, got %d", ps.GrossMinor)
	}
	if ps.NetMinor >= ps.GrossMinor || ps.NetMinor <= 0 {
		t.Fatalf("unexpected net %d (gross %d)", ps.NetMinor, ps.GrossMinor)
	}
	if ps.LegalParams != "legal.pa@2026-10-01" {
		t.Fatalf("expected legal params version, got %s", ps.LegalParams)
	}
}

func TestR5_ComputePayslip_NightRecargo(t *testing.T) {
	e := Employee{ID: "e2", PayType: PayTypeHourly, HourlyRateMinor: 1000, PayFrequency: PayFrequencyBiweekly}
	ps, err := ComputePayslip(PayslipInput{Employee: e, Hours: HoursSummary{RegularMin: 60, OvertimeMin: 60}, ShiftKind: ShiftKindNocturnal}, lpFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	// regular 1000; extra 1000 + 50 % = 1500 → 2500
	if ps.GrossMinor != 2500 {
		t.Fatalf("expected gross 2500, got %d", ps.GrossMinor)
	}
}

func TestR5_ComputePayslip_RequiresLegalParams(t *testing.T) {
	e := Employee{ID: "e3", PayType: PayTypeSalary, BaseSalaryMinor: 300000, PayFrequency: PayFrequencyMonthly}
	if _, err := ComputePayslip(PayslipInput{Employee: e}, LegalParams{}); err != ErrNoLegalParams {
		t.Fatalf("expected ErrNoLegalParams, got %v", err)
	}
}

// R6: aprobación exige step-up, no ser el creador, tasa de riesgo y asistencia sin revisión.
func TestR6_Approve_RejectsCreator(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunDraft}
	if err := r.Approve(ApproveInput{ApproverID: "u1", StepUpVerified: true, HasRiskRate: true}); err != ErrCannotApproveOwnRun {
		t.Fatalf("expected ErrCannotApproveOwnRun, got %v", err)
	}
}

func TestR6_Approve_RequiresStepUp(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunDraft}
	if err := r.Approve(ApproveInput{ApproverID: "u2", HasRiskRate: true}); err != ErrStepUpRequired {
		t.Fatalf("expected ErrStepUpRequired, got %v", err)
	}
}

func TestR6_Approve_RequiresRiskRate(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunDraft}
	if err := r.Approve(ApproveInput{ApproverID: "u2", StepUpVerified: true}); err != ErrRiskRateMissing {
		t.Fatalf("expected ErrRiskRateMissing, got %v", err)
	}
}

func TestR6_Approve_RejectsAttendanceUnderReview(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunDraft}
	err := r.Approve(ApproveInput{ApproverID: "u2", StepUpVerified: true, HasRiskRate: true, HasAttendanceReview: true})
	if err != ErrAttendanceNeedsReview {
		t.Fatalf("expected ErrAttendanceNeedsReview, got %v", err)
	}
}

func TestR6_Approve_OK(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunDraft}
	if err := r.Approve(ApproveInput{ApproverID: "u2", StepUpVerified: true, HasRiskRate: true}); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if r.Status != RunApproved {
		t.Fatalf("expected APPROVED, got %s", r.Status)
	}
}

func TestR6_Approve_ImmutableAfterApproved(t *testing.T) {
	r := &Run{ID: "r1", CreatedBy: "u1", Status: RunApproved}
	if err := r.Approve(ApproveInput{ApproverID: "u2", StepUpVerified: true, HasRiskRate: true}); err != ErrInvalidStateTransition {
		t.Fatalf("expected ErrInvalidStateTransition, got %v", err)
	}
}

func TestR6_Pay_InsufficientFunds(t *testing.T) {
	r := &Run{ID: "r1", Status: RunApproved, Payslips: []Payslip{{EmployeeID: "e1", NetMinor: 5000}}, TotalNet: 5000}
	if _, err := r.Pay(PayInput{WalletBalanceMinor: 100}); err != ErrInsufficientFunds {
		t.Fatalf("expected ErrInsufficientFunds, got %v", err)
	}
	if r.Status != RunApproved {
		t.Fatal("state must not change on failure")
	}
}

func TestR6_Pay_PartiallyFailed(t *testing.T) {
	r := &Run{ID: "r1", Status: RunApproved, Payslips: []Payslip{
		{EmployeeID: "e1", NetMinor: 100}, {EmployeeID: "e2", NetMinor: 200},
	}}
	r.Recalculate()
	res, err := r.Pay(PayInput{WalletBalanceMinor: 10000})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	res[1].OK = false
	res[1].Reason = "INSUFFICIENT_FUNDS"
	failed := r.SettlePayments(res)
	if r.Status != RunPartiallyFailed {
		t.Fatalf("expected PARTIALLY_FAILED, got %s", r.Status)
	}
	if len(failed) != 1 || failed[0].EmployeeID != "e2" {
		t.Fatalf("expected only e2 failed, got %+v", failed)
	}
}

func TestR6_Pay_AllPaid(t *testing.T) {
	r := &Run{ID: "r1", Status: RunApproved, Payslips: []Payslip{{EmployeeID: "e1", NetMinor: 100}}}
	r.Recalculate()
	res, err := r.Pay(PayInput{WalletBalanceMinor: 10000})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	r.SettlePayments(res)
	if r.Status != RunPaid {
		t.Fatalf("expected PAID, got %s", r.Status)
	}
}

// T10: la clave de idempotencia del pago es estable por corrida+empleado (reintento seguro).
func TestT10_PaymentIdempotencyKey_Stable(t *testing.T) {
	k1 := PaymentIdempotencyKey("run1", "emp1")
	k2 := PaymentIdempotencyKey("run1", "emp1")
	k3 := PaymentIdempotencyKey("run1", "emp2")
	if k1 != k2 {
		t.Fatal("expected stable key across retries")
	}
	if k1 == k3 {
		t.Fatal("expected distinct key per employee")
	}
	if k1 != "payroll:run1:emp1" {
		t.Fatalf("unexpected key %s", k1)
	}
}

func TestNewRunID_Unique(t *testing.T) {
	a, b := NewRunID(), NewRunID()
	if a == "" || len(a) != 36 {
		t.Fatalf("unexpected id %q", a)
	}
	if a == b {
		t.Fatal("expected unique ids")
	}
}
