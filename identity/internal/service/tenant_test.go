package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// fakeTenantStore implementa store.TenantStore en memoria.
type fakeTenantStore struct {
	tenants  map[string]*domain.Tenant // por id
	byOwner  map[string]*domain.Tenant // por owner
	byTaxID  map[string]*domain.Tenant
	outbox   []string
	reviews  []string // "tenantID:prev->next"
	failWith error
}

func newFakeTenantStore() *fakeTenantStore {
	return &fakeTenantStore{
		tenants: map[string]*domain.Tenant{},
		byOwner: map[string]*domain.Tenant{},
		byTaxID: map[string]*domain.Tenant{},
	}
}

func (f *fakeTenantStore) CreateTenant(_ context.Context, owner *domain.User, t *domain.Tenant) error {
	if f.failWith != nil {
		return f.failWith
	}
	if _, ok := f.byOwner[owner.ID]; ok {
		return domain.ErrTenantAlreadyExists
	}
	if _, ok := f.byTaxID[domain.NormalizeTaxId(t.TaxID)]; ok {
		return domain.ErrTaxIDTaken
	}
	if t.ID == "" {
		t.ID = "tenant-" + owner.ID
	}
	if t.Status == "" {
		t.Status = domain.TenantPendingReview
	}
	if t.Country == "" {
		t.Country = "PA"
	}
	f.tenants[t.ID] = t
	f.byOwner[owner.ID] = t
	f.byTaxID[domain.NormalizeTaxId(t.TaxID)] = t
	f.outbox = append(f.outbox, "pp.identity.tenant.status_changed.v1")
	return nil
}

func (f *fakeTenantStore) GetTenant(_ context.Context, tenantID string) (*domain.Tenant, error) {
	t, ok := f.tenants[tenantID]
	if !ok {
		return nil, domain.ErrTenantNotFound
	}
	cp := *t
	return &cp, nil
}

func (f *fakeTenantStore) GetTenantByOwner(_ context.Context, userID string) (*domain.Tenant, error) {
	t, ok := f.byOwner[userID]
	if !ok {
		return nil, nil
	}
	cp := *t
	return &cp, nil
}

func (f *fakeTenantStore) ListTenants(_ context.Context, status string, _ int, _ time.Time) ([]domain.Tenant, error) {
	var out []domain.Tenant
	for _, t := range f.tenants {
		if status == "" || t.Status == status {
			out = append(out, *t)
		}
	}
	return out, nil
}

func (f *fakeTenantStore) ReviewTenant(_ context.Context, tenantID string, approve bool, notes string) (string, string, error) {
	t, ok := f.tenants[tenantID]
	if !ok {
		return "", "", domain.ErrTenantNotFound
	}
	next, err := domain.NextStatus(t.Status, approve)
	if err != nil {
		return "", "", err
	}
	previous := t.Status
	t.Status = next
	t.ReviewNotes = notes
	f.reviews = append(f.reviews, tenantID+":"+previous+"->"+next)
	f.outbox = append(f.outbox, "pp.identity.tenant.status_changed.v1")
	return previous, next, nil
}

func (f *fakeTenantStore) OutboxPending(_ context.Context, _ int) ([]store.OutboxEvent, error) {
	return nil, nil
}

func (f *fakeTenantStore) OutboxMarkPublished(_ context.Context, _ string) error { return nil }

func tenantService(t *testing.T) (*service.IdentityService, *fakeTenantStore) {
	t.Helper()
	svc, _, _ := serviceWithSessions(t)
	ts := newFakeTenantStore()
	svc.WithTenants(ts)
	return svc, ts
}

