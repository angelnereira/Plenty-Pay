package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
)

// CreateBusinessInput agrupa el alta de un negocio (SPEC §4 CreateBusiness).
type CreateBusinessInput struct {
	OwnerEmail    string
	OwnerPassword string
	OwnerFullName string
	LegalName     string
	TradeName     string
	TaxID         string
	DV            string
	Country       string
	DocumentKeys  []string
	// Perfil de negocio (R20): vertical principal (vacía = general_commercial), respuestas de
	// rasgos y nombre de la sucursal matriz 0000.
	PrimaryVertical string
	TraitAnswers    map[string]bool
	BranchName      string
	Now             time.Time
}

// DefaultPlanCode es el plan único del piloto mientras se decide Q-29.
const DefaultPlanCode = "standard"

// TenantView es el tenant tal como lo devuelve el servicio.
type TenantView struct {
	ID          string
	LegalName   string
	TradeName   string
	TaxID       string
	DV          string
	Status      string
	Country     string
	ReviewNotes string
	CreatedAt   time.Time
	// Perfil de negocio y capacidades (ADR 0018).
	PrimaryVertical    string
	SecondaryVerticals []string
	TraitOverrides     map[string]bool
	Traits             []string // rasgos efectivos, ordenados
	PlanCode           string
	Version            int32
	Capabilities       []domain.CapabilityState
}

// BusinessResult es el resultado de CreateBusiness (tenant + sesion del dueno).
type BusinessResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
	Tenant       *TenantView
	Session      *AuthResult
}

// CreateBusiness da de alta un negocio en PENDING_REVIEW y asciende a su dueno a
// BUSINESS_OWNER (SPEC §4, R6). Rechaza si el dueno ya tiene negocio (R11/R17).
func (s *IdentityService) CreateBusiness(ctx context.Context, in CreateBusinessInput) (*BusinessResult, error) {
	if s.tenants == nil {
		return &BusinessResult{ErrorMessage: "error interno"}, nil
	}
	if in.LegalName == "" || in.TaxID == "" {
		return rejectBusiness("INVALID_TAX_ID", "razón social y RUC son obligatorios"), nil
	}
	if err := domain.ValidateTaxId(in.TaxID, in.DV); err != nil {
		return rejectBusiness("INVALID_TAX_ID", "RUC inválido"), nil
	}
	profile, err := normalizeProfile(ProfileInput{PrimaryVertical: in.PrimaryVertical, TraitAnswers: in.TraitAnswers})
	if err != nil {
		if errors.Is(err, domain.ErrVerticalNotFound) {
			return rejectBusiness("VERTICAL_NOT_FOUND", "tipo de negocio no encontrado"), nil
		}
		return rejectBusiness("INVALID_REQUEST", "rasgo de negocio desconocido"), nil
	}

	// El dueeno: se busca por correo; si no existe, se crea con la clave dada.
	owner, err := s.users.FindByEmail(ctx, domain.NormalizeEmail(in.OwnerEmail))
	if err != nil {
		if !errors.Is(err, domain.ErrUserNotFound) {
			return nil, err
		}
		if err := domain.ValidateEmail(domain.NormalizeEmail(in.OwnerEmail)); err != nil {
			return rejectBusiness("INVALID_EMAIL", "correo invalido"), nil
		}
		if err := domain.ValidatePassword(in.OwnerPassword); err != nil {
			return rejectBusiness("WEAK_PASSWORD", "la contrasena debe tener entre 12 y 128 caracteres"), nil
		}
		owner, err = s.createOwner(ctx, in)
		if err != nil {
			return nil, err
		}
	} else if !auth.VerifyPassword(in.OwnerPassword, owner.PasswordHash) {
		return rejectBusiness("INVALID_CREDENTIALS", "correo o contrasena incorrectos"), nil
	}

	existing, err := s.tenants.GetTenantByOwner(ctx, owner.ID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return rejectBusiness("ALREADY_HAS_TENANT", "el usuario ya tiene un negocio"), nil
	}

	tenant := &domain.Tenant{
		LegalName: in.LegalName, TradeName: in.TradeName,
		TaxID: domain.NormalizeTaxId(in.TaxID), DV: in.DV,
		Country: in.Country, Documents: in.DocumentKeys,
		CreatedAt:       in.Now,
		PrimaryVertical: profile.PrimaryVertical, SecondaryVerticals: profile.SecondaryVerticals,
		TraitOverrides: profile.TraitAnswers, PlanCode: DefaultPlanCode, BranchName: in.BranchName,
		Capabilities: derivedCapabilityStates(profile),
	}
	if err := s.tenants.CreateTenant(ctx, owner, tenant); err != nil {
		if errors.Is(err, domain.ErrTenantAlreadyExists) {
			return rejectBusiness("ALREADY_HAS_TENANT", "el usuario ya tiene un negocio"), nil
		}
		if errors.Is(err, domain.ErrTaxIDTaken) {
			return rejectBusiness("RUC_TAKEN", "ese RUC ya esta registrado"), nil
		}
		return nil, err
	}

	s.accessChanged()
	// Sesion del dueno: el token ya lleva su nuevo rol y su tenant.
	owner.Role, owner.TenantID = "BUSINESS_OWNER", tenant.ID
	session, err := s.issueTokens(ctx, owner, s.startSession(ctx, owner.ID))
	if err != nil {
		return nil, err
	}
	return &BusinessResult{Success: true, Tenant: toTenantView(tenant), Session: session}, nil
}

