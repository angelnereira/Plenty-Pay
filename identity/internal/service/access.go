package service

import (
	"context"
	"errors"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/tenancy"
)

// Operaciones de step-up que consume identity (security-standards.md §4.1, R14). El cliente pide el
// reto con la misma operación (IssueStepUpChallenge.operation) y manda el token en X-Step-Up-Token.
const (
	OpRoleUpsert       = domain.OpRoleUpsert
	OpStaffInvite      = domain.OpStaffInvite
	OpMembershipUpdate = domain.OpMembershipUpdate
	OpCapabilitiesSet  = domain.OpCapabilitiesSet
)

// actor es quien hace la petición, resuelto desde el contexto (tenant y usuario de los metadatos
// validados, ADR 0011) y con su permiso efectivo calculado por identity, nunca leído del cuerpo.
type actor struct {
	User       *domain.User
	TenantID   string
	Access     auth.Access
	Membership *domain.Membership
}

func (a *actor) has(perm string) bool { return slices.Contains(a.Access.Permissions, perm) }

func (a *actor) isOwner() bool { return a.User.Role == "BUSINESS_OWNER" }

// scope devuelve el alcance del actor y sus sucursales (A3).
func (a *actor) scope() (string, []string) {
	if a.isOwner() || a.Membership == nil || a.Membership.Scope != domain.ScopeBranches {
		return domain.ScopeTenant, nil
	}
	return domain.ScopeBranches, a.Membership.BranchIDs
}

// currentActor resuelve al actor del contexto. Un tenant del metadato distinto al del usuario
// se rechaza: el tenant del token manda (ADR 0014).
func (s *IdentityService) currentActor(ctx context.Context) (*actor, error) {
	userID := tenancy.UserIDFromContext(ctx)
	if userID == "" {
		return nil, domain.ErrUnauthenticated
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return nil, domain.ErrUnauthenticated
		}
		return nil, observability.Wrap(err, "load actor")
	}
	if ctxTenant := tenancy.TenantIDFromContext(ctx); ctxTenant != "" && ctxTenant != user.TenantID {
		return nil, domain.ErrForbidden
	}
	access, membership, err := s.accessFor(ctx, user)
	if err != nil {
		return nil, err
	}
	return &actor{User: user, TenantID: user.TenantID, Access: access, Membership: membership}, nil
}

// requirePermission exige un actor de negocio con el permiso (deny-by-default en el servidor).
func (s *IdentityService) requirePermission(ctx context.Context, perms ...string) (*actor, error) {
	a, err := s.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	if a.TenantID == "" {
		return nil, domain.ErrNoTenant
	}
	for _, p := range perms {
		if a.has(p) {
			return a, nil
		}
	}
	return nil, domain.ErrForbidden
}

// requireMember exige pertenecer a un negocio con membresía activa.
func (s *IdentityService) requireMember(ctx context.Context) (*actor, error) {
	a, err := s.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	if a.TenantID == "" {
		return nil, domain.ErrNoTenant
	}
	if (a.Membership != nil && a.Membership.Status != domain.UserStatusActive) || !a.User.IsActive() {
		return nil, domain.ErrForbidden
	}
	return a, nil
}

// requireStepUp consume el token de confirmación fuerte del contexto (x-pp-step-up) para la operación.
func (s *IdentityService) requireStepUp(ctx context.Context, a *actor, operation string) error {
	return s.requireContextStepUp(ctx, a.User.ID, operation)
}

