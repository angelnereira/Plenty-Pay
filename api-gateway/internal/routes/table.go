package routes

import (
	"strings"

	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
)

// Table es la tabla declarativa de rutas (SPEC §4.1). Cada fila es una ruta: el
// handler, la traducción y los chequeos (auth, idempotencia, step-up) salen de
// aquí, no de código por endpoint.
//
// Convenio: `{param}` = UUIDv7; las mutaciones de dinero/estvo exigen
// `Idempotency-Key`; 🔒 = step-up.
var Table = []Route{
	// ── Autenticación (públicas) ───────────────────────────────────────────────
	{
		Method: "POST", Path: "/v1/auth/login", RPC: "/plentypay.identity.v1.Identity/Login",
		NewRequest:  func() proto.Message { return &pb.LoginRequest{} },
		NewResponse: func() proto.Message { return &pb.AuthResult{} },
	},
	{
		Method: "POST", Path: "/v1/auth/register", RPC: "/plentypay.identity.v1.Identity/Register",
		NewRequest:  func() proto.Message { return &pb.RegisterRequest{} },
		NewResponse: func() proto.Message { return &pb.AuthResult{} },
	},
	{
		Method: "POST", Path: "/v1/auth/refresh", RPC: "/plentypay.identity.v1.Identity/RefreshToken",
		NewRequest:  func() proto.Message { return &pb.RefreshTokenRequest{} },
		NewResponse: func() proto.Message { return &pb.AuthResult{} },
	},
	{
		Method: "POST", Path: "/v1/auth/password/forgot", RPC: "/plentypay.identity.v1.Identity/RequestPasswordReset",
		NewRequest:  func() proto.Message { return &pb.RequestPasswordResetRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "POST", Path: "/v1/auth/password/reset", RPC: "/plentypay.identity.v1.Identity/ConfirmPasswordReset",
		Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.ConfirmPasswordResetRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "POST", Path: "/v1/invitations/accept", RPC: "/plentypay.identity.v1.Identity/AcceptInvitation",
		Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.AcceptInvitationRequest{} },
		NewResponse: func() proto.Message { return &pb.AuthResult{} },
	},

	// ── Cuenta (autenticadas) ──────────────────────────────────────────────────
	{
		Method: "GET", Path: "/v1/me", RPC: "/plentypay.identity.v1.Identity/ValidateToken", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.ValidateTokenRequest{} },
		NewResponse: func() proto.Message { return &pb.ValidateTokenResult{} },
	},
	{
		Method: "GET", Path: "/v1/me/permissions", RPC: "/plentypay.identity.v1.Identity/GetUserPermissions", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.GetUserPermissionsRequest{} },
		NewResponse: func() proto.Message { return &pb.UserPermissions{} },
	},
	{
		// 🔒 step-up (SPEC §4; R14 de identity).
		Method: "POST", Path: "/v1/me/password", RPC: "/plentypay.identity.v1.Identity/ChangePassword",
		RequireAuth: true, StepUp: true, Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.ChangePasswordRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "POST", Path: "/v1/step-up/challenge", RPC: "/plentypay.identity.v1.Identity/IssueStepUpChallenge", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.StepUpRequest{} },
		NewResponse: func() proto.Message { return &pb.PasskeyChallenge{} },
	},
	{
		Method: "POST", Path: "/v1/step-up/verify", RPC: "/plentypay.identity.v1.Identity/VerifyStepUp", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.VerifyStepUpRequest{} },
		NewResponse: func() proto.Message { return &pb.StepUpToken{} },
	},

	// ── Negocio (tenant) ───────────────────────────────────────────────────────
	{
		Method: "POST", Path: "/v1/business", RPC: "/plentypay.identity.v1.Identity/CreateBusiness",
		RequireAuth: true, Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.CreateBusinessRequest{} },
		NewResponse: func() proto.Message { return &pb.CreateBusinessResult{} },
	},
	{
		Method: "GET", Path: "/v1/business/{tenant_id}", RPC: "/plentypay.identity.v1.Identity/GetTenant",
		RequireAuth: true,
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		NewRequest:  func() proto.Message { return &pb.GetTenantRequest{} },
		NewResponse: func() proto.Message { return &pb.Tenant{} },
	},
	{
		Method: "GET", Path: "/v1/business/staff/{tenant_id}", RPC: "/plentypay.identity.v1.Identity/ListUsers",
		RequireAuth: true,
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		QueryParams: map[string]string{"page_size": "page_size", "page_token": "page_token"},
		NewRequest:  func() proto.Message { return &pb.ListUsersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListUsersResult{} },
	},
	{
		Method: "POST", Path: "/v1/business/staff", RPC: "/plentypay.identity.v1.Identity/InviteStaff",
		RequireAuth: true, Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.InviteStaffRequest{} },
		NewResponse: func() proto.Message { return &pb.Invitation{} },
	},
	{
		Method: "DELETE", Path: "/v1/business/staff/{user_id}", RPC: "/plentypay.identity.v1.Identity/DeactivateUser",
		RequireAuth: true, Idempotency: true,
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.DeactivateUserRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "GET", Path: "/v1/business/roles/{tenant_id}", RPC: "/plentypay.identity.v1.Identity/ListRoles",
		RequireAuth: true,
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		NewRequest:  func() proto.Message { return &pb.ListRolesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListRolesResult{} },
	},
	{
		Method: "POST", Path: "/v1/business/roles", RPC: "/plentypay.identity.v1.Identity/UpsertRole",
		RequireAuth: true, StepUp: true, Idempotency: true,
		NewRequest:  func() proto.Message { return &pb.UpsertRoleRequest{} },
		NewResponse: func() proto.Message { return &pb.Role{} },
	},
	{
		Method: "POST", Path: "/v1/business/roles/{user_id}/assign", RPC: "/plentypay.identity.v1.Identity/AssignRole",
		RequireAuth: true, StepUp: true, Idempotency: true,
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.AssignRoleRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
}

// Find busca una ruta por método y path exacto (`{param}` comodín).
func Find(method, path string) (Route, bool) {
	for _, r := range Table {
		if r.Method == method && matchPath(r.Path, path) {
			return r, true
		}
	}
	return Route{}, false
}

func matchPath(pattern, path string) bool {
	pp := splitPath(pattern)
	sp := splitPath(path)
	if len(pp) != len(sp) {
		return false
	}
	for i, seg := range pp {
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			continue
		}
		if seg != sp[i] {
			return false
		}
	}
	return true
}

func splitPath(p string) []string {
	p = strings.Trim(p, "/")
	if p == "" {
		return nil
	}
	return strings.Split(p, "/")
}
