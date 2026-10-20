package server

import (
	"context"
	"errors"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/service"
)

// accessErrors traduce los errores esperables del modelo de acceso (ADR 0018) a código gRPC y
// `reason` estable (grpc-conventions.md §4, identity/SPEC.md §4). El orden importa: el primero
// que coincide gana.
var accessErrors = []struct {
	err    error
	code   codes.Code
	reason string
}{
	{domain.ErrUnauthenticated, codes.Unauthenticated, ReasonUnauthenticated},
	{domain.ErrForbidden, codes.PermissionDenied, ReasonPermissionDenied},
	{domain.ErrNoTenant, codes.PermissionDenied, ReasonPermissionDenied},
	{domain.ErrTargetIsOwner, codes.PermissionDenied, ReasonPermissionDenied},
	{domain.ErrPermissionNotHeld, codes.PermissionDenied, "PERMISSION_NOT_HELD"},
	{domain.ErrSelfAssignmentForbidden, codes.PermissionDenied, "SELF_ASSIGNMENT_FORBIDDEN"},
	{domain.ErrBranchOutOfScope, codes.PermissionDenied, "BRANCH_OUT_OF_SCOPE"},
	{domain.ErrStepUpRequired, codes.PermissionDenied, "STEP_UP_REQUIRED"},
	{domain.ErrStepUpInvalid, codes.PermissionDenied, "STEP_UP_INVALID"},
	{domain.ErrInvalidRequest, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrInvalidEmail, codes.InvalidArgument, "INVALID_EMAIL"},
	{domain.ErrInvalidJobTitle, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrInvalidBranch, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrUnknownCapability, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrUnknownTrait, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrTooManyVerticals, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrUnknownPermission, codes.InvalidArgument, "UNKNOWN_PERMISSION"},
	{domain.ErrPlatformPermission, codes.InvalidArgument, "UNKNOWN_PERMISSION"},
	{domain.ErrInvalidBranchCode, codes.InvalidArgument, "INVALID_BRANCH_CODE"},
	{domain.ErrVerticalNotFound, codes.InvalidArgument, "VERTICAL_NOT_FOUND"},
	{domain.ErrRoleNotFound, codes.NotFound, "ROLE_NOT_FOUND"},
	{domain.ErrUserNotFound, codes.NotFound, ReasonNotFound},
	{domain.ErrTenantNotFound, codes.NotFound, ReasonNotFound},
	{domain.ErrBranchNotFound, codes.NotFound, ReasonNotFound},
	{domain.ErrInvitationNotFound, codes.NotFound, ReasonNotFound},
	{domain.ErrInvitationUsed, codes.FailedPrecondition, "ALREADY_USED"},
	{domain.ErrPresetReadOnly, codes.FailedPrecondition, "PRESET_READ_ONLY"},
	{domain.ErrRoleInUse, codes.FailedPrecondition, "ROLE_IN_USE"},
	{domain.ErrLastOwner, codes.FailedPrecondition, "CANNOT_DEACTIVATE_OWNER"},
	{domain.ErrCannotDeactivateLastBranch, codes.FailedPrecondition, "CANNOT_DEACTIVATE_LAST_BRANCH"},
	{domain.ErrCapabilityGated, codes.FailedPrecondition, "CAPABILITY_DISABLED"},
	{domain.ErrCapabilityDisabled, codes.FailedPrecondition, "CAPABILITY_DISABLED"},
	{domain.ErrPlanLimitReached, codes.FailedPrecondition, "PLAN_LIMIT_REACHED"},
	{domain.ErrRoleNameTaken, codes.AlreadyExists, ReasonAlreadyExists},
	{domain.ErrBranchCodeTaken, codes.AlreadyExists, "BRANCH_CODE_TAKEN"},
}

// toStatus convierte un error del servicio en status gRPC. Lo que no es un rechazo esperable es
// un defecto: viaja como INTERNAL y el interceptor lo registra una sola vez y lo oculta al cliente.
func toStatus(err error) error {
	for _, e := range accessErrors {
		if errors.Is(err, e.err) {
			return ErrorInfo(e.code, e.reason, e.err.Error())
		}
	}
	return status.Error(codes.Internal, err.Error())
}

