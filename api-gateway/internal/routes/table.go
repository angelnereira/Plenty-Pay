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
		// S-GEN-17: el token va en el cuerpo (nunca en la URL, que queda en los registros).
		Method: "POST", Path: "/v1/invitations/preview", RPC: "/plentypay.identity.v1.Identity/PreviewInvitation",
		NewRequest:  func() proto.Message { return &pb.PreviewInvitationRequest{} },
		NewResponse: func() proto.Message { return &pb.InvitationPreview{} },
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

	// ── Modelo de acceso (ADR 0018, SPEC §4.1). Van antes de /v1/business/{tenant_id}: Find
	// recorre la tabla en orden y los segmentos literales deben ganar al comodín. ──────────
	{
		Method: "GET", Path: "/v1/access/catalog", RPC: "/plentypay.identity.v1.Identity/GetAccessCatalog", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.GetAccessCatalogRequest{} },
		NewResponse: func() proto.Message { return &pb.AccessCatalog{} },
	},
	{
		Method: "GET", Path: "/v1/verticals", RPC: "/plentypay.identity.v1.Identity/ListVerticals", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.ListVerticalsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListVerticalsResult{} },
	},
	{
		Method: "GET", Path: "/v1/role-templates", RPC: "/plentypay.identity.v1.Identity/ListRoleTemplates", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.ListRoleTemplatesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListRoleTemplatesResult{} },
	},
	{
		Method: "GET", Path: "/v1/business/profile", RPC: "/plentypay.identity.v1.Identity/GetBusinessProfile", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.GetBusinessProfileRequest{} },
		NewResponse: func() proto.Message { return &pb.BusinessProfile{} },
	},
	{
		Method: "PUT", Path: "/v1/business/profile", RPC: "/plentypay.identity.v1.Identity/UpdateBusinessProfile",
		RequireAuth: true, Idempotency: true, Permission: "admin:business:manage",
		NewRequest:  func() proto.Message { return &pb.UpdateBusinessProfileRequest{} },
		NewResponse: func() proto.Message { return &pb.BusinessProfile{} },
	},
	{
		// 🔒 al apagar Finanzas o Equipo (identity consume el step-up, OpCapabilitiesSet).
		Method: "PUT", Path: "/v1/business/capabilities", RPC: "/plentypay.identity.v1.Identity/SetCapabilities",
		RequireAuth: true, Idempotency: true, StepUp: true, Permission: "admin:business:manage",
		NewRequest:  func() proto.Message { return &pb.SetCapabilitiesRequest{} },
		NewResponse: func() proto.Message { return &pb.BusinessProfile{} },
	},
	{
		Method: "GET", Path: "/v1/business/branches", RPC: "/plentypay.identity.v1.Identity/ListBranches", RequireAuth: true,
		QueryParams: map[string]string{"include_inactive": "include_inactive"},
		NewRequest:  func() proto.Message { return &pb.ListBranchesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListBranchesResult{} },
	},
	{
		Method: "POST", Path: "/v1/business/branches", RPC: "/plentypay.identity.v1.Identity/UpsertBranch",
		RequireAuth: true, Idempotency: true, Permission: "admin:business:manage",
		NewRequest:  func() proto.Message { return &pb.UpsertBranchRequest{} },
		NewResponse: func() proto.Message { return &pb.Branch{} },
	},
	{
		Method: "POST", Path: "/v1/business/branches/{branch_id}/deactivate", RPC: "/plentypay.identity.v1.Identity/DeactivateBranch",
		RequireAuth: true, Idempotency: true, Permission: "admin:business:manage",
		PathParams:  map[string]string{"branch_id": "branch_id"},
		NewRequest:  func() proto.Message { return &pb.BranchRef{} },
		NewResponse: func() proto.Message { return &pb.Branch{} },
	},
	{
		Method: "POST", Path: "/v1/business/branches/{branch_id}/reactivate", RPC: "/plentypay.identity.v1.Identity/ReactivateBranch",
		RequireAuth: true, Idempotency: true, Permission: "admin:business:manage",
		PathParams:  map[string]string{"branch_id": "branch_id"},
		NewRequest:  func() proto.Message { return &pb.BranchRef{} },
		NewResponse: func() proto.Message { return &pb.Branch{} },
	},
	{
		Method: "GET", Path: "/v1/business/staff", RPC: "/plentypay.identity.v1.Identity/ListUsers",
		RequireAuth: true, Permission: "admin:users:manage",
		QueryParams: map[string]string{"page_size": "page_size", "page_token": "page_token"},
		NewRequest:  func() proto.Message { return &pb.ListUsersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListUsersResult{} },
	},
	{
		// 🔒 si el cambio suma permisos de dinero (identity consume el step-up, OpMembershipUpdate).
		Method: "PUT", Path: "/v1/business/staff/{user_id}/membership", RPC: "/plentypay.identity.v1.Identity/UpdateMembership",
		RequireAuth: true, Idempotency: true, StepUp: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.UpdateMembershipRequest{} },
		NewResponse: func() proto.Message { return &pb.UserSummary{} },
	},
	{
		Method: "POST", Path: "/v1/business/staff/{user_id}/suspend", RPC: "/plentypay.identity.v1.Identity/SuspendUser",
		RequireAuth: true, Idempotency: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.SetUserStatusRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "POST", Path: "/v1/business/staff/{user_id}/reactivate", RPC: "/plentypay.identity.v1.Identity/ReactivateUser",
		RequireAuth: true, Idempotency: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.SetUserStatusRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		Method: "GET", Path: "/v1/business/invitations", RPC: "/plentypay.identity.v1.Identity/ListInvitations",
		RequireAuth: true, Permission: "admin:users:manage",
		QueryParams: map[string]string{"page_size": "page_size", "page_token": "page_token"},
		NewRequest:  func() proto.Message { return &pb.ListInvitationsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListInvitationsResult{} },
	},
	{
		Method: "POST", Path: "/v1/business/invitations/{invitation_id}/resend", RPC: "/plentypay.identity.v1.Identity/ResendInvitation",
		RequireAuth: true, Idempotency: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"invitation_id": "invitation_id"},
		NewRequest:  func() proto.Message { return &pb.InvitationRef{} },
		NewResponse: func() proto.Message { return &pb.Invitation{} },
	},
	{
		Method: "DELETE", Path: "/v1/business/invitations/{invitation_id}", RPC: "/plentypay.identity.v1.Identity/RevokeInvitation",
		RequireAuth: true, Idempotency: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"invitation_id": "invitation_id"},
		NewRequest:  func() proto.Message { return &pb.InvitationRef{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},
	{
		// ListRoles lo necesitan admin:roles:manage y admin:users:manage (invitar): identity verifica.
		Method: "GET", Path: "/v1/business/roles", RPC: "/plentypay.identity.v1.Identity/ListRoles", RequireAuth: true,
		NewRequest:  func() proto.Message { return &pb.ListRolesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListRolesResult{} },
	},
	{
		Method: "DELETE", Path: "/v1/business/roles/{role_id}", RPC: "/plentypay.identity.v1.Identity/ArchiveRole",
		RequireAuth: true, Idempotency: true, Permission: "admin:roles:manage",
		PathParams:  map[string]string{"role_id": "role_id"},
		NewRequest:  func() proto.Message { return &pb.ArchiveRoleRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
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
		// Compatibilidad: el tenant_id del path se ignora; identity usa el del token (ADR 0011).
		Method: "GET", Path: "/v1/business/staff/{tenant_id}", RPC: "/plentypay.identity.v1.Identity/ListUsers",
		RequireAuth: true, Permission: "admin:users:manage",
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		QueryParams: map[string]string{"page_size": "page_size", "page_token": "page_token"},
		NewRequest:  func() proto.Message { return &pb.ListUsersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListUsersResult{} },
	},
	{
		// 🔒 si el rol mueve dinero (identity consume el step-up, OpStaffInvite).
		Method: "POST", Path: "/v1/business/staff", RPC: "/plentypay.identity.v1.Identity/InviteStaff",
		RequireAuth: true, Idempotency: true, StepUp: true, Permission: "admin:users:manage",
		NewRequest:  func() proto.Message { return &pb.InviteStaffRequest{} },
		NewResponse: func() proto.Message { return &pb.Invitation{} },
	},
	{
		Method: "DELETE", Path: "/v1/business/staff/{user_id}", RPC: "/plentypay.identity.v1.Identity/DeactivateUser",
		RequireAuth: true, Idempotency: true, Permission: "admin:users:manage",
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
		RequireAuth: true, StepUp: true, Idempotency: true, Permission: "admin:roles:manage",
		NewRequest:  func() proto.Message { return &pb.UpsertRoleRequest{} },
		NewResponse: func() proto.Message { return &pb.Role{} },
	},
	{
		Method: "POST", Path: "/v1/business/roles/{user_id}/assign", RPC: "/plentypay.identity.v1.Identity/AssignRole",
		RequireAuth: true, StepUp: true, Idempotency: true, Permission: "admin:roles:manage",
		PathParams:  map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.AssignRoleRequest{} },
		NewResponse: func() proto.Message { return &pb.SimpleResult{} },
	},

	// ── Sesiones (F08.8) ───────────────────────────────────────────────────────
	{
		Method: "GET", Path: "/v1/sessions", RPC: "/plentypay.identity.v1.Identity/ListSessions", RequireAuth: true,
		QueryParams: map[string]string{"user_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.ListSessionsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListSessionsResult{} },
	},
	{
		Method: "DELETE", Path: "/v1/sessions/{session_id}", RPC: "/plentypay.identity.v1.Identity/RevokeSession",
		RequireAuth: true, Idempotency: true,
		PathParams:  map[string]string{"session_id": "session_id"},
		NewRequest:  func() proto.Message { return &pb.RevokeSessionRequest{} },
		NewResponse: func() proto.Message { return &pb.RevokeSessionResult{} },
	},

	// ── Plataforma: revisión de negocios (F08.8) ──────────────────────────────
	{
		Method: "GET", Path: "/v1/platform/tenants", RPC: "/plentypay.identity.v1.Identity/ListTenants", RequireAuth: true,
		QueryParams: map[string]string{"status": "status", "page_size": "page_size", "page_token": "page_token"},
		NewRequest:  func() proto.Message { return &pb.ListTenantsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListTenantsResult{} },
	},
	{
		Method: "POST", Path: "/v1/platform/tenants/{tenant_id}/review", RPC: "/plentypay.identity.v1.Identity/ReviewBusiness",
		RequireAuth: true, Idempotency: true,
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		NewRequest:  func() proto.Message { return &pb.ReviewBusinessRequest{} },
		NewResponse: func() proto.Message { return &pb.Tenant{} },
	},

	// ── Billetera (F11): saldo y extracto del ledger, siempre de la persona del token ─────────
	{
		Method: "GET", Path: "/v1/wallet/balance", RPC: "/plentypay.ledger.v1.Ledger/GetBalance", Backend: BackendLedger,
		RequireAuth: true, Permission: "wallet:read",
		Defaults:    map[string]string{"account.type": "ACCOUNT_TYPE_WALLET", "account.currency": "USD"},
		QueryParams: map[string]string{"currency": "account.currency"},
		FromCaller:  map[string]string{"account.party_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.GetBalanceRequest{} },
		NewResponse: func() proto.Message { return &pb.Balance{} },
	},
	{
		Method: "GET", Path: "/v1/wallet/statement", RPC: "/plentypay.ledger.v1.Ledger/GetStatement", Backend: BackendLedger,
		RequireAuth: true, Permission: "wallet:read",
		Defaults: map[string]string{"account.type": "ACCOUNT_TYPE_WALLET", "account.currency": "USD"},
		QueryParams: map[string]string{
			"currency": "account.currency", "from": "range.from", "to": "range.to",
			"page_size": "page.page_size", "page_token": "page.page_token",
		},
		FromCaller:  map[string]string{"account.party_id": "user_id"},
		NewRequest:  func() proto.Message { return &pb.GetStatementRequest{} },
		NewResponse: func() proto.Message { return &pb.GetStatementResponse{} },
	},

	{
		// R10/T1: la recarga es un intent con referencia `topup` que fija el gateway (el cliente no
		// puede convertir un cobro en recarga ni al revés); se confirma con /confirm.
		Method: "POST", Path: "/v1/wallet/topups", RPC: "/plentypay.payments.v1.Payments/CreatePaymentIntent",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "wallet:topup",
		Defaults:    map[string]string{"reference.type": "topup", "reference.id": "", "terminal_code": ""},
		NewRequest:  func() proto.Message { return &pb.CreatePaymentIntentRequest{} },
		NewResponse: func() proto.Message { return &pb.PaymentIntent{} },
	},

	// ── Cobros (F11.3). payments-core revisa `wallet:pay` / `payments:charge` (SPEC §4) ──────
	{
		Method: "POST", Path: "/v1/payments/intents", RPC: "/plentypay.payments.v1.Payments/CreatePaymentIntent",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, StepUp: true,
		NewRequest:  func() proto.Message { return &pb.CreatePaymentIntentRequest{} },
		NewResponse: func() proto.Message { return &pb.PaymentIntent{} },
	},
	{
		Method: "POST", Path: "/v1/payments/intents/{payment_intent_id}/confirm", RPC: "/plentypay.payments.v1.Payments/ConfirmPaymentIntent",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "wallet:pay",
		PathParams:  map[string]string{"payment_intent_id": "payment_intent_id"},
		NewRequest:  func() proto.Message { return &pb.ConfirmPaymentIntentRequest{} },
		NewResponse: func() proto.Message { return &pb.PaymentIntent{} },
	},
	{
		Method: "POST", Path: "/v1/payments/intents/{payment_intent_id}/cancel", RPC: "/plentypay.payments.v1.Payments/CancelPaymentIntent",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true,
		PathParams:  map[string]string{"payment_intent_id": "payment_intent_id"},
		NewRequest:  func() proto.Message { return &pb.CancelPaymentIntentRequest{} },
		NewResponse: func() proto.Message { return &pb.PaymentIntent{} },
	},
	{
		Method: "GET", Path: "/v1/payments/intents/{payment_intent_id}", RPC: "/plentypay.payments.v1.Payments/GetPaymentIntent",
		Backend: BackendPayments, RequireAuth: true,
		PathParams:  map[string]string{"payment_intent_id": "payment_intent_id"},
		NewRequest:  func() proto.Message { return &pb.GetPaymentIntentRequest{} },
		NewResponse: func() proto.Message { return &pb.PaymentIntent{} },
	},
	{
		// N-CON-01 / N-PAG-06: el desglose se muestra antes de confirmar.
		Method: "GET", Path: "/v1/payments/quote", RPC: "/plentypay.payments.v1.Payments/QuoteFees",
		Backend: BackendPayments, RequireAuth: true,
		Defaults:    map[string]string{"amount.currency": "USD", "rail": "PAYMENT_RAIL_WALLET"},
		QueryParams: map[string]string{"amount": "amount.amount_minor", "currency": "amount.currency", "rail": "rail"},
		NewRequest:  func() proto.Message { return &pb.QuoteFeesRequest{} },
		NewResponse: func() proto.Message { return &pb.FeeBreakdown{} },
	},
	{
		Method: "GET", Path: "/v1/payments", RPC: "/plentypay.payments.v1.Payments/ListPayments",
		Backend: BackendPayments, RequireAuth: true, Permission: "payments:read",
		QueryParams: map[string]string{
			"status": "status", "rail": "rail", "from": "range.from", "to": "range.to",
			"reference_type": "reference.type", "reference_id": "reference.id",
			"page_size": "page.page_size", "page_token": "page.page_token",
		},
		NewRequest:  func() proto.Message { return &pb.ListPaymentsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListPaymentsResponse{} },
	},
	{
		Method: "GET", Path: "/v1/payments/{payment_id}", RPC: "/plentypay.payments.v1.Payments/GetPayment",
		Backend: BackendPayments, RequireAuth: true, Permission: "payments:read",
		PathParams:  map[string]string{"payment_id": "payment_id"},
		NewRequest:  func() proto.Message { return &pb.GetPaymentRequest{} },
		NewResponse: func() proto.Message { return &pb.Payment{} },
	},
	{
		// F3: quien paga ve el nombre VERIFICADO del comercio antes de confirmar (R16).
		Method: "GET", Path: "/v1/pay-links/{public_code}", RPC: "/plentypay.payments.v1.Payments/ResolveTerminal",
		Backend: BackendPayments, RequireAuth: true,
		PathParams:  map[string]string{"public_code": "public_code"},
		NewRequest:  func() proto.Message { return &pb.ResolveTerminalRequest{} },
		NewResponse: func() proto.Message { return &pb.PublicTerminalInfo{} },
	},

	{
		// domain-model §6.3 paso 5: resolución manual de UNKNOWN con evidencia.
		Method: "POST", Path: "/v1/platform/payments/{payment_id}/resolve", RPC: "/plentypay.payments.v1.Payments/ResolveUnknownPayment",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "platform:reconcile",
		PathParams:  map[string]string{"payment_id": "payment_id"},
		NewRequest:  func() proto.Message { return &pb.ResolveUnknownPaymentRequest{} },
		NewResponse: func() proto.Message { return &pb.Payment{} },
	},

	// ── Terminales de cobro (F11.5) ───────────────────────────────────────────
	{
		Method: "GET", Path: "/v1/terminals", RPC: "/plentypay.payments.v1.Payments/ListTerminals",
		Backend: BackendPayments, RequireAuth: true, Permission: "payments:terminal:manage",
		NewRequest:  func() proto.Message { return &pb.ListTerminalsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListTerminalsResponse{} },
	},
	{
		Method: "POST", Path: "/v1/terminals", RPC: "/plentypay.payments.v1.Payments/CreateTerminal",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "payments:terminal:manage",
		NewRequest:  func() proto.Message { return &pb.CreateTerminalRequest{} },
		NewResponse: func() proto.Message { return &pb.Terminal{} },
	},
	{
		Method: "POST", Path: "/v1/terminals/{terminal_id}/active", RPC: "/plentypay.payments.v1.Payments/SetTerminalActive",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "payments:terminal:manage",
		PathParams:  map[string]string{"terminal_id": "terminal_id"},
		NewRequest:  func() proto.Message { return &pb.SetTerminalActiveRequest{} },
		NewResponse: func() proto.Message { return &pb.Terminal{} },
	},

	// ── Políticas de comisión: lectura del negocio o de plataforma; alta solo plataforma ─────
	{
		Method: "GET", Path: "/v1/fee-policies", RPC: "/plentypay.payments.v1.Payments/ListFeePolicies",
		Backend: BackendPayments, RequireAuth: true,
		QueryParams: map[string]string{"tenant_id": "tenant_id"},
		NewRequest:  func() proto.Message { return &pb.ListFeePoliciesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListFeePoliciesResponse{} },
	},
	{
		Method: "PUT", Path: "/v1/fee-policies", RPC: "/plentypay.payments.v1.Payments/UpsertFeePolicy",
		Backend: BackendPayments, RequireAuth: true, Idempotency: true, Permission: "platform:flags:manage",
		NewRequest:  func() proto.Message { return &pb.UpsertFeePolicyRequest{} },
		NewResponse: func() proto.Message { return &pb.FeePolicy{} },
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
