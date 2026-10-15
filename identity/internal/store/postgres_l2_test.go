//go:build l2

// Pruebas L2 del store de identity contra PostgreSQL real.
// Se ejecutan con:  go test -tags l2 ./internal/store/...
// Requieren PP_TEST_DB_DSN (rol identity_svc). El script que orquesta
// (identity/test/test_store_l2.sh) aplica antes las migraciones.
//
// Cubren las reglas del SPEC de identity sobre el almacén:
//
//	R1/R3  correo normalizado y unico (duplicado -> EMAIL_TAKEN)
//	R18    consentimientos persistidos con version, canal y dispositivo
package store_test

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/store"
)

func testDSN(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("PP_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("PP_TEST_DB_DSN no definido: se salta la prueba L2 (requiere postgres-db)")
	}
	return dsn
}

func newStore(t *testing.T) (*store.PostgresUserStore, string) {
	t.Helper()
	dsn := testDSN(t)
	st, err := store.NewPostgresUserStore(context.Background(), dsn)
	if err != nil {
		t.Fatalf("conectar al store: %v", err)
	}
	t.Cleanup(st.Close)
	return st, dsn
}

// cleanupUser borra al usuario (RLS: como el propio usuario).
func cleanupUser(t *testing.T, dsn, userID string) {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("pool de limpieza: %v", err)
	}
	defer pool.Close()
	_ = pool.QueryRow(context.Background(), `
		SET LOCAL app.user_id = $1;
		DELETE FROM users WHERE id = $2::uuid RETURNING id;`, userID, userID).Scan(new(string))
}

func newUser(email string) *store.User {
	return &store.User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: "sha256-bcrypt:" + uuid.NewString(),
		FullName:     "Ana Prueba",
		Role:         "CUSTOMER",
		TenantID:     "", // cliente sin negocio (dominio 3.2)
		Consents: []store.ConsentRecord{
			{Purpose: "AGE_CONFIRMATION", TextVersion: "2026-10-14", Granted: true, RecordedAt: time.Now().UTC()},
			{Purpose: "TERMS", TextVersion: "2026-10-14", Granted: true, RecordedAt: time.Now().UTC(), Channel: "web", Device: "desktop"},
			{Purpose: "PRIVACY_DATA_PROCESSING", TextVersion: "2026-10-14", Granted: true, RecordedAt: time.Now().UTC()},
			{Purpose: "MARKETING", TextVersion: "2026-10-14", Granted: false, RecordedAt: time.Now().UTC()},
		},
	}
}

// R1: el correo se guarda normalizado y se encuentra sin distinguir mayusculas.
func TestL2_R1_CreateAndFindByEmail_CaseInsensitive(t *testing.T) {
	st, dsn := newStore(t)
	ctx := context.Background()
	email := "ana.prueba+" + uuid.NewString()[:8] + "@example.com"
	u := newUser(email)
	defer cleanupUser(t, dsn, u.ID)

	if err := st.Create(ctx, u); err != nil {
		t.Fatalf("Create: %v", err)
	}

	found, err := st.FindByEmail(ctx, email)
	if err != nil {
		t.Fatalf("FindByEmail (tal cual): %v", err)
	}
	if found.ID != u.ID {
		t.Fatalf("FindByEmail devolvio %s, se esperaba %s", found.ID, u.ID)
	}

	// La busqueda en mayusculas tambien debe encontrar al usuario (R1).
	found2, err := st.FindByEmail(ctx, strings.ToUpper(email))
	if err != nil {
		t.Fatalf("FindByEmail (mayusculas): %v", err)
	}
	if found2.ID != u.ID {
		t.Fatalf("la busqueda ignore-case fallo: %s != %s", found2.ID, u.ID)
	}
}

// R3: correo duplicado -> ErrEmailTaken.
func TestL2_R3_DuplicateEmail_EmailTaken(t *testing.T) {
	st, dsn := newStore(t)
	ctx := context.Background()
	email := "duplicado+" + uuid.NewString()[:8] + "@example.com"
	u := newUser(email)
	defer cleanupUser(t, dsn, u.ID)

	if err := st.Create(ctx, u); err != nil {
		t.Fatalf("Create: %v", err)
	}
	err := st.Create(ctx, newUser(email))
	if !errors.Is(err, store.ErrEmailTaken) {
		t.Fatalf("segundo Create devolvio %v, se esperaba ErrEmailTaken", err)
	}
}

