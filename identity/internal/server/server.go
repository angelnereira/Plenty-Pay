package server

import (
	"context"
	"errors"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
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
	reporter *observability.Reporter
	metrics  *observability.Metrics
	// now es el reloj del servidor; se inyecta para que las pruebas sean deterministas.
	now func() time.Time
}

// NewIdentityServer cablea el servicio de identity sobre el store recibido.
func NewIdentityServer(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityServer {
	svc := service.New(users, tokens, reporter, metrics)
	// Sin base de datos (pruebas y E2E sin BD) la confirmación fuerte vive en memoria; main la
	// reemplaza por PostgreSQL con PP_DB_DSN (R32).
	svc.WithStrongAuth(store.NewInMemoryStrongAuthStore(), domain.DefaultPinPolicy)
	return &IdentityServer{
		users:    users,
		tokens:   tokens,
		svc:      svc,
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
		return nil, status.Error(codes.Internal, observability.Wrap(err, "Register").Error())
	}
	return toPB(res), nil
}

// Login delega en el servicio (R4).
func (s *IdentityServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Login(ctx, req.Email, req.Password)
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "Login").Error())
	}
	return toPB(res), nil
}

// ValidateToken delega en el servicio (R9: tambien valida el estado de la sesion).
func (s *IdentityServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResult, error) {
	claims, err := s.svc.ValidateAccessToken(ctx, req.AccessToken)
	if err != nil {
		return &pb.ValidateTokenResult{Valid: false}, nil
	}
	// El gateway propaga permisos, alcance y capacidades como x-pp-* (ADR 0018): se calculan
	// aquí, con el estado actual, no con lo que el token tenía al emitirse.
	perms, err := s.svc.PermissionsForUser(ctx, claims.UserID)
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "resolve permissions on validate").Error())
	}
	return &pb.ValidateTokenResult{
		Valid:        true,
		UserId:       claims.UserID,
		TenantId:     claims.TenantID,
		Role:         pb.UserRole(pb.UserRole_value[claims.Role]),
		SessionId:    claims.SessionID,
		Permissions:  perms.Permissions,
		BranchScope:  perms.BranchScope,
		Capabilities: perms.Capabilities,
		FullName:     perms.FullName,
	}, nil
}

// GetUserPermissions delega en el servicio (R10).
func (s *IdentityServer) GetUserPermissions(ctx context.Context, req *pb.GetUserPermissionsRequest) (*pb.UserPermissions, error) {
	perms, err := s.svc.PermissionsForUser(ctx, req.UserId)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return nil, ErrorInfo(codes.NotFound, ReasonNotFound, "usuario no encontrado")
		}
		return nil, status.Error(codes.Internal, observability.Wrap(err, "resolve permissions").Error())
	}
	return &pb.UserPermissions{
		Role:           pb.UserRole(pb.UserRole_value[perms.Role]),
		EnabledModules: perms.EnabledModules,
		Permissions:    perms.Permissions,
		BranchScope:    perms.BranchScope,
		Capabilities:   perms.Capabilities,
	}, nil
}

// RefreshToken delega en el servicio (F08.3 añade rotacion del refresh).
func (s *IdentityServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Refresh(ctx, req.RefreshToken)
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "Refresh").Error())
	}
	return toPB(res), nil
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

		PrimaryVertical:    v.PrimaryVertical,
		SecondaryVerticals: v.SecondaryVerticals,
		Traits:             v.Traits,
		PlanCode:           v.PlanCode,
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
		PrimaryVertical: req.GetPrimaryVertical(), TraitAnswers: req.GetTraitAnswers(), BranchName: req.GetBranchName(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "CreateBusiness").Error())
	}
	if !res.Success {
		return &pb.CreateBusinessResult{Success: false, Reason: res.Reason, ErrorMessage: res.ErrorMessage}, nil
	}
	return &pb.CreateBusinessResult{Success: true, Tenant: toPBTenant(res.Tenant), Session: toPB(res.Session)}, nil
}

// ReviewBusiness cambia el estado del negocio (solo plataforma).
func (s *IdentityServer) ReviewBusiness(ctx context.Context, req *pb.ReviewBusinessRequest) (*pb.Tenant, error) {
	review, err := s.svc.ReviewBusiness(ctx, req.TenantId, req.Approve, req.Notes)
	if errors.Is(err, domain.ErrTenantNotFound) {
		return nil, ErrorInfo(codes.NotFound, ReasonNotFound, "negocio no encontrado")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "ReviewBusiness").Error())
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