func (s *IdentityService) createOwner(ctx context.Context, in CreateBusinessInput) (*domain.User, error) {
	hash, err := auth.HashPassword(in.OwnerPassword)
	if err != nil {
		return nil, err
	}
	owner := &domain.User{
		ID:    uuid.NewString(),
		Email: domain.NormalizeEmail(in.OwnerEmail), PasswordHash: hash,
		FullName: in.OwnerFullName, Role: "BUSINESS_OWNER",
	}
	if err := s.users.Create(ctx, owner); err != nil {
		return nil, err
	}
	return owner, nil
}

// TenantReview es el resultado de una revision: el tenant y la transicion
// aplicada (anterior -> actual), que es justo lo que se publica como evento.
type TenantReview struct {
	Tenant   *TenantView
	Previous string
	Current  string
}

// ReviewBusiness aplica la transicion de estado (solo plataforma). Una
// transicion valida escribe exactamente un evento en el outbox (ADR 0012); una
// transicion invalida no escribe nada.
func (s *IdentityService) ReviewBusiness(ctx context.Context, tenantID string, approve bool, notes string) (*TenantReview, error) {
	if s.tenants == nil {
		return nil, nil
	}
	previous, current, err := s.tenants.ReviewTenant(ctx, tenantID, approve, notes)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidTransition) {
			return nil, nil
		}
		return nil, err
	}
	tenant, err := s.tenants.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &TenantReview{Tenant: toTenantView(tenant), Previous: previous, Current: current}, nil
}

// Tenant devuelve un tenant por id.
func (s *IdentityService) Tenant(ctx context.Context, tenantID string) (*TenantView, error) {
	if s.tenants == nil {
		return nil, nil
	}
	t, err := s.tenants.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return toTenantView(t), nil
}

// ListTenants pagina los negocios (consola de plataforma).
func (s *IdentityService) ListTenants(ctx context.Context, status string, limit int) ([]TenantView, error) {
	if s.tenants == nil {
		return nil, nil
	}
	list, err := s.tenants.ListTenants(ctx, status, limit, time.Now().UTC().Add(24*time.Hour))
	if err != nil {
		return nil, err
	}
	out := make([]TenantView, 0, len(list))
	for i := range list {
		out = append(out, *toTenantView(&list[i]))
	}
	return out, nil
}

func toTenantView(t *domain.Tenant) *TenantView {
	if t == nil {
		return nil
	}
	traits := []string{}
	for tr := range auth.EffectiveTraits(t.PrimaryVertical, t.SecondaryVerticals, t.TraitOverrides) {
		traits = append(traits, tr)
	}
	sort.Strings(traits)
	return &TenantView{
		ID: t.ID, LegalName: t.LegalName, TradeName: t.TradeName,
		TaxID: t.TaxID, DV: t.DV, Status: t.Status, Country: t.Country,
		ReviewNotes: t.ReviewNotes, CreatedAt: t.CreatedAt,
		PrimaryVertical: t.PrimaryVertical, SecondaryVerticals: t.SecondaryVerticals,
		TraitOverrides: t.TraitOverrides, Traits: traits, PlanCode: t.PlanCode, Version: t.Version,
		Capabilities: t.Capabilities,
	}
}

func rejectBusiness(reason, message string) *BusinessResult {
	return &BusinessResult{Success: false, Reason: reason, ErrorMessage: message}
}
