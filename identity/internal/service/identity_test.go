package service_test

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// fakeStore implementa store.UserStore en memoria para las pruebas del servicio
// (sin base de datos): verifica las reglas del caso de uso.
type fakeStore struct {
	users map[string]*domain.User // por email normalizado
	byID  map[string]*domain.User
	fail  error
}

func newFakeStore() *fakeStore {
	return &fakeStore{users: map[string]*domain.User{}, byID: map[string]*domain.User{}}
}

func (f *fakeStore) Create(_ context.Context, u *domain.User) error {
	if f.fail != nil {
		return f.fail
	}
	if _, ok := f.users[domain.NormalizeEmail(u.Email)]; ok {
		return domain.ErrEmailTaken
	}
	f.users[domain.NormalizeEmail(u.Email)] = u
	f.byID[u.ID] = u
	return nil
}

func (f *fakeStore) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	u, ok := f.users[domain.NormalizeEmail(email)]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	return u, nil
}

func (f *fakeStore) FindByID(_ context.Context, id string) (*domain.User, error) {
	u, ok := f.byID[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	return u, nil
}

func newService(fs *fakeStore) (*service.IdentityService, *auth.TokenIssuer) {
	tokens, err := auth.NewTokenIssuer("secreto-de-prueba-32-caracteres-ok", "otro-secreto-distinto-32-caracteres")
	if err != nil {
		panic(err)
	}
	return service.New(fs, tokens, nil, nil).WithClock(func() time.Time {
		return time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	}), tokens
}

func consentsOK() []service.ConsentGrant {
	return []service.ConsentGrant{
		{Purpose: service.PurposeAgeConfirmation, TextVersion: "2026-10-14", Granted: true},
		{Purpose: service.PurposeTerms, TextVersion: "2026-10-14", Granted: true, Channel: "web", Device: "desktop"},
		{Purpose: service.PurposePrivacy, TextVersion: "2026-10-14", Granted: true},
		{Purpose: service.PurposeMarketing, TextVersion: "2026-10-14", Granted: false},
	}
}

// R18: sin la confirmacion de mayoria de edad no se crea la cuenta.
func TestR18_Register_RequiresAgeConfirmation(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	grants := consentsOK()
	grants[0].Granted = false

	res, err := svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: grants, Now: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if res.Success || res.Reason != "AGE_REQUIREMENT" {
		t.Fatalf("se esperaba AGE_REQUIREMENT, llego %+v", res)
	}
	if len(fs.users) != 0 {
		t.Fatal("no deberia haberse creado ningun usuario")
	}
}

// R18/N-DAT-02: sin terminos o sin privacidad se rechaza con CONSENT_REQUIRED.
func TestR18_Register_RequiresTermsAndPrivacy(t *testing.T) {
	for _, quitar := range []string{service.PurposeTerms, service.PurposePrivacy} {
		fs := newFakeStore()
		svc, _ := newService(fs)
		grants := []service.ConsentGrant{}
		for _, g := range consentsOK() {
			if g.Purpose != quitar {
				grants = append(grants, g)
			}
		}
		res, _ := svc.Register(context.Background(), service.RegisterInput{
			Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
			Role: "CUSTOMER", Consents: grants, Now: time.Now().UTC(),
		})
		if res.Success || res.Reason != "CONSENT_REQUIRED" {
			t.Fatalf("sin %s se esperaba CONSENT_REQUIRED, llego %+v", quitar, res)
		}
		if len(fs.users) != 0 {
			t.Fatalf("sin %s no deberia crearse usuario", quitar)
		}
	}
}

// R18: una aceptacion sin la version del texto que la persona vio no es trazable.
func TestR18_ConsentWithoutTextVersionDoesNotCount(t *testing.T) {
	records, _ := service.ValidateConsents([]service.ConsentGrant{
		{Purpose: service.PurposeAgeConfirmation, Granted: true, TextVersion: ""},
	}, time.Now().UTC())
	_ = records
	fs := newFakeStore()
	svc, _ := newService(fs)
	grants := consentsOK()
	grants[1].TextVersion = "" // TERMS sin version

	res, _ := svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: grants, Now: time.Now().UTC(),
	})
	if res.Success || res.Reason != "CONSENT_REQUIRED" {
		t.Fatalf("TERMS sin version deberia rechazarse, llego %+v", res)
	}
}

