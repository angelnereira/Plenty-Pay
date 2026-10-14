package server

import (
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrorInfo lleva el reason estable y el dominio del contrato (F09.4).
func TestErrorInfoCarriesReason(t *testing.T) {
	err := ErrorInfo(codes.NotFound, ReasonNotFound, "negocio no encontrado")
	st, ok := status.FromError(err)
	if !ok {
		t.Fatal("se esperaba un status gRPC")
	}
	if st.Code() != codes.NotFound {
		t.Fatalf("codigo = %v", st.Code())
	}
	details := st.Details()
	if len(details) != 1 {
		t.Fatalf("detalles = %d, se esperaba 1 (ErrorInfo)", len(details))
	}
	info, ok := details[0].(*errdetails.ErrorInfo)
	if !ok {
		t.Fatalf("detalle de tipo %T, se esperaba ErrorInfo", details[0])
	}
	if info.GetReason() != "NOT_FOUND" {
		t.Fatalf("reason = %q", info.GetReason())
	}
	if info.GetDomain() != "plentypay" {
		t.Fatalf("dominio = %q, se esperaba plentypay", info.GetDomain())
	}
}

// El mensaje es para la persona; el reason es el codigo estable.
func TestErrorInfoMessageAndReason(t *testing.T) {
	err := ErrorInfo(codes.FailedPrecondition, ReasonInvalidStateTransition, "la transicion no es valida")
	st, _ := status.FromError(err)
	if st.Message() != "la transicion no es valida" {
		t.Fatalf("mensaje = %q", st.Message())
	}
	if st.Code() != codes.FailedPrecondition {
		t.Fatalf("codigo = %v (regla de negocio: 409 en la tabla 4)", st.Code())
	}
}
