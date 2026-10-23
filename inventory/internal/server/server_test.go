package server

import (
	"fmt"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/inventory/internal/domain"
)

func reasonOf(t *testing.T, err error) (codes.Code, string) {
	t.Helper()
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("no es un status gRPC: %v", err)
	}
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			return st.Code(), info.Reason
		}
	}
	return st.Code(), ""
}

// Las compras (F16.5) responden con los `reason` del glosario (§ inventory), también cuando el
// error del dominio llega envuelto por capas superiores.
func TestReasons_PurchasingErrorsUseGlossaryNames(t *testing.T) {
	cases := []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrInvalidSupplier, codes.InvalidArgument, "INVALID_SUPPLIER"},
		{domain.ErrInvalidOrder, codes.InvalidArgument, "INVALID_REQUEST"},
		{domain.ErrPOTransition, codes.FailedPrecondition, "INVALID_STATE_TRANSITION"},
		{domain.ErrOverReceipt, codes.FailedPrecondition, "RECEIPT_EXCEEDS_ORDERED"},
		{domain.ErrNotInOrder, codes.InvalidArgument, "UNKNOWN_ORDER_LINE"},
	}
	for _, c := range cases {
		code, reason := reasonOf(t, toStatus(fmt.Errorf("receive goods: %w", c.err)))
		if code != c.code || reason != c.reason {
			t.Errorf("%v → %v %q; quiero %v %q", c.err, code, reason, c.code, c.reason)
		}
	}
}

// F16.10: bloquear más de lo disponible es OUT_OF_STOCK; desbloquear más de lo bloqueado,
// EXCEEDS_BLOCKED; días de aviso fuera de rango, INVALID_REQUEST.
func TestF16_10_BlockErrorsUseGlossaryNames(t *testing.T) {
	cases := []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrOutOfStock, codes.FailedPrecondition, "OUT_OF_STOCK"},
		{domain.ErrExceedsBlocked, codes.FailedPrecondition, "EXCEEDS_BLOCKED"},
		{domain.ErrInvalidSettings, codes.InvalidArgument, "INVALID_REQUEST"},
		{domain.ErrReasonRequired, codes.InvalidArgument, "MOVEMENT_REASON_REQUIRED"},
		{domain.ErrLotRequired, codes.InvalidArgument, "LOT_REQUIRED"},
	}
	for _, c := range cases {
		code, reason := reasonOf(t, toStatus(fmt.Errorf("adjust stock: %w", c.err)))
		if code != c.code || reason != c.reason {
			t.Errorf("%v → %v %q; quiero %v %q", c.err, code, reason, c.code, c.reason)
		}
	}
}
