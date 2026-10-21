package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc/metadata"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/store"
)

const (
	tenantA = "01900000-0000-7000-8000-0000000000a1"
	userA   = "01900000-0000-7000-8000-0000000000b1"
	keyA    = "configurar-perfil-0001"
)

type fakeStore struct {
	mu        sync.Mutex
	profiles  map[string]domain.Profile
	taxpayers map[string]domain.Taxpayer
}

func newFakeStore() *fakeStore {
	return &fakeStore{profiles: map[string]domain.Profile{}, taxpayers: map[string]domain.Taxpayer{}}
}

func (f *fakeStore) GetProfile(_ context.Context, tenantID string) (domain.Profile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.profiles[tenantID]
	if !ok {
		return p, domain.ErrProfileMissing
	}
	return p, nil
}

func (f *fakeStore) UpsertProfile(_ context.Context, p domain.Profile) (domain.Profile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p.Version = f.profiles[p.TenantID].Version + 1
	f.profiles[p.TenantID] = p
	return p, nil
}

func (f *fakeStore) GetFolioStatus(_ context.Context, tenantID, _ string) (store.FolioStatus, error) {
	if _, ok := f.profiles[tenantID]; !ok {
		return store.FolioStatus{}, domain.ErrProfileMissing
	}
	return store.FolioStatus{Next: 1, Remaining: -1}, nil
}

func (f *fakeStore) UpsertTaxpayer(_ context.Context, t domain.Taxpayer) (domain.Taxpayer, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.taxpayers[t.TenantID+"/"+t.TaxID] = t
	return t, nil
}

func (f *fakeStore) SearchTaxpayers(_ context.Context, tenantID, query string, limit int, _ string) ([]domain.Taxpayer, string, error) {
	var out []domain.Taxpayer
	for _, t := range f.taxpayers {
		if t.TenantID == tenantID && strings.HasPrefix(strings.ToLower(t.LegalName), strings.ToLower(query)) {
			out = append(out, t)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LegalName < out[j].LegalName })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, "", nil
}

type fakeIdentity struct {
	legal    client.TenantLegal
	err      error
	reason   string // motivo de ConsumeStepUp ("" = válido)
	consumed []string
}

func (f *fakeIdentity) TenantLegal(context.Context, string, string) (client.TenantLegal, error) {
	return f.legal, f.err
}

func (f *fakeIdentity) ConsumeStepUp(_ context.Context, _, token, userID, operation string) (string, error) {
	f.consumed = append(f.consumed, token+"|"+userID+"|"+operation)
	return f.reason, nil
}

type fakeSecrets struct{ puts map[string][]byte }

func (f *fakeSecrets) PutSecret(_ context.Context, _, name string, value []byte, _ string) (string, error) {
	f.puts[name] = value
	return "1", nil
}

type fixture struct {
	svc      *Service
	store    *fakeStore
	identity *fakeIdentity
	secrets  *fakeSecrets
}

func newFixture() *fixture {
	f := &fixture{store: newFakeStore(), secrets: &fakeSecrets{puts: map[string][]byte{}},
		identity: &fakeIdentity{legal: client.TenantLegal{LegalName: "Café La Esquina, S.A.", TaxID: "2588017-1-831938", DV: "20"}}}
	n := 0
	f.svc = New(f.store, f.identity, f.secrets, func() time.Time { return time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC) },
		func() string { n++; return "01900000-0000-7000-8000-0000000000" + string(rune('c'+n%20)) + "0" })
	return f
}

func as(perms, stepUp string) context.Context {
	md := metadata.Pairs("x-pp-tenant-id", tenantA, "x-pp-user-id", userA, "x-pp-permissions", perms, "x-pp-actor-service", "api-gateway")
	if stepUp != "" {
		md.Append("x-pp-step-up", stepUp)
	}
	return metadata.NewIncomingContext(context.Background(), md)
}

func demoInput() ConfigureInput {
	return ConfigureInput{Environment: domain.EnvDemo, CheckoutPreference: domain.PrefAlwaysFiscal, IdempotencyKey: keyA}
}

// R9 y SPEC §4: el perfil DEMO usa el simulador; RUC, DV y razón social salen de identity; el step-up
// se consume con la operación del catálogo y las credenciales van a security (aquí solo el nombre).
func TestR9_ConfigureDemoProfile(t *testing.T) {
	f := newFixture()
	in := demoInput()
	in.PACCredentials = []byte(`{"token":"secreto-del-pac"}`)
	p, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), in)
	if err != nil {
		t.Fatal(err)
	}
	if p.RUC != "2588017-1-831938" || p.DV != "20" || p.LegalName != "Café La Esquina, S.A." || p.PACProvider != domain.ProviderSimulator ||
		p.BranchCode != "0000" || p.PointOfSaleCode != "001" {
		t.Fatalf("perfil: %+v", p)
	}
	if len(f.identity.consumed) != 1 || f.identity.consumed[0] != "tok-1|"+userA+"|"+StepUpOperation {
		t.Fatalf("step-up consumido: %v", f.identity.consumed)
	}
	name := "fiscal/" + tenantA + "/pac"
	if string(f.secrets.puts[name]) != `{"token":"secreto-del-pac"}` || p.PACCredentialsSecret != name {
		t.Fatalf("credenciales a security, solo el nombre en el perfil: %v %q", f.secrets.puts, p.PACCredentialsSecret)
	}
	if strings.Contains(p.PACCredentialsSecret, "secreto") {
		t.Fatal("el valor de la credencial nunca se guarda en el perfil")
	}
}