// accessFor calcula el permiso efectivo de un usuario (R10, R21, R22, R24).
func (s *IdentityService) accessFor(ctx context.Context, user *domain.User) (auth.Access, *domain.Membership, error) {
	in := auth.AccessInput{BaseRole: user.Role, MembershipActive: user.IsActive(), Scope: domain.ScopeTenant}
	if user.TenantID == "" {
		// Sin negocio no hay membresía, sea cual sea el rol base guardado (V1): solo la base.
		in.MembershipActive = false
		return auth.ResolveAccess(in), nil, nil
	}
	if user.Role == "PLATFORM_ADMIN" {
		return auth.ResolveAccess(in), nil, nil
	}
	var membership *domain.Membership
	if s.roles != nil {
		m, err := s.roles.MembershipForUser(ctx, user.ID)
		if err != nil {
			return auth.Access{}, nil, observability.Wrap(err, "load membership")
		}
		membership = m
		if m != nil {
			in.MembershipActive = in.MembershipActive && m.Status == domain.UserStatusActive
			in.Scope, in.BranchIDs = m.Scope, m.BranchIDs
		}
		if user.Role == "BUSINESS_STAFF" {
			role, err := s.roles.RoleForUser(ctx, user.ID)
			if err != nil {
				return auth.Access{}, nil, observability.Wrap(err, "load assigned role")
			}
			if role != nil {
				in.RolePermissions = role.Permissions
			}
		}
	}
	if s.tenants != nil {
		t, err := s.tenants.GetTenant(ctx, user.TenantID)
		if errors.Is(err, domain.ErrTenantNotFound) {
			// tenant_id sin negocio (datos huérfanos): la persona se trata como cliente, nunca como
			// error, para no bloquear su sesión entera con un INTERNAL.
			in.MembershipActive = false
			return auth.ResolveAccess(in), nil, nil
		}
		if err != nil {
			return auth.Access{}, nil, observability.Wrap(err, "load tenant capabilities")
		}
		in.EnabledCapabilities = enabledCapabilities(t)
	}
	return auth.ResolveAccess(in), membership, nil
}

// enabledCapabilities devuelve las capacidades encendidas; nil si el negocio no tiene ninguna
// registrada (auth.DefaultEnabledCapabilities).
func enabledCapabilities(t *domain.Tenant) map[string]bool {
	if t == nil || len(t.Capabilities) == 0 {
		return nil
	}
	out := map[string]bool{}
	for _, c := range t.Capabilities {
		if c.Enabled {
			out[c.Capability] = true
		}
	}
	return out
}

// accessCache guarda el permiso efectivo de la ruta de lectura (ValidateToken, GetUserPermissions)
// con un TTL corto, igual al de revocación de R9 (≤ 15 s). Cada mutación de acceso de esta
// instancia la vacía; otra réplica ve el cambio al vencer el TTL. Las verificaciones de
// autorización (A1–A3) nunca la usan: leen el estado fresco.
type accessCache struct {
	ttl     time.Duration
	mu      sync.Mutex
	entries map[string]cachedPermissions
}

type cachedPermissions struct {
	perms *Permissions
	at    time.Time
}

func newAccessCache(ttl time.Duration) *accessCache {
	return &accessCache{ttl: ttl, entries: map[string]cachedPermissions{}}
}

