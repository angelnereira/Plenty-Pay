package server

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
)

// Cada rechazo sale con su código y su reason estable aunque llegue envuelto (go-standards §3.1);
// un defecto sale como INTERNAL sin reason.
func TestObs_ErrorsCarryStableReason(t *testing.T) {
	cases := map[error][2]string{
		domain.ErrProfileMissing:   {codes.FailedPrecondition.String(), "PROFILE_MISSING"},
		domain.ErrInvalidRUC:       {codes.InvalidArgument.String(), "INVALID_RUC"},
		domain.ErrPacNotConfigured: {codes.FailedPrecondition.String(), "PAC_NOT_CONFIGURED"},
		domain.ErrStepUpRequired:   {codes.PermissionDenied.String(), "STEP_UP_REQUIRED"},
		domain.ErrInvalidTaxRate:   {codes.InvalidArgument.String(), "INVALID_TAX_RATE"},
		client.ErrUnavailable:      {codes.Unavailable.String(), "DEPENDENCY_UNAVAILABLE"},
	}
	for err, want := range cases {
		st, _ := status.FromError(toStatus(fmt.Errorf("configurar: %w", err)))
		reason := ""
		for _, d := range st.Details() {
			if info, ok := d.(*errdetails.ErrorInfo); ok {
				reason = info.GetReason()
			}
		}
		if st.Code().String() != want[0] || reason != want[1] {
			t.Fatalf("%v → %v %s, se esperaba %v", err, st.Code(), reason, want)
		}
	}
	st, _ := status.FromError(toStatus(errors.New("pq: conexión rota")))
	if st.Code() != codes.Internal || len(st.Details()) != 0 || !strings.Contains(st.Message(), "fiscal-invoicing") {
		t.Fatalf("defecto: %v", st)
	}
}