// UpsertRole crea o edita un rol del negocio (R12, A1, A2; step-up si suma dinero).
func (s *IdentityServer) UpsertRole(ctx context.Context, req *pb.UpsertRoleRequest) (*pb.Role, error) {
	r := req.GetRole()
	if r == nil {
		return nil, toStatus(domain.ErrInvalidRequest)
	}
	role, err := s.svc.UpsertRole(ctx, service.RoleInput{
		ID: r.GetRoleId(), Name: r.GetName(), Description: r.GetDescription(),
		TemplateKey: r.GetTemplateKey(), TemplateVersion: r.GetTemplateVersion(), Permissions: r.GetPermissions(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBRole(role), nil
}

// ListRoles devuelve presets y roles del negocio del actor. El tenant sale del contexto, nunca
// del cuerpo (ADR 0011): ListRolesRequest.tenant_id se ignora.
func (s *IdentityServer) ListRoles(ctx context.Context, _ *pb.ListRolesRequest) (*pb.ListRolesResult, error) {
	list, err := s.svc.ListRoles(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListRolesResult{}
	for i := range list {
		out.Roles = append(out.Roles, toPBRole(&list[i]))
	}
	return out, nil
}

// AssignRole asigna un rol a un miembro (compatibilidad; la app usa UpdateMembership).
func (s *IdentityServer) AssignRole(ctx context.Context, req *pb.AssignRoleRequest) (*pb.SimpleResult, error) {
	if _, err := s.svc.AssignRole(ctx, req.GetUserId(), req.GetRoleId()); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// InviteStaff invita a una persona con rol, alcance y cargo (A1, A3).
func (s *IdentityServer) InviteStaff(ctx context.Context, req *pb.InviteStaffRequest) (*pb.Invitation, error) {
	res, err := s.svc.InviteStaff(ctx, service.InviteInput{
		Email: req.GetEmail(), FullName: req.GetFullName(), RoleID: req.GetRoleId(),
		Scope: strings.ToUpper(req.GetScope()), BranchIDs: req.GetBranchIds(), JobTitle: req.GetJobTitle(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return s.toPBInvitation(res.Invitation), nil
}

// AcceptInvitation canjea el token y devuelve la sesion (H8: también para cuentas existentes).
func (s *IdentityServer) AcceptInvitation(ctx context.Context, req *pb.AcceptInvitationRequest) (*pb.AuthResult, error) {
	consents := make([]service.ConsentGrant, 0, len(req.GetConsents()))
	for _, c := range req.GetConsents() {
		// El canal lo fija el servidor: la aceptación llega por el enlace de invitación (S-GEN-17).
		consents = append(consents, service.ConsentGrant{Purpose: c.GetPurpose(), TextVersion: c.GetTextVersion(), Granted: c.GetGranted(), Channel: "invitation"})
	}
	res, err := s.svc.AcceptInvitation(ctx, service.AcceptInput{
		Token: req.GetInvitationToken(), Password: req.GetPassword(), FullName: req.GetFullName(), Consents: consents,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "accept invitation").Error())
	}
	if !res.Success {
		return rejected(res.Reason, res.ErrorMessage), nil
	}
	return toPB(res.Session), nil
}

// ListUsers devuelve el equipo del negocio del actor (tenant del contexto, nunca del cuerpo).
func (s *IdentityServer) ListUsers(ctx context.Context, _ *pb.ListUsersRequest) (*pb.ListUsersResult, error) {
	users, err := s.svc.ListUsers(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListUsersResult{}
	for i := range users {
		out.Users = append(out.Users, toPBUser(&users[i]))
	}
	return out, nil
}

// DeactivateUser da de baja a un miembro (R13, A2).
func (s *IdentityServer) DeactivateUser(ctx context.Context, req *pb.DeactivateUserRequest) (*pb.SimpleResult, error) {
	if err := s.svc.DeactivateUser(ctx, req.GetUserId()); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

func toPBRole(r *service.RoleResult) *pb.Role {
	if r == nil {
		return &pb.Role{}
	}
	return &pb.Role{
		RoleId: r.ID, TenantId: r.TenantID, Name: r.Name, Permissions: r.Permissions, System: r.System,
		TemplateKey: r.TemplateKey, TemplateVersion: r.TemplateVersion, Description: r.Description,
		Version: r.Version, Archived: r.Archived, MemberCount: r.MemberCount,
	}
}

// ── Contrasena (F08.7) ────────────────────────────────────────────────────────

// ChangePassword cambia la contrasena (R14, R26: consume el token de identity.password.change y el
// usuario sale de x-pp-user-id; el user_id del cuerpo se ignora; R16 revoca las demas sesiones).
func (s *IdentityServer) ChangePassword(ctx context.Context, req *pb.ChangePasswordRequest) (*pb.SimpleResult, error) {
	userID := tenancy.UserIDFromContext(ctx)
	if userID == "" {
		return nil, toStatus(domain.ErrUnauthenticated)
	}
	if tenancy.StepUpTokenFromContext(ctx) == "" && req.GetStepUpToken() != "" {
		ctx = tenancy.WithStepUpToken(ctx, req.GetStepUpToken())
	}
	keep := ""
	if req.CurrentPassword != "" {
		// El cambio conserva la sesion desde la que se hace; el reset no.
		keep = sessionOf(ctx)
	}
	res, err := s.svc.ChangePassword(ctx, userID, req.CurrentPassword, req.NewPassword, keep)
	if err != nil {
		return nil, toStatus(err)
	}
	if !res.Success {
		// Rechazos de negocio con su reason (la app traduce el reason, no el mensaje). La contraseña
		// actual equivocada no es 401: la app refrescaría la sesión en vez de mostrar el error.
		switch res.Reason {
		case "WEAK_PASSWORD":
			return nil, ErrorInfo(codes.InvalidArgument, "WEAK_PASSWORD", res.ErrorMessage)
		case "INVALID_CREDENTIALS":
			return nil, ErrorInfo(codes.FailedPrecondition, "INVALID_CREDENTIALS", res.ErrorMessage)
		case "SAME_PASSWORD":
			return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", res.ErrorMessage)
		case "NOT_FOUND":
			return nil, toStatus(domain.ErrUnauthenticated)
		}
		return nil, status.Error(codes.Internal, "change password: "+res.ErrorMessage)
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