// grpc-conventions §3: reintentar con la misma clave devuelve el perfil sin consumir otro step-up.
func TestR9_ConfigureRetryDoesNotConsumeAgain(t *testing.T) {
	f := newFixture()
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), demoInput()); err != nil {
		t.Fatal(err)
	}
	p, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), demoInput())
	if err != nil || p.Version != 1 || len(f.identity.consumed) != 1 {
		t.Fatalf("reintento: %v %+v consumos=%d", err, p, len(f.identity.consumed))
	}
}

// El formato se valida antes del step-up: un error de datos no gasta la confirmación.
func TestN_FMT_06_InvalidLegalDataDoesNotConsumeStepUp(t *testing.T) {
	f := newFixture()
	f.identity.legal.DV = "2"
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), demoInput()); !errors.Is(err, domain.ErrInvalidRUC) {
		t.Fatalf("DV inválido en el alta: %v", err)
	}
	if len(f.identity.consumed) != 0 {
		t.Fatal("no debe consumir el step-up")
	}
}

func TestADR0020_ConfigureRequiresValidStepUp(t *testing.T) {
	f := newFixture()
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, ""), demoInput()); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("sin token: %v", err)
	}
	f.identity.reason = "ALREADY_USED"
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-viejo"), demoInput()); !errors.Is(err, domain.ErrStepUpInvalid) {
		t.Fatalf("token usado: %v", err)
	}
	if _, err := f.store.GetProfile(context.Background(), tenantA); !errors.Is(err, domain.ErrProfileMissing) {
		t.Fatal("sin step-up válido no se guarda nada")
	}
}

// R9: producción exige un PAC real (Q-11).
func TestR9_ProdIsNotAvailableYet(t *testing.T) {
	f := newFixture()
	in := demoInput()
	in.Environment = domain.EnvProd
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), in); !errors.Is(err, domain.ErrPacNotConfigured) {
		t.Fatalf("PROD: %v", err)
	}
}

func TestSPEC4_ConfigurePermissions(t *testing.T) {
	f := newFixture()
	if _, err := f.svc.ConfigureProfile(as(PermIssue, "tok-1"), demoInput()); !errors.Is(err, domain.ErrPermissionDenied) {
		t.Fatalf("sin fiscal:profile:manage: %v", err)
	}
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-tenant-id", tenantA, "x-pp-actor-service", "pos"))
	if _, err := f.svc.ConfigureProfile(ctx, demoInput()); !errors.Is(err, domain.ErrPermissionDenied) {
		t.Fatalf("un servicio no configura el perfil: %v", err)
	}
	noTenant := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-user-id", userA, "x-pp-permissions", PermProfileManage))
	if _, err := f.svc.ConfigureProfile(noTenant, demoInput()); !errors.Is(err, domain.ErrNoTenant) {
		t.Fatalf("sin negocio: %v", err)
	}
}

// domain-model §8.8 a través del servicio: sin perfil, PROFILE_MISSING; pos puede consultar.
func TestN_FIS_04_EvaluatePolicy(t *testing.T) {
	f := newFixture()
	pos := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-tenant-id", tenantA, "x-pp-actor-service", "pos"))
	if _, err := f.svc.EvaluatePolicy(pos, 1000, false, false); !errors.Is(err, domain.ErrProfileMissing) {
		t.Fatalf("sin perfil: %v", err)
	}
	if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), demoInput()); err != nil {
		t.Fatal(err)
	}
	d, err := f.svc.EvaluatePolicy(pos, 1000, false, false)
	if err != nil || d.DocType != domain.DocFiscalInvoice {
		t.Fatalf("ALWAYS_FISCAL: %v %+v", err, d)
	}
}

// N-FIS-07: los contribuyentes se validan y quedan bajo el tenant del token.
func TestN_FIS_07_UpsertAndSearchTaxpayers(t *testing.T) {
	f := newFixture()
	ctx := as(PermIssue, "")
	tp, err := f.svc.UpsertTaxpayer(ctx, domain.Taxpayer{TaxIDType: "ruc_juridico", TaxID: " 2588017-1-831938 ", CheckDigit: "20", LegalName: "Distribuidora, S.A.", Email: "Compras@Example.com"})
	if err != nil || tp.TenantID != tenantA || tp.TaxIDType != domain.TaxIDRUCJuridico || tp.Email != "compras@example.com" {
		t.Fatalf("upsert: %v %+v", err, tp)
	}
	if _, err := f.svc.UpsertTaxpayer(ctx, domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", LegalName: "Sin DV"}); !errors.Is(err, domain.ErrInvalidRUC) {
		t.Fatalf("sin DV: %v", err)
	}
	list, _, err := f.svc.SearchTaxpayers(as(PermRead, ""), "dist", 10, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("búsqueda: %v %+v", err, list)
	}
	if _, _, err := f.svc.SearchTaxpayers(as(PermRead, ""), "x", 500, ""); !errors.Is(err, domain.ErrInvalidRequest) {
		t.Fatalf("página demasiado grande: %v", err)
	}
}
