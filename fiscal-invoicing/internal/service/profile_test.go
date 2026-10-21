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
	"plentypay/fiscal-invoicing/internal/pac"
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

type fakeSecrets struct {
	puts   map[string][]byte
	getErr error
}

func (f *fakeSecrets) PutSecret(_ context.Context, _, name string, value []byte, _ string) (string, error) {
	f.puts[name] = value
	return "1", nil
}

func (f *fakeSecrets) GetSecret(_ context.Context, _, name string) ([]byte, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	v, ok := f.puts[name]
	if !ok {
		return nil, client.ErrUnavailable
	}
	return v, nil
}

type fixture struct {
	svc      *Service
	pacs     *pac.Registry
	sim      *pac.Simulator
	store    *fakeStore
	identity *fakeIdentity
	secrets  *fakeSecrets
}

func newFixture() *fixture {
	f := &fixture{store: newFakeStore(), secrets: &fakeSecrets{puts: map[string][]byte{}},
		identity: &fakeIdentity{legal: client.TenantLegal{LegalName: "Café La Esquina, S.A.", TaxID: "2588017-1-831938", DV: "20"}}}
	n := 0
	f.sim = pac.NewSimulator()
	f.pacs = pac.NewRegistry(f.sim, pac.NewHKA(pac.HKAConfig{DemoEndpoint: "http://127.0.0.1:1"}))
	f.svc = New(f.store, f.identity, f.secrets, f.pacs, func() time.Time { return time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC) },
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

const hkaCreds = `{"token_empresa":"emp-secreto","token_password":"pass-secreto"}`

// R9 y SPEC §4: el perfil DEMO usa el simulador; RUC, DV y razón social salen de identity; el step-up
// se consume con la operación del catálogo. El simulador no usa credenciales: no se guardan.
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
	if len(f.secrets.puts) != 0 || p.PACCredentialsSecret != "" {
		t.Fatalf("el simulador no guarda credenciales: %v %q", f.secrets.puts, p.PACCredentialsSecret)
	}
}

// R10 + ADR 0022: con HKA, las credenciales van a security y el perfil guarda solo su nombre.
func TestR10_ConfigureHKAStoresCredentialsInSecurity(t *testing.T) {
	f := newFixture()
	in := demoInput()
	in.PACProvider = domain.ProviderHKA
	in.PACCredentials = []byte(hkaCreds)
	p, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), in)
	if err != nil {
		t.Fatal(err)
	}
	name := "fiscal/" + tenantA + "/pac"
	if string(f.secrets.puts[name]) != hkaCreds || p.PACCredentialsSecret != name || p.PACProvider != domain.ProviderHKA {
		t.Fatalf("credenciales a security, solo el nombre en el perfil: %v %+v", f.secrets.puts, p)
	}
	if strings.Contains(p.PACCredentialsSecret, "secreto") {
		t.Fatal("el valor de la credencial nunca se guarda en el perfil")
	}
	// Reconfigurar sin reenviar credenciales conserva las guardadas.
	in.PACCredentials, in.IdempotencyKey, in.PointOfSaleCode = nil, "configurar-perfil-0002", "002"
	p, err = f.svc.ConfigureProfile(as(PermProfileManage, "tok-2"), in)
	if err != nil || p.PACCredentialsSecret != name || p.PointOfSaleCode != "002" {
		t.Fatalf("reconfigurar: %v %+v", err, p)
	}
}

// R10: el PAC que pide credenciales no se configura sin ellas, y el error no gasta el step-up.
func TestR10_HKARequiresCredentialsBeforeStepUp(t *testing.T) {
	f := newFixture()
	for _, creds := range []string{"", `{"token_empresa":"x"}`, `no-es-json`, `{"token_empresa":"x","token_password":"y","otra":"z"}`} {
		in := demoInput()
		in.PACProvider = domain.ProviderHKA
		in.PACCredentials = []byte(creds)
		if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), in); !errors.Is(err, domain.ErrInvalidRequest) {
			t.Fatalf("credenciales %q: %v", creds, err)
		}
	}
	if len(f.identity.consumed) != 0 || len(f.secrets.puts) != 0 {
		t.Fatal("no debe consumir el step-up ni guardar nada")
	}
}

func TestR10_ListPacProviders(t *testing.T) {
	f := newFixture()
	list, err := f.svc.ListPacProviders(as(PermProfileManage, ""))
	if err != nil || len(list) != 2 || list[0].ID != domain.ProviderSimulator || list[1].ID != domain.ProviderHKA ||
		len(list[1].CredentialKeys) != 2 || len(list[1].Environments) != 1 {
		t.Fatalf("%v %+v", err, list)
	}
	if _, err := f.svc.ListPacProviders(as(PermIssue, "")); !errors.Is(err, domain.ErrPermissionDenied) {
		t.Fatalf("sin permiso: %v", err)
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

// R9: producción exige un PAC real habilitado con FISCAL_PROD_ENABLED (aquí apagado).
func TestR9_ProdIsNotAvailableYet(t *testing.T) {
	f := newFixture()
	for _, provider := range []string{"", domain.ProviderSimulator, domain.ProviderHKA} {
		in := demoInput()
		in.Environment, in.PACProvider, in.PACCredentials = domain.EnvProd, provider, []byte(hkaCreds)
		if _, err := f.svc.ConfigureProfile(as(PermProfileManage, "tok-1"), in); !errors.Is(err, domain.ErrPacNotConfigured) {
			t.Fatalf("PROD con %q: %v", provider, err)
		}
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
