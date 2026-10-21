// Package service tiene los casos de uso de fiscal-invoicing (SPEC §4): permisos, orquestación con
// identity/security/infra-management y transacciones del store. El tenant y el actor salen siempre de
// los metadatos (ADR 0011), nunca del cuerpo.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/observability"
	"plentypay/fiscal-invoicing/internal/store"
	"plentypay/fiscal-invoicing/internal/tenancy"
)

// StepUpOperation es la operación del catálogo de confirmación fuerte que protege el perfil fiscal
// (security-standards.md §4.1: configurar credenciales fiscales).
const StepUpOperation = "security.credentials.update"

// Permisos (identity/internal/auth/permissions.go).
const (
	PermRead          = "fiscal:read"
	PermIssue         = "fiscal:issue"
	PermNoteIssue     = "fiscal:note:issue"
	PermProfileManage = "fiscal:profile:manage"
)

// IdentityAPI es lo que el servicio necesita de identity.
type IdentityAPI interface {
	TenantLegal(ctx context.Context, requestID, tenantID string) (client.TenantLegal, error)
	ConsumeStepUp(ctx context.Context, requestID, token, userID, operation string) (string, error)
}

// SecretsAPI guarda las credenciales del PAC en security.
type SecretsAPI interface {
	PutSecret(ctx context.Context, requestID, name string, value []byte, idempotencyKey string) (string, error)
}

// Store es lo que el servicio necesita de la persistencia.
type Store interface {
	GetProfile(ctx context.Context, tenantID string) (domain.Profile, error)
	UpsertProfile(ctx context.Context, p domain.Profile) (domain.Profile, error)
	GetFolioStatus(ctx context.Context, tenantID, pos string) (store.FolioStatus, error)
	UpsertTaxpayer(ctx context.Context, t domain.Taxpayer) (domain.Taxpayer, error)
	SearchTaxpayers(ctx context.Context, tenantID, query string, limit int, cursor string) ([]domain.Taxpayer, string, error)
}

// Service implementa los casos de uso.
type Service struct {
	store    Store
	identity IdentityAPI
	secrets  SecretsAPI
	now      func() time.Time
	newID    func() string
}

// New arma el servicio.
func New(st Store, identity IdentityAPI, secrets SecretsAPI, now func() time.Time, newID func() string) *Service {
	return &Service{store: st, identity: identity, secrets: secrets, now: now, newID: newID}
}

// actorWith exige un negocio y alguno de los permisos (deny-by-default). Un servicio interno (pos,
// orders) llega con x-pp-actor-service y el tenant de la venta.
func actorWith(ctx context.Context, perms ...string) (tenancy.Actor, error) {
	a := tenancy.FromContext(ctx)
	if a.TenantID == "" {
		return a, domain.ErrNoTenant
	}
	if a.Service == "pos" || a.Service == "orders" {
		return a, nil
	}
	for _, p := range perms {
		if a.Permissions[p] {
			return a, nil
		}
	}
	return a, domain.ErrPermissionDenied
}

// ConfigureInput es lo que la persona configura; RUC, DV y razón social salen de identity.
type ConfigureInput struct {
	Environment        string
	CheckoutPreference int
	AutoThresholdMinor *int64
	BranchCode         string
	PointOfSaleCode    string
	PACProvider        string
	PACCredentials     []byte // se reenvían a security y no se guardan aquí
	StepUpToken        string
	IdempotencyKey     string
}

// ConfigureProfile guarda el perfil fiscal (SPEC §4, R9). El formato se valida antes de consumir el
// step-up, para que un error de datos no gaste la confirmación.
func (s *Service) ConfigureProfile(ctx context.Context, in ConfigureInput) (domain.Profile, error) {
	a, err := actorWith(ctx, PermProfileManage)
	if err != nil {
		return domain.Profile{}, err
	}
	if a.Service != "" && a.Service != "api-gateway" {
		return domain.Profile{}, domain.ErrPermissionDenied // solo una persona configura su perfil
	}
	key := strings.TrimSpace(in.IdempotencyKey)
	if n := len(key); n < 16 || n > 100 {
		return domain.Profile{}, domain.ErrInvalidRequest
	}
	if prev, err := s.store.GetProfile(ctx, a.TenantID); err == nil && prev.IdempotencyKey == key {
		return prev, nil // reintento de la misma configuración: no consume otro step-up
	} else if err != nil && !errors.Is(err, domain.ErrProfileMissing) {
		return domain.Profile{}, observability.Wrap(err, "load fiscal profile")
	}
	legal, err := s.identity.TenantLegal(ctx, a.RequestID, a.TenantID)
	if err != nil {
		if errors.Is(err, client.ErrTenantNotFound) {
			return domain.Profile{}, domain.ErrNoTenant
		}
		return domain.Profile{}, fmt.Errorf("%w: %v", domain.ErrDependency, err)
	}
	provider := strings.TrimSpace(in.PACProvider)
	if provider == "" && in.Environment == domain.EnvDemo {
		provider = domain.ProviderSimulator
	}
	p := domain.Profile{
		TenantID: a.TenantID, RUC: strings.ToUpper(strings.TrimSpace(legal.TaxID)), DV: strings.TrimSpace(legal.DV),
		LegalName: strings.TrimSpace(legal.LegalName), BranchCode: orDefault(in.BranchCode, "0000"),
		PointOfSaleCode: orDefault(in.PointOfSaleCode, "001"), PACProvider: provider,
		CheckoutPreference: in.CheckoutPreference, AutoThresholdMinor: in.AutoThresholdMinor,
		Environment: in.Environment, IdempotencyKey: key, UpdatedAt: s.now(),
	}
	if err := p.Validate(); err != nil {
		return domain.Profile{}, err
	}
	token := tenancy.StepUpToken(ctx)
	if token == "" {
		token = strings.TrimSpace(in.StepUpToken)
	}
	if token == "" {
		return domain.Profile{}, domain.ErrStepUpRequired
	}
	reason, err := s.identity.ConsumeStepUp(ctx, a.RequestID, token, a.UserID, StepUpOperation)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("%w: %v", domain.ErrDependency, err)
	}
	if reason != "" {
		return domain.Profile{}, domain.ErrStepUpInvalid
	}
	if len(in.PACCredentials) > 0 {
		name := "fiscal/" + a.TenantID + "/pac"
		if _, err := s.secrets.PutSecret(ctx, a.RequestID, name, in.PACCredentials, key); err != nil {
			return domain.Profile{}, fmt.Errorf("%w: %v", domain.ErrDependency, err)
		}
		p.PACCredentialsSecret = name
	} else if prev, err := s.store.GetProfile(ctx, a.TenantID); err == nil {
		p.PACCredentialsSecret = prev.PACCredentialsSecret
	}
	out, err := s.store.UpsertProfile(ctx, p)
	if err != nil {
		return domain.Profile{}, observability.Wrap(err, "save fiscal profile")
	}
	return out, nil
}

