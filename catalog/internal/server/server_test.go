package server

import (
	"context"
	"errors"
	"fmt"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/catalog/internal/client"
	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/pb"
)

func reasonOf(t *testing.T, err error) (codes.Code, string) {
	t.Helper()
	st := status.Convert(err)
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			return st.Code(), info.GetReason()
		}
	}
	return st.Code(), ""
}

func actorCtx(tenant, perms string) context.Context {
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs(
		"x-pp-tenant-id", tenant, "x-pp-user-id", "01900000-0000-7000-8000-000000000001", "x-pp-permissions", perms))
}

func TestADR0011_TenantAndPermissionComeFromMetadata(t *testing.T) {
	const tenant = "01900000-0000-7000-8000-0000000000aa"
	if _, err := authorize(actorCtx("", "catalog:write"), "catalog:write"); err == nil {
		t.Fatal("sin tenant debe fallar")
	} else if c, r := reasonOf(t, err); c != codes.PermissionDenied || r != "TENANT_REQUIRED" {
		t.Fatalf("%v %s", c, r)
	}
	if _, err := authorize(actorCtx(tenant, "catalog:read"), "catalog:write"); err == nil {
		t.Fatal("sin permiso debe fallar")
	} else if _, r := reasonOf(t, err); r != "PERMISSION_DENIED" {
		t.Fatal(r)
	}
	a, err := authorize(actorCtx(tenant, "catalog:read, catalog:write"), "catalog:write")
	if err != nil || a.TenantID != tenant {
		t.Fatalf("%v %+v", err, a)
	}
}

func TestN_FIS_01_TaxTreatmentMustBeDeclared(t *testing.T) {
	if ok, err := taxRateSet(&pb.Product{}); ok || err != nil {
		t.Fatal("sin tasa ni exento: tratamiento ausente")
	}
	if ok, _ := taxRateSet(&pb.Product{TaxExempt: true}); !ok {
		t.Fatal("exento declarado")
	}
	if ok, _ := taxRateSet(&pb.Product{TaxRateBps: 700}); !ok {
		t.Fatal("tasa declarada")
	}
	if _, err := taxRateSet(&pb.Product{TaxExempt: true, TaxRateBps: 700}); err == nil {
		t.Fatal("exento con tasa es contradictorio")
	}
}

func TestReasons_DomainErrorsMapToStableReasons(t *testing.T) {
	cases := []struct {
		err    error
		code   codes.Code
		reason string
	}{
		{domain.ErrNotFound, codes.NotFound, "NOT_FOUND"},
		{domain.ErrSKUTaken, codes.AlreadyExists, "SKU_TAKEN"},
		{domain.ErrBarcodeTaken, codes.AlreadyExists, "BARCODE_TAKEN"},
		{domain.ErrInvalidBarcode, codes.InvalidArgument, "INVALID_BARCODE"},
		{domain.ErrInvalidUnit, codes.InvalidArgument, "INVALID_UNIT"},
		{domain.ErrInvalidTaxRate, codes.InvalidArgument, "INVALID_TAX_RATE"},
		{domain.ErrTaxTreatment, codes.InvalidArgument, "TAX_TREATMENT_MISSING"},
		{domain.ErrCategoryDepth, codes.InvalidArgument, "CATEGORY_DEPTH_EXCEEDED"},
		{domain.ErrInvalidTransition, codes.FailedPrecondition, "INVALID_STATE_TRANSITION"},
		{fmt.Errorf("wrap: %w", client.ErrUnavailable), codes.Unavailable, "DEPENDENCY_UNAVAILABLE"},
	}
	for _, c := range cases {
		code, reason := reasonOf(t, toStatus(c.err))
		if code != c.code || reason != c.reason {
			t.Errorf("%v → %v %s; se esperaba %v %s", c.err, code, reason, c.code, c.reason)
		}
	}
	// Lo desconocido es un defecto: INTERNAL (el interceptor oculta el detalle al cliente).
	if code, _ := reasonOf(t, toStatus(errors.New("boom"))); code != codes.Internal {
		t.Fatal(code)
	}
}

func TestPageTokenRoundTrip(t *testing.T) {
	tok, err := encodeToken(nil)
	if err != nil || tok != "" {
		t.Fatal("sin cursor no hay token")
	}
	if _, err := decodeToken("%%%"); err == nil {
		t.Fatal("token inválido aceptado")
	}
}
