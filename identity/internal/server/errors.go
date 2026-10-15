package server

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
)

// domainPlentypay es el dominio de los ErrorInfo (grpc-conventions.md §4).
const domainPlentypay = "plentypay"

// ErrorInfo construye un error gRPC con el reason estable en google.rpc.Status
// (grpc-conventions.md §4). El mensaje es para la persona; el reason es el código
// que traduce la app. Ningún detalle interno viaja aquí.
func ErrorInfo(code codes.Code, reason, message string) error {
	st := status.New(code, message)
	stWithDetails, err := st.WithDetails(&errdetails.ErrorInfo{
		Reason: reason,
		Domain: domainPlentypay,
	})
	if err != nil {
		// Sin detalles el cliente sigue teniendo código y mensaje.
		return st.Err()
	}
	return stWithDetails.Err()
}

// Razones transversales que usa identity (catálogo: docs/glossary.md §7.3).
const (
	ReasonNotFound             = "NOT_FOUND"
	ReasonInvalidStateTransition = "INVALID_STATE_TRANSITION"
	ReasonAlreadyExists        = "ALREADY_EXISTS"
	ReasonPermissionDenied     = "PERMISSION_DENIED"
	ReasonUnauthenticated      = "UNAUTHENTICATED"
)