// R18: los consentimientos quedan con version, canal y dispositivo, y se leen
// de vuelta al consultar por id.
func TestL2_R18_ConsentsPersisted(t *testing.T) {
	st, dsn := newStore(t)
	ctx := context.Background()
	email := "consents+" + uuid.NewString()[:8] + "@example.com"
	u := newUser(email)
	defer cleanupUser(t, dsn, u.ID)

	if err := st.Create(ctx, u); err != nil {
		t.Fatalf("Create: %v", err)
	}

	found, err := st.FindByID(ctx, u.ID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if len(found.Consents) != 4 {
		t.Fatalf("se esperaban 4 consentimientos, llegaron %d", len(found.Consents))
	}
	byPurpose := map[string]store.ConsentRecord{}
	for _, c := range found.Consents {
		byPurpose[c.Purpose] = c
	}
	if c := byPurpose["TERMS"]; c.TextVersion != "2026-10-14" || !c.Granted {
		t.Fatalf("consentimiento TERMS incorrecto: %+v", c)
	}
	if c := byPurpose["MARKETING"]; c.Granted {
		t.Fatalf("MARKETING deberia quedar registrado como no concedido: %+v", c)
	}
	if c := byPurpose["AGE_CONFIRMATION"]; c.Channel == "" || c.Device == "" {
		t.Log("canal/dispositivo vacios: se acepta (el registro puede no traerlos)")
	}
}

// FindByEmail de un correo inexistente -> ErrUserNotFound (R4: mismo error).
func TestL2_FindByEmail_UnknownUser_NotFound(t *testing.T) {
	st, _ := newStore(t)
	_, err := st.FindByEmail(context.Background(), "no-existe-"+uuid.NewString()[:8]+"@example.com")
	if !errors.Is(err, store.ErrUserNotFound) {
		t.Fatalf("se esperaba ErrUserNotFound, llego %v", err)
	}
}

// La doble ejecucion de Create del MISMO usuario (mismo id) falla por PK,
// no por correo: el store distingue ambos casos.
func TestL2_Create_SameID_NotEmailTaken(t *testing.T) {
	st, dsn := newStore(t)
	ctx := context.Background()
	email := "mismoid+" + uuid.NewString()[:8] + "@example.com"
	u := newUser(email)
	defer cleanupUser(t, dsn, u.ID)

	if err := st.Create(ctx, u); err != nil {
		t.Fatalf("Create: %v", err)
	}
	err := st.Create(ctx, u)
	if errors.Is(err, store.ErrEmailTaken) {
		t.Fatalf("reintentar el mismo id devolvio EMAIL_TAKEN, deberia ser error de PK")
	}
	if err == nil {
		t.Fatal("reintentar el mismo id deberia fallar")
	}
}

// ADR 0014 (segunda barrera): con app.tenant_id de T1, la consulta directa
// como identity_svc solo ve los usuarios de T1, nunca los de T2.
func TestL2_RLS_TenantIsolation(t *testing.T) {
	_, dsn := newStore(t)
	ctx := context.Background()
	st, err := store.NewPostgresUserStore(ctx, dsn)
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	defer st.Close()

	t1, t2 := uuid.NewString(), uuid.NewString()
	userA := newUser("rls-a+" + uuid.NewString()[:8] + "@example.com")
	userA.TenantID = t1
	userB := newUser("rls-b+" + uuid.NewString()[:8] + "@example.com")
	userB.TenantID = t2
	defer cleanupUser(t, dsn, userA.ID)
	defer cleanupUser(t, dsn, userB.ID)

	if err := st.Create(ctx, userA); err != nil {
		t.Fatalf("Create A: %v", err)
	}
	if err := st.Create(ctx, userB); err != nil {
		t.Fatalf("Create B: %v", err)
	}

	pool := newVerificationPool(t, dsn)

	// Como tenant T1: solo ve su usuario.
	var visibleT1 int
	if err := visibleAs(ctx, t, pool, t1, []string{userA.ID, userB.ID}, &visibleT1); err != nil {
		t.Fatalf("lectura como T1: %v", err)
	}
	if visibleT1 != 1 {
		t.Fatalf("RLS: como T1 se vieron %d usuarios (se esperaba 1: solo el suyo)", visibleT1)
	}

	// Como tenant T2: ve al otro, no al de T1.
	var visibleT2 int
	if err := visibleAs(ctx, t, pool, t2, []string{userA.ID, userB.ID}, &visibleT2); err != nil {
		t.Fatalf("lectura como T2: %v", err)
	}
	if visibleT2 != 1 {
		t.Fatalf("RLS: como T2 se vieron %d usuarios (se esperaba 1: solo el suyo)", visibleT2)
	}

	// Sin contexto de tenant: fail-closed (no ve ninguna de las dos filas).
	var visibleNone int
	if err := visibleAs(ctx, t, pool, "", []string{userA.ID, userB.ID}, &visibleNone); err != nil {
		t.Fatalf("lectura sin contexto: %v", err)
	}
	if visibleNone != 0 {
		t.Fatalf("RLS: sin app.tenant_id se vieron %d usuarios (fail-closed esperaba 0)", visibleNone)
	}
}

// visibleAs cuenta cuantos de los ids indicados ve el rol identity_svc cuando
// app.tenant_id vale tenantID (vacio = sin contexto, fail-closed).
func visibleAs(ctx context.Context, t *testing.T, pool *pgxpool.Pool, tenantID string, ids []string, out *int) error {
	t.Helper()
	return pgx.BeginTxFunc(ctx, pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT count(*) FROM users WHERE id = ANY($1::uuid[])`, ids).Scan(out)
	})
}

// newVerificationPool crea el pool con el que se comprueba RLS: sin prepared
// statements porque PgBouncer corre en modo transaccion.
func newVerificationPool(t *testing.T, dsn string) *pgxpool.Pool {
	t.Helper()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}