func (c *accessCache) get(userID string) (*Permissions, bool) {
	if c == nil || c.ttl <= 0 {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[userID]
	if !ok || time.Since(e.at) >= c.ttl {
		return nil, false
	}
	return e.perms, true
}

func (c *accessCache) put(userID string, p *Permissions) {
	if c == nil || c.ttl <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[userID] = cachedPermissions{perms: p, at: time.Now()}
}

// invalidate vacía la caché completa: un cambio de rol, capacidad o sucursal afecta a muchas personas.
func (c *accessCache) invalidate() {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = map[string]cachedPermissions{}
}

// WithAccessCacheTTL ajusta el TTL de la caché del permiso efectivo (0 = desactivada).
func (s *IdentityService) WithAccessCacheTTL(d time.Duration) *IdentityService {
	s.access = newAccessCache(d)
	return s
}

// accessChanged se llama tras cada mutación de acceso que haya tenido éxito.
func (s *IdentityService) accessChanged() { s.access.invalidate() }

// PermissionsForUser devuelve rol, permisos, módulos, alcance y capacidades (R10, R21, R22, R24).
func (s *IdentityService) PermissionsForUser(ctx context.Context, userID string) (*Permissions, error) {
	if cached, ok := s.access.get(userID); ok {
		return cached, nil
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	access, _, err := s.accessFor(ctx, user)
	if err != nil {
		return nil, err
	}
	out := &Permissions{
		Role: user.Role, EnabledModules: access.Modules, Permissions: access.Permissions,
		BranchScope: access.BranchScope, Capabilities: access.Capabilities,
	}
	s.access.put(userID, out)
	return out, nil
}

// ── Catálogos (lectura) ───────────────────────────────────────────────────────

// ListRoleTemplates devuelve las plantillas universales y las de las verticales pedidas; sin
// verticales, las del negocio del actor (o todas si no tiene negocio).
func (s *IdentityService) ListRoleTemplates(ctx context.Context, verticalKeys []string) ([]auth.RoleTemplateEntry, error) {
	if len(verticalKeys) == 0 && s.tenants != nil {
		if userID := tenancy.UserIDFromContext(ctx); userID != "" {
			user, err := s.users.FindByID(ctx, userID)
			if err != nil {
				return nil, observability.Wrap(err, "load actor")
			}
			if user.TenantID != "" {
				t, err := s.tenants.GetTenant(ctx, user.TenantID)
				if err != nil {
					return nil, observability.Wrap(err, "load tenant")
				}
				verticalKeys = append([]string{t.PrimaryVertical}, t.SecondaryVerticals...)
			}
		}
	}
	return auth.RoleTemplates(verticalKeys), nil
}

// ── Perfil de negocio y capacidades (R20, R21) ────────────────────────────────

// ProfileInput es el perfil que propone el dueño.
type ProfileInput struct {
	PrimaryVertical    string
	SecondaryVerticals []string
	TraitAnswers       map[string]bool
}

// normalizeProfile valida verticales y rasgos y devuelve claves canónicas (R20).
func normalizeProfile(in ProfileInput) (ProfileInput, error) {
	primary, ok := auth.LookupVertical(in.PrimaryVertical)
	if !ok {
		return ProfileInput{}, domain.ErrVerticalNotFound
	}
	out := ProfileInput{PrimaryVertical: primary.Key, SecondaryVerticals: []string{}, TraitAnswers: map[string]bool{}}
	for _, k := range in.SecondaryVerticals {
		v, ok := auth.LookupVertical(k)
		if !ok || strings.TrimSpace(k) == "" {
			return ProfileInput{}, domain.ErrVerticalNotFound
		}
		if v.Key == primary.Key || slices.Contains(out.SecondaryVerticals, v.Key) {
			continue
		}
		out.SecondaryVerticals = append(out.SecondaryVerticals, v.Key)
	}
	if len(out.SecondaryVerticals) > auth.MaxSecondaryVerticals {
		return ProfileInput{}, domain.ErrTooManyVerticals
	}
	for t, on := range in.TraitAnswers {
		if !auth.IsKnownTrait(t) {
			return ProfileInput{}, domain.ErrUnknownTrait
		}
		out.TraitAnswers[t] = on
	}
	return out, nil
}

// derivedCapabilityStates convierte la derivación del perfil en filas de capacidades.
func derivedCapabilityStates(p ProfileInput) []domain.CapabilityState {
	derived := auth.DeriveCapabilities(p.PrimaryVertical, p.SecondaryVerticals, p.TraitAnswers)
	out := make([]domain.CapabilityState, 0, len(derived))
	for _, c := range sortedKeys(derived) {
		out = append(out, domain.CapabilityState{Capability: c, Enabled: true, Source: derived[c]})
	}
	return out
}

// GetBusinessProfile devuelve el perfil del negocio del actor (cualquier miembro).
func (s *IdentityService) GetBusinessProfile(ctx context.Context) (*TenantView, error) {
	a, err := s.requireMember(ctx)
	if err != nil {
		return nil, err
	}
	t, err := s.tenants.GetTenant(ctx, a.TenantID)
	if err != nil {
		return nil, err
	}
	return toTenantView(t), nil
}

// UpdateBusinessProfile cambia verticales y rasgos; nunca borra datos ni roles (R20, regla 4).
func (s *IdentityService) UpdateBusinessProfile(ctx context.Context, in ProfileInput) (*TenantView, error) {
	a, err := s.requirePermission(ctx, "admin:business:manage")
	if err != nil {
		return nil, err
	}
	p, err := normalizeProfile(in)
	if err != nil {
		return nil, err
	}
	derived := auth.DeriveCapabilities(p.PrimaryVertical, p.SecondaryVerticals, p.TraitAnswers)
	t, err := s.tenants.UpdateBusinessProfile(ctx, a.TenantID, p.PrimaryVertical, p.SecondaryVerticals, p.TraitAnswers, derived, a.User.ID)
	if err != nil {
		return nil, err
	}
	s.accessChanged()
	return toTenantView(t), nil
}

// SetCapabilities enciende o apaga capacidades a mano (R21). Una capacidad sujeta a una pregunta
// abierta no se enciende (CAPABILITY_DISABLED); apagar Finanzas o Equipo pide step-up.
func (s *IdentityService) SetCapabilities(ctx context.Context, changes map[string]bool) (*TenantView, error) {
	a, err := s.requirePermission(ctx, "admin:business:manage")
	if err != nil {
		return nil, err
	}
	if len(changes) == 0 {
		return nil, domain.ErrInvalidRequest
	}
	critical := false
	for c, on := range changes {
		if !auth.IsKnownCapability(c) {
			return nil, domain.ErrUnknownCapability
		}
		if on && auth.GatedCapabilities[c] {
			return nil, domain.ErrCapabilityGated
		}
		if !on && (strings.HasPrefix(c, "finance.") || strings.HasPrefix(c, "payroll.")) {
			critical = true
		}
	}
	if critical {
		if err := s.requireStepUp(ctx, a, OpCapabilitiesSet); err != nil {
			return nil, err
		}
	}
	t, err := s.tenants.SetCapabilities(ctx, a.TenantID, changes, a.User.ID)
	if err != nil {
		return nil, err
	}
	s.accessChanged()
	return toTenantView(t), nil
}

// ── Sucursales (R24) ──────────────────────────────────────────────────────────

// requireTenantScope exige alcance TENANT: la estructura del negocio no tiene sucursal propia.
func requireTenantScope(a *actor) error {
	if scope, _ := a.scope(); scope != domain.ScopeTenant {
		return domain.ErrBranchOutOfScope
	}
	return nil
}

// UpsertBranch crea o edita una sucursal (código DGI de 4 dígitos, único en el negocio).
func (s *IdentityService) UpsertBranch(ctx context.Context, b domain.Branch) (*domain.Branch, error) {
	a, err := s.requirePermission(ctx, "admin:business:manage")
	if err != nil {
		return nil, err
	}
	if err := requireTenantScope(a); err != nil {
		return nil, err
	}
	b.Code, b.Name, b.Address = strings.TrimSpace(b.Code), strings.TrimSpace(b.Name), strings.TrimSpace(b.Address)
	if err := domain.ValidateBranch(&b); err != nil {
		return nil, err
	}
	b.TenantID = a.TenantID
	return s.tenants.UpsertBranch(ctx, &b)
}

// ListBranches devuelve las sucursales visibles para el actor: todas con alcance TENANT, solo
// las suyas con alcance BRANCHES.
func (s *IdentityService) ListBranches(ctx context.Context, includeInactive bool) ([]domain.Branch, error) {
	a, err := s.requireMember(ctx)
	if err != nil {
		return nil, err
	}
	list, err := s.tenants.ListBranches(ctx, a.TenantID, includeInactive)
	if err != nil {
		return nil, err
	}
	scope, mine := a.scope()
	if scope == domain.ScopeTenant {
		return list, nil
	}
	out := list[:0]
	for _, b := range list {
		if slices.Contains(mine, b.ID) {
			out = append(out, b)
		}
	}
	return out, nil
}

// SetBranchActive desactiva o reactiva una sucursal; nunca la única activa.
func (s *IdentityService) SetBranchActive(ctx context.Context, branchID string, active bool) (*domain.Branch, error) {
	a, err := s.requirePermission(ctx, "admin:business:manage")
	if err != nil {
		return nil, err
	}
	if err := requireTenantScope(a); err != nil {
		return nil, err
	}
	if branchID == "" {
		return nil, domain.ErrInvalidRequest
	}
	b, err := s.tenants.SetBranchActive(ctx, a.TenantID, branchID, active)
	if err != nil {
		return nil, err
	}
	s.accessChanged() // el alcance BRANCHES solo cuenta sucursales activas
	return b, nil
}

// validateBranchesInTenant comprueba que cada sucursal exista y esté activa en el negocio.
// Una sucursal ajena responde BRANCH_OUT_OF_SCOPE, sin revelar si existe.
func (s *IdentityService) validateBranchesInTenant(ctx context.Context, tenantID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	list, err := s.tenants.ListBranches(ctx, tenantID, false)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if !slices.ContainsFunc(list, func(b domain.Branch) bool { return b.ID == id }) {
			return domain.ErrBranchOutOfScope
		}
	}
	return nil
}

func sortedKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