// R18: con las obligatorias quedan registrados los cuatro registros (MARKETING
// tambien, conste lo que haya respondido la persona).
func TestR18_Register_RecordsAllConsents(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	ts := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

	res, err := svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: ts,
	})
	if err != nil || !res.Success {
		t.Fatalf("registro valido fallido: res=%+v err=%v", res, err)
	}
	u := fs.byID[res.UserID]
	if len(u.Consents) != 4 {
		t.Fatalf("se esperaban 4 consentimientos, llegaron %d", len(u.Consents))
	}
	for _, c := range u.Consents {
		if !c.RecordedAt.Equal(ts) {
			t.Fatalf("consentimiento %s con fecha %v, se esperaba %v (reloj inyectado)", c.Purpose, c.RecordedAt, ts)
		}
		if c.TextVersion == "" {
			t.Fatalf("consentimiento %s sin version del texto", c.Purpose)
		}
	}
}

// R6: el registro publico siempre devuelve el rol pedido tal cual (el gateway
// lo fuerza a CUSTOMER; identity valida si la llamada viene del gateway).
func TestR6_Register_CustomerRole(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	res, _ := svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: time.Now().UTC(),
	})
	if !res.Success || res.Role != "CUSTOMER" {
		t.Fatalf("se esperaba exito con rol CUSTOMER, llego %+v", res)
	}
	if res.AccessToken == "" || res.RefreshToken == "" {
		t.Fatal("el registro debe emitir ambos tokens")
	}
}

// R3: correo duplicado -> EMAIL_TAKEN.
func TestR3_Register_DuplicateEmail(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	in := service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: time.Now().UTC(),
	}
	if res, _ := svc.Register(context.Background(), in); !res.Success {
		t.Fatalf("primer registro fallido: %+v", res)
	}
	res, _ := svc.Register(context.Background(), in)
	if res.Success || res.Reason != "EMAIL_TAKEN" {
		t.Fatalf("segundo registro deveria ser EMAIL_TAKEN, llego %+v", res)
	}
}

// R4: login con credenciales invalidas devuelve INVALID_CREDENTIALS (el mismo
// error exista o no el correo).
func TestR4_Login_InvalidCredentials(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: time.Now().UTC(),
	})

	res, _ := svc.Login(context.Background(), "ana@example.com", "contrasena-incorrecta")
	if res.Success || res.Reason != "INVALID_CREDENTIALS" {
		t.Fatalf("password incorrecta: se esperaba INVALID_CREDENTIALS, llego %+v", res)
	}
	res, _ = svc.Login(context.Background(), "no-existe@example.com", "una-clave-muy-larga")
	if res.Success || res.Reason != "INVALID_CREDENTIALS" {
		t.Fatalf("correo inexistente: se esperaba el MISMO INVALID_CREDENTIALS, llego %+v", res)
	}
}

// R1/R2 en el servicio: correo invalido y contrasena corta se rechazan antes de tocar el store.
func TestR1R2_Register_ValidatesInput(t *testing.T) {
	fs := newFakeStore()
	svc, _ := newService(fs)
	res, _ := svc.Register(context.Background(), service.RegisterInput{
		Email: "no-es-un-correo", Password: "una-clave-muy-larga", Role: "CUSTOMER",
		Consents: consentsOK(), Now: time.Now().UTC(),
	})
	if res.Success || res.Reason != "INVALID_EMAIL" {
		t.Fatalf("correo invalido: llego %+v", res)
	}
	res, _ = svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "corta", Role: "CUSTOMER",
		Consents: consentsOK(), Now: time.Now().UTC(),
	})
	if res.Success || res.Reason != "WEAK_PASSWORD" {
		t.Fatalf("contrasena corta: llego %+v", res)
	}
	if len(fs.users) != 0 {
		t.Fatal("ni el correo invalido ni la contrasena corta deberian crear usuario")
	}
}

