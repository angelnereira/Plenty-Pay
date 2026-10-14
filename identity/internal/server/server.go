package server

import (
	"context"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
)

// IdentityServer es el adaptador gRPC: traduce pb <-> service y los errores del
// servicio a AuthResult con `reason` estable. No contiene reglas de negocio:
// las tiene service/domain (go-standards.md seccion 2).
type IdentityServer struct {
	pb.UnimplementedIdentityServer
	users    store.UserStore
	tokens   *auth.TokenIssuer
	svc      *service.IdentityService
	stepUp   *auth.StepUpManager
	reporter *observability.Reporter
	metrics  *observability.Metrics
	// now es el reloj del servidor; se inyecta para que las pruebas sean deterministas.
	now func() time.Time
}

// NewIdentityServer cablea el servicio de identity sobre el store recibido.
func NewIdentityServer(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityServer {
	svc := service.New(users, tokens, reporter, metrics)
	return &IdentityServer{
		users:    users,
		tokens:   tokens,
		svc:      svc,
		stepUp:   auth.NewStepUpManager(),
		reporter: reporter,
		metrics:  metrics,
		now:      time.Now,
	}
}

// WithSessions activa sesiones con rotacion de refresh en el servicio.
func (s *IdentityServer) WithSessions(ss store.SessionStore) *IdentityServer {
	s.svc.WithSessions(ss)
	return s
}

// WithRoles activa roles personalizados e invitaciones (F08.6).
func (s *IdentityServer) WithRoles(rs store.RoleStore) *IdentityServer {
	s.svc.WithRoles(rs)
	return s
}

// WithPasswords activa recuperacion y cambio de contrasena (F08.7).
func (s *IdentityServer) WithPasswords(ps store.PasswordStore) *IdentityServer {
	s.svc.WithPasswords(ps)
	return s
}

// WithTenants activa la gestion de negocios (F08.5).
func (s *IdentityServer) WithTenants(ts store.TenantStore) *IdentityServer {
	s.svc.WithTenants(ts)
	return s
}

// WithLockout activa el bloqueo progresivo (R5).
func (s *IdentityServer) WithLockout(la store.LoginAttemptStore) *IdentityServer {
	s.svc.WithLockout(la)
	return s
}

// WithSecurityReporter activa el reporte de TOKEN_REUSE a `security`.
func (s *IdentityServer) WithSecurityReporter(r service.SecurityReporter) *IdentityServer {
	s.svc.WithSecurityReporter(r)
	return s
}

// rejected construye un AuthResult fallido con su `reason` estable (docs/glossary.md §7.3).
func rejected(reason, message string) *pb.AuthResult {
	return &pb.AuthResult{Success: false, Reason: reason, ErrorMessage: message}
}

func toPB(r *service.AuthResult) *pb.AuthResult {
	if r == nil {
		return rejected("INTERNAL", "error interno")
	}
	return &pb.AuthResult{
		Success:      r.Success,
		Reason:       r.Reason,
		ErrorMessage: r.ErrorMessage,
		AccessToken:  r.AccessToken,
		RefreshToken: r.RefreshToken,
		UserId:       r.UserID,
		TenantId:     r.TenantID,
		Role:         pb.UserRole(pb.UserRole_value[r.Role]),
	}
}

func grantsFrom(req *pb.RegisterRequest) []service.ConsentGrant {
	out := make([]service.ConsentGrant, 0, len(req.Consents))
	for _, c := range req.Consents {
		if c == nil {
			continue
		}
		out = append(out, service.ConsentGrant{
			Purpose: c.Purpose, TextVersion: c.TextVersion, Granted: c.Granted,
			Channel: req.Channel, Device: req.Device,
		})
	}
	return out
}

// Register delega en el servicio (R1-R3, R18).
func (s *IdentityServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Register(ctx, service.RegisterInput{
		Email: req.Email, Password: req.Password, FullName: req.FullName,
		Role: req.Role.String(), TenantID: req.TenantId,
		Consents: grantsFrom(req), Now: s.now(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// Login delega en el servicio (R4).
func (s *IdentityServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Login(ctx, req.Email, req.Password)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// ValidateToken delega en el servicio (R9: tambien valida el estado de la sesion).
func (s *IdentityServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResult, error) {
	claims, err := s.svc.ValidateAccessToken(ctx, req.AccessToken)
	if err != nil {
		return &pb.ValidateTokenResult{Valid: false}, nil
	}
	return &pb.ValidateTokenResult{
		Valid:    true,
		UserId:   claims.UserID,
		TenantId: claims.TenantID,
		Role:     pb.UserRole(pb.UserRole_value[claims.Role]),
	}, nil
}

// GetUserPermissions delega en el servicio (R10).
func (s *IdentityServer) GetUserPermissions(ctx context.Context, req *pb.GetUserPermissionsRequest) (*pb.UserPermissions, error) {
	perms, err := s.svc.PermissionsForUser(ctx, req.UserId)
	if err != nil {
		return &pb.UserPermissions{}, nil
	}
	return &pb.UserPermissions{
		Role:           pb.UserRole(pb.UserRole_value[perms.Role]),
		EnabledModules: perms.EnabledModules,
		Permissions:    perms.Permissions,
	}, nil
}

// RefreshToken delega en el servicio (F08.3 añade rotacion del refresh).
func (s *IdentityServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Refresh(ctx, req.RefreshToken)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// IssueStepUpChallenge emite un reto de confirmación fuerte (Passkey/WebAuthn) atado a la operación.
func (s *IdentityServer) IssueStepUpChallenge(_ context.Context, req *pb.StepUpRequest) (*pb.PasskeyChallenge, error) {
	chID, optionsJSON := s.stepUp.IssueChallenge(req.UserId, req.Operation, req.AmountMinor, req.Currency)
	return &pb.PasskeyChallenge{
		ChallengeId:          chID,
		PublicKeyOptionsJson: optionsJSON,
	}, nil
}

// VerifyStepUp valida el reto y emite un token de confirmación de un solo uso (TTL 5 min).
func (s *IdentityServer) VerifyStepUp(_ context.Context, req *pb.VerifyStepUpRequest) (*pb.StepUpToken, error) {
	token, expiresAt, err := s.stepUp.VerifyChallenge(req.ChallengeId, req.AssertionJson)
	if err != nil {
		return &pb.StepUpToken{}, nil
	}
	return &pb.StepUpToken{
		Token:     token,
		ExpiresAt: timestamppb.New(expiresAt),
	}, nil
}

// ConsumeStepUp valida y consume el token atado a la operación exacta. Single-use.
func (s *IdentityServer) ConsumeStepUp(_ context.Context, req *pb.ConsumeStepUpRequest) (*pb.ConsumeStepUpResult, error) {
	valid, reason := s.stepUp.ConsumeToken(req.Token, req.UserId, req.Operation, req.AmountMinor, req.Currency)
	return &pb.ConsumeStepUpResult{
		Valid:  valid,
		Reason: reason,
	}, nil
}

// ── Negocios (tenants) ────────────────────────────────────────────────────────

func toPBTenant(v *service.TenantView) *pb.Tenant {
	if v == nil {
		return &pb.Tenant{}
	}
	return &pb.Tenant{
		TenantId:    v.ID,
		LegalName:   v.LegalName,
		TradeName:   v.TradeName,
		TaxId:       v.TaxID,
		Dv:          v.DV,
		Status:      pb.TenantStatus(pb.TenantStatus_value["TENANT_STATUS_"+v.Status]),
		Country:     v.Country,
		ReviewNotes: v.ReviewNotes,
		CreatedAt:   timestamppb.New(v.CreatedAt),
	}
}

func pbTenantStatus(s string) pb.TenantStatus {
	if v, ok := pb.TenantStatus_value["TENANT_STATUS_"+s]; ok {
		return pb.TenantStatus(v)
	}
	return pb.TenantStatus_TENANT_STATUS_UNSPECIFIED
}

func pbStatusString(s pb.TenantStatus) string {
	if s == pb.TenantStatus_TENANT_STATUS_UNSPECIFIED {
		return ""
	}
	return strings.TrimPrefix(s.String(), "TENANT_STATUS_")
}

// CreateBusiness da de alta el negocio (SPEC §4).
func (s *IdentityServer) CreateBusiness(ctx context.Context, req *pb.CreateBusinessRequest) (*pb.CreateBusinessResult, error) {
	res, err := s.svc.CreateBusiness(ctx, service.CreateBusinessInput{
		OwnerEmail: req.OwnerEmail, OwnerPassword: req.OwnerPassword, OwnerFullName: req.OwnerFullName,
		LegalName: req.LegalName, TradeName: req.TradeName, TaxID: req.TaxId, DV: req.Dv,
		Country: req.Country, DocumentKeys: req.KybDocumentObjectKeys, Now: s.now(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	if !res.Success {
		return &pb.CreateBusinessResult{Success: false, Reason: res.Reason, ErrorMessage: res.ErrorMessage}, nil
	}
	return &pb.CreateBusinessResult{Success: true, Tenant: toPBTenant(res.Tenant), Session: toPB(res.Session)}, nil
}

// ReviewBusiness cambia el estado del negocio (solo plataforma).
func (s *IdentityServer) ReviewBusiness(ctx context.Context, req *pb.ReviewBusinessRequest) (*pb.Tenant, error) {
	review, err := s.svc.ReviewBusiness(ctx, req.TenantId, req.Approve, req.Notes)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	if review == nil {
		// Sin cambio de estado: la transicion no es valida (dominio 3.3).
		return nil, ErrorInfo(codes.FailedPrecondition, ReasonInvalidStateTransition,
			"la transicion de estado no es valida")
	}
	return toPBTenant(review.Tenant), nil
}

// GetTenant devuelve los datos del negocio. No encontrado -> NOT_FOUND con
// reason estable (grpc-conventions.md §4: no se revela si es de otro tenant).
func (s *IdentityServer) GetTenant(ctx context.Context, req *pb.GetTenantRequest) (*pb.Tenant, error) {
	t, err := s.svc.Tenant(ctx, req.TenantId)
	if err != nil {
		return nil, ErrorInfo(codes.NotFound, ReasonNotFound, "negocio no encontrado")
	}
	if t == nil {
		return nil, ErrorInfo(codes.NotFound, ReasonNotFound, "negocio no encontrado")
	}
	return toPBTenant(t), nil
}

// ListTenants pagina los negocios (consola de plataforma).
func (s *IdentityServer) ListTenants(ctx context.Context, req *pb.ListTenantsRequest) (*pb.ListTenantsResult, error) {
	list, err := s.svc.ListTenants(ctx, pbStatusString(req.Status), int(req.PageSize))
	if err != nil {
		return &pb.ListTenantsResult{}, nil
	}
	out := &pb.ListTenantsResult{}
	for i := range list {
		out.Tenants = append(out.Tenants, toPBTenant(&list[i]))
	}
	return out, nil
}

// ── Roles, invitaciones y equipo (F08.6) ──────────────────────────────────────

// UpsertRole crea un rol personalizado (R12).
func (s *IdentityServer) UpsertRole(ctx context.Context, req *pb.UpsertRoleRequest) (*pb.Role, error) {
	perms := []string(nil)
	if req.Role != nil {
		perms = req.Role.Permissions
	}
	role, err := s.svc.UpsertRole(ctx, tenantFromContext(ctx), roleName(req.Role), perms)
	if err != nil || role == nil {
		return &pb.Role{}, nil
	}
	return toPBRole(role), nil
}

// ListRoles devuelve presets y roles del tenant.
func (s *IdentityServer) ListRoles(ctx context.Context, req *pb.ListRolesRequest) (*pb.ListRolesResult, error) {
	list, err := s.svc.ListRoles(ctx, req.TenantId)
	if err != nil {
		return &pb.ListRolesResult{}, nil
	}
	out := &pb.ListRolesResult{}
	for i := range list {
		out.Roles = append(out.Roles, toPBRole(&list[i]))
	}
	return out, nil
}

// AssignRole asigna un rol a un usuario.
func (s *IdentityServer) AssignRole(ctx context.Context, req *pb.AssignRoleRequest) (*pb.SimpleResult, error) {
	if err := s.svc.AssignRole(ctx, req.UserId, req.RoleId); err != nil {
		return &pb.SimpleResult{Success: false, ErrorMessage: "no se pudo asignar el rol"}, nil
	}
	return &pb.SimpleResult{Success: true}, nil
}

// InviteStaff invita a una persona al equipo (SPEC §4: 7 dias).
func (s *IdentityServer) InviteStaff(ctx context.Context, req *pb.InviteStaffRequest) (*pb.Invitation, error) {
	res, err := s.svc.InviteStaff(ctx, tenantFromContext(ctx), req.Email, req.FullName, req.RoleId, userFromContext(ctx))
	if err != nil || !res.Success {
		return &pb.Invitation{}, nil
	}
	return &pb.Invitation{
		InvitationId: res.InvitationID, Email: req.Email, RoleId: req.RoleId,
		ExpiresAt: timestamppb.New(res.ExpiresAt),
	}, nil
}

// AcceptInvitation canjea el token y devuelve la sesion del nuevo staff.
func (s *IdentityServer) AcceptInvitation(ctx context.Context, req *pb.AcceptInvitationRequest) (*pb.AuthResult, error) {
	res, err := s.svc.AcceptInvitation(ctx, req.InvitationToken, req.Password)
	if err != nil || !res.Success {
		return toPB(nil), nil
	}
	return toPB(res.Session), nil
}

// ListUsers devuelve el equipo del tenant.
func (s *IdentityServer) ListUsers(ctx context.Context, req *pb.ListUsersRequest) (*pb.ListUsersResult, error) {
	users, err := s.svc.ListUsers(ctx, req.TenantId)
	if err != nil {
		return &pb.ListUsersResult{}, nil
	}
	out := &pb.ListUsersResult{}
	for i := range users {
		out.Users = append(out.Users, &pb.UserSummary{
			UserId: users[i].ID, Email: users[i].Email, FullName: users[i].FullName,
			Role: pb.UserRole(pb.UserRole_value[users[i].Role]),
		})
	}
	return out, nil
}

// DeactivateUser desactiva a un miembro (R13).
func (s *IdentityServer) DeactivateUser(ctx context.Context, req *pb.DeactivateUserRequest) (*pb.SimpleResult, error) {
	if err := s.svc.DeactivateUser(ctx, req.UserId); err != nil {
		return &pb.SimpleResult{Success: false, ErrorMessage: "no se puede desactivar al ultimo dueno del negocio"}, nil
	}
	return &pb.SimpleResult{Success: true}, nil
}

func toPBRole(r *service.RoleResult) *pb.Role {
	if r == nil {
		return &pb.Role{}
	}
	return &pb.Role{RoleId: r.ID, TenantId: r.TenantID, Name: r.Name, Permissions: r.Permissions, System: r.System}
}

func roleName(r *pb.Role) string {
	if r == nil {
		return ""
	}
	return r.Name
}

func tenantFromContext(ctx context.Context) string { return tenancy.TenantIDFromContext(ctx) }
func userFromContext(ctx context.Context) string   { return tenancy.UserIDFromContext(ctx) }

// ── Contrasena (F08.7) ────────────────────────────────────────────────────────

// ChangePassword cambia la contrasena (R14 exige step-up; R16 revoca las demas
// sesiones).
func (s *IdentityServer) ChangePassword(ctx context.Context, req *pb.ChangePasswordRequest) (*pb.SimpleResult, error) {
	if req.StepUpToken == "" {
		return &pb.SimpleResult{Success: false, ErrorMessage: "STEP_UP_REQUIRED"}, nil
	}
	keep := ""
	if req.CurrentPassword != "" {
		// El cambio conserva la sesion desde la que se hace; el reset no.
		keep = sessionOf(ctx)
	}
	res, err := s.svc.ChangePassword(ctx, req.UserId, req.CurrentPassword, req.NewPassword, keep)
	if err != nil {
		return &pb.SimpleResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	if !res.Success {
		return &pb.SimpleResult{Success: false, ErrorMessage: res.ErrorMessage}, nil
	}
	return &pb.SimpleResult{Success: true}, nil
}

// RequestPasswordReset siempre responde igual (no revela si el correo existe).
func (s *IdentityServer) RequestPasswordReset(ctx context.Context, req *pb.RequestPasswordResetRequest) (*pb.SimpleResult, error) {
	if _, err := s.svc.RequestPasswordReset(ctx, req.Email); err != nil {
		return &pb.SimpleResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	return &pb.SimpleResult{Success: true}, nil
}

// ConfirmPasswordReset canjea el token y cambia la contrasena (R16).
func (s *IdentityServer) ConfirmPasswordReset(ctx context.Context, req *pb.ConfirmPasswordResetRequest) (*pb.SimpleResult, error) {
	res, err := s.svc.ConfirmPasswordReset(ctx, req.ResetToken, req.NewPassword)
	if err != nil {
		return &pb.SimpleResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	if !res.Success {
		return &pb.SimpleResult{Success: false, ErrorMessage: res.ErrorMessage}, nil
	}
	return &pb.SimpleResult{Success: true}, nil
}

// sessionOf devuelve la sesion del llamador si viene en el contexto.
func sessionOf(ctx context.Context) string { return tenancy.SessionIDFromContext(ctx) }
