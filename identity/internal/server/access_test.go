package server

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/tenancy"
)

func reasonOf(t *testing.T, err error) (codes.Code, string) {
	t.Helper()
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("no es un status gRPC: %v", err)
	}
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			return st.Code(), info.GetReason()
		}
	}
	return st.Code(), ""
}

// Cada rechazo del modelo de acceso sale con su código gRPC y su reason estable, aunque llegue
// envuelto con la operación que se intentaba (go-standards.md §3.1).
func TestObs_AccessErrorsCarryStableReason(t *testing.T) {
	cases := map[error]struct {
		code   codes.Code
		reason string
	}{
		domain.ErrPermissionNotHeld:          {codes.PermissionDenied, "PERMISSION_NOT_HELD"},
		domain.ErrSelfAssignmentForbidden:    {codes.PermissionDenied, "SELF_ASSIGNMENT_FORBIDDEN"},
		domain.ErrBranchOutOfScope:           {codes.PermissionDenied, "BRANCH_OUT_OF_SCOPE"},
		domain.ErrStepUpRequired:             {codes.PermissionDenied, "STEP_UP_REQUIRED"},
		domain.ErrForbidden:                  {codes.PermissionDenied, "PERMISSION_DENIED"},
		domain.ErrUnauthenticated:            {codes.Unauthenticated, "UNAUTHENTICATED"},
		domain.ErrCapabilityGated:            {codes.FailedPrecondition, "CAPABILITY_DISABLED"},
		domain.ErrRoleInUse:                  {codes.FailedPrecondition, "ROLE_IN_USE"},
		domain.ErrLastOwner:                  {codes.FailedPrecondition, "CANNOT_DEACTIVATE_OWNER"},
		domain.ErrCannotDeactivateLastBranch: {codes.FailedPrecondition, "CANNOT_DEACTIVATE_LAST_BRANCH"},
		domain.ErrBranchCodeTaken:            {codes.AlreadyExists, "BRANCH_CODE_TAKEN"},
		domain.ErrInvalidBranchCode:          {codes.InvalidArgument, "INVALID_BRANCH_CODE"},
		domain.ErrVerticalNotFound:           {codes.InvalidArgument, "VERTICAL_NOT_FOUND"},
		domain.ErrRoleNotFound:               {codes.NotFound, "ROLE_NOT_FOUND"},
		domain.ErrUserNotFound:               {codes.NotFound, "NOT_FOUND"},
		domain.ErrPresetReadOnly:             {codes.FailedPrecondition, "PRESET_READ_ONLY"},
		domain.ErrUnknownPermission:          {codes.InvalidArgument, "UNKNOWN_PERMISSION"},
	}
	for err, want := range cases {
		code, reason := reasonOf(t, toStatus(fmt.Errorf("update membership: %w", err)))
		if code != want.code || reason != want.reason {
			t.Errorf("%v → %v/%s, se esperaba %v/%s", err, code, reason, want.code, want.reason)
		}
	}
}

// Cada reason que identity emite está declarado en el glosario §7.3 (o es transversal).
func TestObs_AccessReasonsDeclaredInGlossary(t *testing.T) {
	b, err := os.ReadFile("../../../docs/glossary.md")
	if err != nil {
		t.Fatalf("leer glosario: %v", err)
	}
	glossary := string(b)
	for _, e := range accessErrors {
		if !strings.Contains(glossary, "`"+e.reason+"`") {
			t.Errorf("reason %s no está en docs/glossary.md", e.reason)
		}
	}
}

// Un error inesperado es un defecto: INTERNAL, sin reason de negocio (el interceptor lo registra
// una vez y reemplaza el mensaje antes de que llegue al cliente).
func TestObs_UnexpectedErrorIsInternal(t *testing.T) {
	code, reason := reasonOf(t, toStatus(errors.New("dial tcp 10.0.0.5:5432: connection refused")))
	if code != codes.Internal || reason != "" {
		t.Fatalf("defecto → %v/%q", code, reason)
	}
}

// Un RPC del modelo de acceso sin actor en el contexto responde UNAUTHENTICATED, nunca datos.
func TestR23_AccessRPCsRequireActor(t *testing.T) {
	srv := newTestServer(t)
	_, err := srv.ListUsers(context.Background(), &pb.ListUsersRequest{TenantId: "otro-tenant"})
	if code, reason := reasonOf(t, err); code != codes.Unauthenticated || reason != "UNAUTHENTICATED" {
		t.Fatalf("ListUsers sin actor → %v/%s", code, reason)
	}
}

// GetAccessCatalog es la copia servida del catálogo: mismos permisos, platform:* marcados, y las
// capacidades "cualquiera de" separadas por coma.
func TestR10_GetAccessCatalogServesCatalog(t *testing.T) {
	srv := newTestServer(t)
	cat, err := srv.GetAccessCatalog(context.Background(), &pb.GetAccessCatalogRequest{})
	if err != nil {
		t.Fatalf("GetAccessCatalog: %v", err)
	}
	if len(cat.GetPermissions()) != len(auth.AllPermissions) || len(cat.GetModuleOrder()) == 0 {
		t.Fatalf("catálogo incompleto: %d permisos", len(cat.GetPermissions()))
	}
	for _, p := range cat.GetPermissions() {
		switch p.GetKey() {
		case "catalog:write":
			if p.GetCapability() != "catalog.products,catalog.services" || p.GetLevel() != "MANAGE" {
				t.Fatalf("catalog:write: %+v", p)
			}
		case "platform:support":
			if !p.GetPlatform() || p.GetCapability() != "" {
				t.Fatalf("platform:support: %+v", p)
			}
		case "payments:refund":
			if !p.GetMoney() || p.GetLevel() != "APPROVE" {
				t.Fatalf("payments:refund: %+v", p)
			}
		}
	}
	verts, err := srv.ListVerticals(context.Background(), &pb.ListVerticalsRequest{})
	if err != nil || len(verts.GetVerticals()) != len(auth.AllVerticals) || len(verts.GetTraits()) != len(auth.AllTraits) {
		t.Fatalf("ListVerticals: %v", err)
	}
}

// ValidateToken devuelve permisos, alcance y capacidades para que el gateway los propague.
func TestR24_ValidateTokenCarriesScopeAndCapabilities(t *testing.T) {
	srv := newTestServer(t)
	res, err := srv.Register(context.Background(), &pb.RegisterRequest{Email: "alcance@example.com", Password: "contraseña-larga-123456", Role: pb.UserRole_CUSTOMER, Consents: requiredConsents()})
	if err != nil || !res.Success {
		t.Fatalf("Register: %v %+v", err, res)
	}
	v, err := srv.ValidateToken(tenancy.WithUser(context.Background(), res.UserId), &pb.ValidateTokenRequest{AccessToken: res.AccessToken})
	if err != nil || !v.Valid {
		t.Fatalf("ValidateToken: %v %+v", err, v)
	}
	if len(v.Permissions) == 0 || v.BranchScope != "" || len(v.Capabilities) != 0 {
		t.Fatalf("un cliente: permisos base, sin alcance ni capacidades: %+v", v)
	}
}