// ── Catálogos ─────────────────────────────────────────────────────────────────

// ListVerticals devuelve el catálogo de verticales y rasgos (R20).
func (s *IdentityServer) ListVerticals(_ context.Context, _ *pb.ListVerticalsRequest) (*pb.ListVerticalsResult, error) {
	out := &pb.ListVerticalsResult{}
	for _, v := range auth.AllVerticals {
		out.Verticals = append(out.Verticals, &pb.Vertical{
			Key: v.Key, Family: v.Family, DefaultTraits: v.DefaultTraits,
			SuggestedCapabilities: v.SuggestedCapabilities, RoleTemplateKeys: v.RoleTemplateKeys, Version: v.Version,
		})
	}
	for _, t := range auth.AllTraits {
		out.Traits = append(out.Traits, &pb.Trait{Key: t.Key, Capabilities: t.Capabilities})
	}
	return out, nil
}

// ListRoleTemplates devuelve plantillas universales y sectoriales.
func (s *IdentityServer) ListRoleTemplates(ctx context.Context, req *pb.ListRoleTemplatesRequest) (*pb.ListRoleTemplatesResult, error) {
	list, err := s.svc.ListRoleTemplates(ctx, req.GetVerticalKeys())
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListRoleTemplatesResult{}
	for _, t := range list {
		out.Templates = append(out.Templates, &pb.RoleTemplate{
			Key: t.Key, Version: t.Version, Description: t.Description, Permissions: t.Permissions,
			Universal: t.Universal, VerticalKeys: t.VerticalKeys,
		})
	}
	return out, nil
}

// GetAccessCatalog devuelve el catálogo de permisos con módulo, nivel, capacidad y 🔒 (S-ADM-03).
func (s *IdentityServer) GetAccessCatalog(_ context.Context, _ *pb.GetAccessCatalogRequest) (*pb.AccessCatalog, error) {
	out := &pb.AccessCatalog{ModuleOrder: auth.ModuleOrderIDs()}
	for _, p := range auth.BuildPermissionCatalog() {
		out.Permissions = append(out.Permissions, &pb.PermissionInfo{
			Key: p.Key, Module: p.Module, Level: p.Level, Capability: p.Capability, Money: p.Money, Platform: p.Platform,
		})
	}
	for _, c := range auth.AllCapabilityEntries {
		out.Capabilities = append(out.Capabilities, &pb.CapabilityInfo{
			Key: c.Key, Module: c.Module, Gated: auth.GatedCapabilities[c.Key], OpenQuestion: auth.GatingQuestion[c.Key],
		})
	}
	return out, nil
}

// ── Perfil y capacidades ──────────────────────────────────────────────────────

func toPBProfile(v *service.TenantView) *pb.BusinessProfile {
	out := &pb.BusinessProfile{
		TenantId: v.ID, PrimaryVertical: v.PrimaryVertical, SecondaryVerticals: v.SecondaryVerticals,
		Traits: map[string]bool{}, PlanCode: v.PlanCode, Version: v.Version,
	}
	for _, t := range v.Traits {
		out.Traits[t] = true
	}
	for t, on := range v.TraitOverrides {
		out.Traits[t] = on
	}
	for _, c := range v.Capabilities {
		out.Capabilities = append(out.Capabilities, &pb.CapabilityState{Capability: c.Capability, Enabled: c.Enabled, Source: c.Source})
	}
	return out
}

