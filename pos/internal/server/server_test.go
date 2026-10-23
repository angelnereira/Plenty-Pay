package server

import (
	"context"
	"fmt"
	"google.golang.org/grpc/metadata"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/service"
)

// F17.4: los errores de estacionar y retomar salen con los `reason` del glosario (§ pos), también
// envueltos por capas superiores.
func TestReasons_ParkAndResumeUseGlossaryNames(t *testing.T) {
	cases := []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrInvalidTransition, codes.FailedPrecondition, "INVALID_STATE_TRANSITION"},
		{domain.ErrEmptySale, codes.FailedPrecondition, "EMPTY_SALE"},
		{domain.ErrSessionClosed, codes.FailedPrecondition, "SESSION_CLOSED"},
		{domain.ErrNotYourSession, codes.PermissionDenied, "NOT_SESSION_OWNER"},
		{domain.ErrSalesPending, codes.FailedPrecondition, "SALES_PENDING"},
		{domain.ErrInvalidLabel, codes.InvalidArgument, "INVALID_REQUEST"},
		{domain.ErrExceedsSoldQty, codes.FailedPrecondition, "EXCEEDS_SOLD_QTY"},
		{domain.ErrNotRefundable, codes.FailedPrecondition, "INVALID_STATE_TRANSITION"},
		{service.ErrStepUpRequired, codes.FailedPrecondition, "STEP_UP_REQUIRED"},
		{service.ErrStepUpInvalid, codes.PermissionDenied, "STEP_UP_INVALID"},
		{domain.ErrKeyReused, codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED"},
	}
	for _, c := range cases {
		st, _ := status.FromError(toStatus(fmt.Errorf("park sale: %w", c.err)))
		reason := ""
		for _, d := range st.Details() {
			if info, ok := d.(*errdetails.ErrorInfo); ok {
				reason = info.Reason
			}
		}
		if st.Code() != c.code || reason != c.reason {
			t.Errorf("%v → %v %q; quiero %v %q", c.err, st.Code(), reason, c.code, c.reason)
		}
	}
}

// F17.11 · R14: la configuración inválida es INVALID_REQUEST y un guardado concurrente,
// VERSION_CONFLICT.
func TestR14_SettingsErrorsUseGlossaryNames(t *testing.T) {
	for _, c := range []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrInvalidSettings, codes.InvalidArgument, "INVALID_REQUEST"},
		{domain.ErrSettingsConflict, codes.Aborted, "VERSION_CONFLICT"},
	} {
		st, _ := status.FromError(toStatus(fmt.Errorf("update settings: %w", c.err)))
		reason := ""
		for _, d := range st.Details() {
			if info, ok := d.(*errdetails.ErrorInfo); ok {
				reason = info.Reason
			}
		}
		if st.Code() != c.code || reason != c.reason {
			t.Errorf("%v → %v %q", c.err, st.Code(), reason)
		}
	}
}

// F17.12 · R15: fuera de alcance es BRANCH_OUT_OF_SCOPE; sin sucursal al abrir, INVALID_REQUEST;
// sin identity, DEPENDENCY_UNAVAILABLE.
func TestR15_BranchErrorsUseGlossaryNames(t *testing.T) {
	for _, c := range []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrBranchOutOfScope, codes.PermissionDenied, "BRANCH_OUT_OF_SCOPE"},
		{domain.ErrBranchRequired, codes.InvalidArgument, "INVALID_REQUEST"},
		{service.ErrBranchesUnavailable, codes.Unavailable, "DEPENDENCY_UNAVAILABLE"},
	} {
		st, _ := status.FromError(toStatus(fmt.Errorf("open session: %w", c.err)))
		reason := ""
		for _, d := range st.Details() {
			if info, ok := d.(*errdetails.ErrorInfo); ok {
				reason = info.Reason
			}
		}
		if st.Code() != c.code || reason != c.reason {
			t.Errorf("%v → %v %q", c.err, st.Code(), reason)
		}
	}
}

// R15: toda persona opera con su alcance; sin cabecera, ninguna sucursal.
func TestR15_AuthorizeSetsScope(t *testing.T) {
	md := metadata.Pairs("x-pp-tenant-id", "018f0000-0000-7000-8000-0000000000a1", "x-pp-user-id", "018f0000-0000-7000-8000-0000000000b2",
		"x-pp-permissions", "pos:sell", "x-pp-actor-service", "api-gateway")
	a, err := authorize(metadata.NewIncomingContext(context.Background(), md), "pos:sell")
	if err != nil || a.Scope == nil || a.Scope.All || len(a.Scope.Branches) != 0 {
		t.Fatalf("sin cabecera = ninguna sucursal: %+v %v", a.Scope, err)
	}
	md.Set("x-pp-branch-scope", "*")
	if a, err := authorize(metadata.NewIncomingContext(context.Background(), md), "pos:sell"); err != nil || !a.Scope.All {
		t.Fatalf("*: %+v %v", a.Scope, err)
	}
}

// R16: un conteo por denominación inválido es INVALID_REQUEST; la sesión cerrada lleva su reporte Z
// y su conteo; una abierta no muestra reporte.
func TestF17_3_ZReportAndCountMapping(t *testing.T) {
	st, _ := status.FromError(toStatus(fmt.Errorf("close session: %w", domain.ErrInvalidCount)))
	reason := ""
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			reason = info.Reason
		}
	}
	if st.Code() != codes.InvalidArgument || reason != "INVALID_REQUEST" {
		t.Fatalf("conteo inválido → %v %q", st.Code(), reason)
	}
	zr := &domain.ZReport{Lines: []domain.ZReportLine{{Key: "rail:CASH", AmountMinor: 214, Count: 2}},
		GrossSalesMinor: 214, NetSalesMinor: 214, SalesCount: 2}
	closed := sessionPB(domain.Session{Status: "CLOSED", Currency: "USD", ZReport: zr,
		CountedByDenom: []domain.CashCount{{DenominationMinor: 100, Quantity: 2}}})
	z := closed.GetZReport()
	if z.GetSalesCount() != 2 || z.GetGrossSales().GetAmountMinor() != 214 || len(z.GetLines()) != 1 ||
		z.GetLines()[0].GetKey() != "rail:CASH" || z.GetLines()[0].GetAmount().GetAmountMinor() != 214 ||
		closed.GetCountedByDenomination()[0].GetDenominationMinor() != 100 {
		t.Fatalf("sesión cerrada: %+v", closed)
	}
	if open := sessionPB(domain.Session{Status: "OPEN", Currency: "USD", ZReport: zr}); open.GetZReport() != nil {
		t.Fatal("una sesión abierta no lleva reporte Z")
	}
}