// GetProfile devuelve el perfil del negocio del actor.
func (s *Service) GetProfile(ctx context.Context) (domain.Profile, error) {
	a, err := actorWith(ctx, PermRead, PermProfileManage, PermIssue)
	if err != nil {
		return domain.Profile{}, err
	}
	p, err := s.store.GetProfile(ctx, a.TenantID)
	if err != nil && !errors.Is(err, domain.ErrProfileMissing) {
		return p, observability.Wrap(err, "load fiscal profile")
	}
	return p, err
}

// FolioStatus devuelve los folios restantes del punto de facturación del perfil.
func (s *Service) FolioStatus(ctx context.Context) (store.FolioStatus, error) {
	a, err := actorWith(ctx, PermRead, PermProfileManage)
	if err != nil {
		return store.FolioStatus{}, err
	}
	p, err := s.store.GetProfile(ctx, a.TenantID)
	if err != nil {
		if errors.Is(err, domain.ErrProfileMissing) {
			return store.FolioStatus{}, err
		}
		return store.FolioStatus{}, observability.Wrap(err, "load fiscal profile")
	}
	st, err := s.store.GetFolioStatus(ctx, a.TenantID, p.PointOfSaleCode)
	if err != nil && !errors.Is(err, domain.ErrProfileMissing) {
		return st, observability.Wrap(err, "load folio status")
	}
	return st, err
}

// EvaluatePolicy aplica la preferencia del negocio a una venta (domain-model §8.8).
func (s *Service) EvaluatePolicy(ctx context.Context, totalMinor int64, requestsFiscal, hasTaxID bool) (domain.PolicyDecision, error) {
	a, err := actorWith(ctx, PermIssue)
	if err != nil {
		return domain.PolicyDecision{}, err
	}
	if totalMinor < 0 {
		return domain.PolicyDecision{}, domain.ErrInvalidRequest
	}
	p, err := s.store.GetProfile(ctx, a.TenantID)
	if err != nil {
		if errors.Is(err, domain.ErrProfileMissing) {
			return domain.PolicyDecision{}, err
		}
		return domain.PolicyDecision{}, observability.Wrap(err, "load fiscal profile")
	}
	return domain.EvaluatePolicy(p, totalMinor, requestsFiscal, hasTaxID), nil
}

// UpsertTaxpayer guarda un contribuyente frecuente (N-FIS-07).
func (s *Service) UpsertTaxpayer(ctx context.Context, t domain.Taxpayer) (domain.Taxpayer, error) {
	a, err := actorWith(ctx, PermIssue)
	if err != nil {
		return domain.Taxpayer{}, err
	}
	t = t.Normalize()
	if err := t.Validate(); err != nil {
		return domain.Taxpayer{}, err
	}
	t.ID, t.TenantID, t.CreatedAt, t.UpdatedAt = s.newID(), a.TenantID, s.now(), s.now()
	out, err := s.store.UpsertTaxpayer(ctx, t)
	if err != nil {
		return out, observability.Wrap(err, "save taxpayer")
	}
	return out, nil
}

// SearchTaxpayers busca contribuyentes frecuentes del negocio.
func (s *Service) SearchTaxpayers(ctx context.Context, query string, pageSize int, cursor string) ([]domain.Taxpayer, string, error) {
	a, err := actorWith(ctx, PermIssue, PermRead)
	if err != nil {
		return nil, "", err
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 || len(query) > 100 {
		return nil, "", domain.ErrInvalidRequest
	}
	out, next, err := s.store.SearchTaxpayers(ctx, a.TenantID, query, pageSize, cursor)
	if err != nil && !errors.Is(err, domain.ErrInvalidRequest) {
		return nil, "", observability.Wrap(err, "search taxpayers")
	}
	return out, next, err
}

func orDefault(v, def string) string {
	if v = strings.TrimSpace(v); v != "" {
		return v
	}
	return def
}