// GetBusinessProfile devuelve el perfil del negocio del actor.
func (s *IdentityServer) GetBusinessProfile(ctx context.Context, _ *pb.GetBusinessProfileRequest) (*pb.BusinessProfile, error) {
	v, err := s.svc.GetBusinessProfile(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBProfile(v), nil
}

// UpdateBusinessProfile cambia verticales y rasgos (R20).
func (s *IdentityServer) UpdateBusinessProfile(ctx context.Context, req *pb.UpdateBusinessProfileRequest) (*pb.BusinessProfile, error) {
	v, err := s.svc.UpdateBusinessProfile(ctx, service.ProfileInput{
		PrimaryVertical: req.GetPrimaryVertical(), SecondaryVerticals: req.GetSecondaryVerticals(), TraitAnswers: req.GetTraitAnswers(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBProfile(v), nil
}

// SetCapabilities enciende o apaga capacidades a mano (R21).
func (s *IdentityServer) SetCapabilities(ctx context.Context, req *pb.SetCapabilitiesRequest) (*pb.BusinessProfile, error) {
	changes := map[string]bool{}
	for _, c := range req.GetChanges() {
		changes[c.GetCapability()] = c.GetEnabled()
	}
	v, err := s.svc.SetCapabilities(ctx, changes)
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBProfile(v), nil
}

// ── Sucursales ────────────────────────────────────────────────────────────────

func toPBBranch(b *domain.Branch) *pb.Branch {
	return &pb.Branch{
		BranchId: b.ID, TenantId: b.TenantID, Code: b.Code, Name: b.Name, Address: b.Address,
		LatitudeE6: b.LatitudeE6, LongitudeE6: b.LongitudeE6, OpeningHoursJson: b.OpeningHoursJSON,
		Active: b.Active, Version: b.Version,
	}
}

// UpsertBranch crea o edita una sucursal (R24).
func (s *IdentityServer) UpsertBranch(ctx context.Context, req *pb.UpsertBranchRequest) (*pb.Branch, error) {
	in := req.GetBranch()
	if in == nil {
		return nil, toStatus(domain.ErrInvalidRequest)
	}
	b, err := s.svc.UpsertBranch(ctx, domain.Branch{
		ID: in.GetBranchId(), Code: in.GetCode(), Name: in.GetName(), Address: in.GetAddress(),
		LatitudeE6: in.GetLatitudeE6(), LongitudeE6: in.GetLongitudeE6(), OpeningHoursJSON: in.GetOpeningHoursJson(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBBranch(b), nil
}

// ListBranches devuelve las sucursales visibles para el actor.
func (s *IdentityServer) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResult, error) {
	list, err := s.svc.ListBranches(ctx, req.GetIncludeInactive())
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListBranchesResult{}
	for i := range list {
		out.Branches = append(out.Branches, toPBBranch(&list[i]))
	}
	return out, nil
}

// DeactivateBranch desactiva una sucursal (nunca la única activa).
func (s *IdentityServer) DeactivateBranch(ctx context.Context, req *pb.BranchRef) (*pb.Branch, error) {
	b, err := s.svc.SetBranchActive(ctx, req.GetBranchId(), false)
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBBranch(b), nil
}

// ReactivateBranch reactiva una sucursal.
func (s *IdentityServer) ReactivateBranch(ctx context.Context, req *pb.BranchRef) (*pb.Branch, error) {
	b, err := s.svc.SetBranchActive(ctx, req.GetBranchId(), true)
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBBranch(b), nil
}

// ── Equipo, membresías e invitaciones ────────────────────────────────────────

func toPBUser(u *domain.User) *pb.UserSummary {
	out := &pb.UserSummary{
		UserId: u.ID, Email: u.Email, FullName: u.FullName, Role: pb.UserRole(pb.UserRole_value[u.Role]),
		RoleId: u.RoleID, RoleName: u.RoleName, Active: u.IsActive(), Status: u.Status,
		Scope: u.Scope, BranchIds: u.BranchIDs, JobTitle: u.JobTitle,
	}
	if out.Status == "" {
		out.Status = domain.UserStatusActive
	}
	if out.Scope == "" {
		out.Scope = domain.ScopeTenant
	}
	if u.LastLoginAt != nil {
		out.LastLoginAt = timestamppb.New(*u.LastLoginAt)
	}
	return out
}

func (s *IdentityServer) toPBInvitation(inv *domain.Invitation) *pb.Invitation {
	return &pb.Invitation{
		InvitationId: inv.ID, Email: inv.Email, RoleId: inv.RoleID, ExpiresAt: timestamppb.New(inv.ExpiresAt),
		Scope: inv.Scope, BranchIds: inv.BranchIDs, JobTitle: inv.JobTitle, FullName: inv.FullName,
		Status: inv.Status(s.now()), CreatedAt: timestamppb.New(inv.CreatedAt),
	}
}

// UpdateMembership cambia rol, alcance y cargo de un miembro (A1–A3).
func (s *IdentityServer) UpdateMembership(ctx context.Context, req *pb.UpdateMembershipRequest) (*pb.UserSummary, error) {
	u, err := s.svc.UpdateMembership(ctx, service.MembershipInput{
		UserID: req.GetUserId(), RoleID: req.GetRoleId(), Scope: strings.ToUpper(req.GetScope()),
		BranchIDs: req.GetBranchIds(), JobTitle: req.GetJobTitle(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return toPBUser(u), nil
}

// ArchiveRole archiva un rol sin miembros.
func (s *IdentityServer) ArchiveRole(ctx context.Context, req *pb.ArchiveRoleRequest) (*pb.SimpleResult, error) {
	if err := s.svc.ArchiveRole(ctx, req.GetRoleId()); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// SuspendUser bloquea temporalmente a un miembro y revoca sus sesiones.
func (s *IdentityServer) SuspendUser(ctx context.Context, req *pb.SetUserStatusRequest) (*pb.SimpleResult, error) {
	if err := s.svc.SetUserStatus(ctx, req.GetUserId(), domain.UserStatusSuspended); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// ReactivateUser devuelve a ACTIVE a un miembro suspendido o dado de baja.
func (s *IdentityServer) ReactivateUser(ctx context.Context, req *pb.SetUserStatusRequest) (*pb.SimpleResult, error) {
	if err := s.svc.SetUserStatus(ctx, req.GetUserId(), domain.UserStatusActive); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// ListInvitations devuelve las invitaciones pendientes del negocio.
func (s *IdentityServer) ListInvitations(ctx context.Context, _ *pb.ListInvitationsRequest) (*pb.ListInvitationsResult, error) {
	list, err := s.svc.ListInvitations(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListInvitationsResult{}
	for i := range list {
		out.Invitations = append(out.Invitations, s.toPBInvitation(&list[i]))
	}
	return out, nil
}

// RevokeInvitation invalida una invitación pendiente.
func (s *IdentityServer) RevokeInvitation(ctx context.Context, req *pb.InvitationRef) (*pb.SimpleResult, error) {
	if err := s.svc.RevokeInvitation(ctx, req.GetInvitationId()); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// ResendInvitation emite un enlace nuevo de 7 días.
func (s *IdentityServer) ResendInvitation(ctx context.Context, req *pb.InvitationRef) (*pb.Invitation, error) {
	inv, err := s.svc.ResendInvitation(ctx, req.GetInvitationId())
	if err != nil {
		return nil, toStatus(err)
	}
	return s.toPBInvitation(inv), nil
}

// PreviewInvitation muestra la invitación a quien tiene el enlace (S-GEN-17).
func (s *IdentityServer) PreviewInvitation(ctx context.Context, req *pb.PreviewInvitationRequest) (*pb.InvitationPreview, error) {
	p, err := s.svc.PreviewInvitation(ctx, req.GetInvitationToken())
	if err != nil {
		if errors.Is(err, domain.ErrInvitationNotFound) {
			return nil, ErrorInfo(codes.NotFound, "TOKEN_INVALID", "invitacion no encontrada")
		}
		return nil, toStatus(err)
	}
	inv := p.Invitation
	return &pb.InvitationPreview{
		Email: inv.Email, FullName: inv.FullName, BusinessName: p.BusinessName,
		RoleId: inv.RoleID, RoleName: p.RoleName, RoleSystem: p.RoleSystem,
		Scope: inv.Scope, BranchNames: p.BranchNames, Status: inv.Status(s.now()), AccountExists: p.AccountExists,
	}, nil
}
