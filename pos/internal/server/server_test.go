package server

import (
	"fmt"
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