func createBusiness(t *testing.T, svc *service.IdentityService, email string) *service.BusinessResult {
	t.Helper()
	res, err := svc.CreateBusiness(context.Background(), service.CreateBusinessInput{
		OwnerEmail: email, OwnerPassword: "una-clave-muy-larga", OwnerFullName: "Ana",
		LegalName: "Ana Sociedad S.A.", TradeName: "AnaStore", TaxID: "155612345-2-2023", DV: "2",
		Country: "PA", DocumentKeys: []string{"tenant/2026/uuid.pdf"}, Now: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("CreateBusiness: %v", err)
	}
	return res
}

// CreateBusiness crea el tenant en PENDING_REVIEW, asciende al dueno y devuelve
// sesion (SPEC §4).
func TestF08_5_CreateBusiness(t *testing.T) {
	svc, ts := tenantService(t)
	res := createBusiness(t, svc, "negocio@example.com")
	if !res.Success {
		t.Fatalf("CreateBusiness fallido: %+v", res)
	}
	if res.Tenant == nil || res.Tenant.Status != domain.TenantPendingReview {
		t.Fatalf("el tenant deberia nacer PENDING_REVIEW: %+v", res.Tenant)
	}
	if res.Session == nil || res.Session.AccessToken == "" {
		t.Fatal("CreateBusiness debe devolver sesion del dueno")
	}
	if len(ts.tenants) != 1 {
		t.Fatalf("se esperaba 1 tenant, llegaron %d", len(ts.tenants))
	}
	if len(ts.outbox) != 1 {
		t.Fatalf("el alta deberia escribir 1 evento, llegaron %d", len(ts.outbox))
	}
}

// R11/SPEC §4: un usuario que ya tiene negocio recibe ALREADY_HAS_TENANT.
func TestF08_5_CreateBusiness_AlreadyHasTenant(t *testing.T) {
	svc, _ := tenantService(t)
	if res := createBusiness(t, svc, "dueno@example.com"); !res.Success {
		t.Fatalf("primer CreateBusiness: %+v", res)
	}
	res := createBusiness(t, svc, "dueno@example.com")
	if res.Success || res.Reason != "ALREADY_HAS_TENANT" {
		t.Fatalf("se esperaba ALREADY_HAS_TENANT, llego %+v", res)
	}
}

// R17: RUC duplicado -> RUC_TAKEN (aunque sea otro dueno).
func TestF08_5_CreateBusiness_RUCTaken(t *testing.T) {
	svc, _ := tenantService(t)
	if res := createBusiness(t, svc, "uno@example.com"); !res.Success {
		t.Fatalf("primer CreateBusiness: %+v", res)
	}
	res := createBusiness(t, svc, "dos@example.com")
	if res.Success || res.Reason != "RUC_TAKEN" {
		t.Fatalf("se esperaba RUC_TAKEN, llego %+v", res)
	}
}

// SPEC §4: RUC invalido -> INVALID_TAX_ID y no se crea nada.
func TestF08_5_CreateBusiness_InvalidTaxID(t *testing.T) {
	svc, ts := tenantService(t)
	res, err := svc.CreateBusiness(context.Background(), service.CreateBusinessInput{
		OwnerEmail: "ruc@example.com", OwnerPassword: "una-clave-muy-larga", OwnerFullName: "Ana",
		LegalName: "Ana S.A.", TaxID: "12", Now: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("CreateBusiness: %v", err)
	}
	if res.Success || res.Reason != "INVALID_TAX_ID" {
		t.Fatalf("se esperaba INVALID_TAX_ID, llego %+v", res)
	}
	if len(ts.tenants) != 0 {
		t.Fatal("un RUC invalido no deberia crear tenant")
	}
}

// ReviewBusiness: aprobar un PENDING_REVIEW -> ACTIVE y un solo evento.
func TestF08_5_ReviewBusiness_Approve(t *testing.T) {
	svc, ts := tenantService(t)
	res := createBusiness(t, svc, "revisar@example.com")
	tenantID := res.Tenant.ID

	review, err := svc.ReviewBusiness(context.Background(), tenantID, true, "KYB ok")
	if err != nil {
		t.Fatalf("ReviewBusiness: %v", err)
	}
	if review == nil || review.Current != domain.TenantActive || review.Previous != domain.TenantPendingReview {
		t.Fatalf("transicion inesperada: %+v", review)
	}
	// Alta (1) + transicion (1) = 2 eventos.
	if len(ts.outbox) != 2 {
		t.Fatalf("se esperaban 2 eventos (alta + transicion), llegaron %d", len(ts.outbox))
	}
}

// ReviewBusiness: suspender un ACTIVO -> SUSPENDED; doble aprobacion -> invalida.
func TestF08_5_ReviewBusiness_Transitions(t *testing.T) {
	svc, ts := tenantService(t)
	res := createBusiness(t, svc, "ciclo@example.com")
	tenantID := res.Tenant.ID

	if _, err := svc.ReviewBusiness(context.Background(), tenantID, true, ""); err != nil {
		t.Fatalf("aprobar: %v", err)
	}
	// Aprobar dos veces: la segunda es invalida y NO escribe evento.
	outboxBefore := len(ts.outbox)
	review, err := svc.ReviewBusiness(context.Background(), tenantID, true, "")
	if err != nil {
		t.Fatalf("segunda aprobacion: %v", err)
	}
	if review != nil {
		t.Fatalf("aprobar un ACTIVO deberia ser invalido, llego %+v", review)
	}
	if len(ts.outbox) != outboxBefore {
		t.Fatal("una transicion invalida no debe escribir evento")
	}

	// Suspender.
	review, err = svc.ReviewBusiness(context.Background(), tenantID, false, "fraude")
	if err != nil || review == nil || review.Current != domain.TenantSuspended {
		t.Fatalf("suspender: %+v %v", review, err)
	}
	// Reactivar.
	review, err = svc.ReviewBusiness(context.Background(), tenantID, true, "")
	if err != nil || review == nil || review.Current != domain.TenantActive {
		t.Fatalf("reactivar: %+v %v", review, err)
	}
}

// Un fallo del store se propaga envuelto (no se descarta).
func TestF08_5_ReviewBusiness_StoreError(t *testing.T) {
	svc, ts := tenantService(t)
	ts.failWith = errors.New("boom")
	_, err := svc.CreateBusiness(context.Background(), service.CreateBusinessInput{
		OwnerEmail: "fallo@example.com", OwnerPassword: "una-clave-muy-larga", OwnerFullName: "Ana",
		LegalName: "Ana S.A.", TaxID: "155612345-2-2023", Now: time.Now().UTC(),
	})
	if err == nil || !strings.Contains(err.Error(), "boom") {
		t.Fatalf("se esperaba el error envuelto del store, llego %v", err)
	}
}