// Un fallo del store que no es EMAIL_TAKEN no filtra el detalle al cliente
// (AGENTS.md §15): responde resultado fallido generico y el error queda en el
// reporter (nil en esta prueba).
func TestRegister_StoreErrorDoesNotLeakDetail(t *testing.T) {
	fs := newFakeStore()
	fs.fail = errors.New("boom: detalle interno")
	svc, _ := newService(fs)
	res, err := svc.Register(context.Background(), service.RegisterInput{
		Email: "ana@example.com", Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("el servicio no debe propagar el error interno como gRPC error: %v", err)
	}
	if res == nil || res.Success || res.ErrorMessage != "error interno" {
		t.Fatalf("se esperaba fallo generico sin detalle, llego %+v", res)
	}
}

// R22: un BUSINESS_STAFF con rol personalizado asignado resuelve sus permisos + base de CUSTOMER.
func TestR22_AssignedCustomRoleResolves(t *testing.T) {
	fs := newFakeStore()
	rs := newFakeRoleStore()
	tokens, _ := auth.NewTokenIssuer("secreto-de-prueba-32-caracteres-ok", "otro-secreto-distinto-32-caracteres")
	svc := service.New(fs, tokens, nil, nil).WithRoles(rs)

	staffUser := &domain.User{
		ID:       "staff-1",
		Email:    "staff@example.com",
		Role:     "BUSINESS_STAFF",
		TenantID: "tenant-1",
	}
	fs.byID[staffUser.ID] = staffUser

	customRole := &domain.Role{
		ID:          "role-custom-1",
		TenantID:    "tenant-1",
		Name:        "mesero",
		Permissions: []string{"pos:sell", "orders:read"},
	}
	rs.roles[customRole.ID] = customRole
	rs.userRoles[staffUser.ID] = customRole.ID

	perms, err := svc.PermissionsForUser(context.Background(), staffUser.ID)
	if err != nil {
		t.Fatalf("PermissionsForUser: %v", err)
	}

	if perms.Role != "BUSINESS_STAFF" {
		t.Fatalf("se esperaba BUSINESS_STAFF, llego %s", perms.Role)
	}

	permMap := map[string]bool{}
	for _, p := range perms.Permissions {
		permMap[p] = true
	}
	if !permMap["pos:sell"] || !permMap["orders:read"] {
		t.Fatalf("no se incluyeron los permisos del rol custom: %v", perms.Permissions)
	}
	if !permMap["wallet:read"] || !permMap["orders:read:self"] {
		t.Fatalf("no se incluyeron los permisos base de CUSTOMER: %v", perms.Permissions)
	}
}

// R22: un BUSINESS_STAFF sin rol asignado recibe deny-by-default (solo base de CUSTOMER).
func TestR22_StaffWithoutRoleReceivesBaseOnly(t *testing.T) {
	fs := newFakeStore()
	rs := newFakeRoleStore()
	tokens, _ := auth.NewTokenIssuer("secreto-de-prueba-32-caracteres-ok", "otro-secreto-distinto-32-caracteres")
	svc := service.New(fs, tokens, nil, nil).WithRoles(rs)

	staffUser := &domain.User{
		ID:       "staff-2",
		Email:    "unassigned@example.com",
		Role:     "BUSINESS_STAFF",
		TenantID: "tenant-1",
	}
	fs.byID[staffUser.ID] = staffUser

	perms, err := svc.PermissionsForUser(context.Background(), staffUser.ID)
	if err != nil {
		t.Fatalf("PermissionsForUser: %v", err)
	}

	expectedBase := auth.CustomerPermissions()
	if !reflect.DeepEqual(perms.Permissions, expectedBase) {
		t.Fatalf("staff sin rol debe recibir solo permisos base: got %v, want %v", perms.Permissions, expectedBase)
	}
	expectedModules := auth.ModulesForPermissions(expectedBase)
	if !reflect.DeepEqual(perms.EnabledModules, expectedModules) {
		t.Fatalf("staff sin rol debe recibir solo modulos base: got %v, want %v", perms.EnabledModules, expectedModules)
	}
}

var _ store.UserStore = (*fakeStore)(nil)

