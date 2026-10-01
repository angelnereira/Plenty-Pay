//go:build integration

// Tests de integración contra PostgreSQL REAL (mandato §20).
// Requieren: IDENTITY_TEST_DATABASE_URL + tag integration:
//
//	go test -tags integration ./...
//
// La BD de pruebas se RECREA (drop schema identity cascade) al inicio:
// es una BD desechable de dev/CI; jamás apuntar a producción.
package server_test

import (
	"context"
	"io"
	"log/slog"
	"net"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	commonv1 "plentypay.dev/contracts/gen/go/plentypay/common/v1"
	identityv1 "plentypay.dev/contracts/gen/go/plentypay/identity/v1"
	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/migrate"
	"plentypay.dev/services/identity/internal/server"
	"plentypay.dev/services/identity/internal/store"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("IDENTITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("IDENTITY_TEST_DATABASE_URL no definida: saltando integración (mandato §26: se verifica en CI/local con compose)")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("conexión: %v", err)
	}
	t.Cleanup(pool.Close)

	// BD desechable: recrear esquema limpio para aislamiento total del test.
	// La tabla de tracking de migraciones vive en public y debe resetearse
	// junto al esquema (solo en dev/test; producción nunca la borra).
	if _, err := pool.Exec(ctx, `drop schema if exists identity cascade`); err != nil {
		t.Fatalf("drop schema: %v", err)
	}
	if _, err := pool.Exec(ctx, `drop table if exists public.identity_migrations`); err != nil {
		t.Fatalf("drop tracking: %v", err)
	}
	applied, err := migrate.Up(ctx, pool)
	if err != nil {
		t.Fatalf("migraciones: %v", err)
	}
	if len(applied) == 0 {
		t.Log("migraciones: sin pendientes (idempotencia verificada)")
	}
	// Segunda pasada: idempotente (checksums válidos, cero re-aplicadas).
	again, err := migrate.Up(ctx, pool)
	if err != nil || len(again) != 0 {
		t.Fatalf("migraciones NO idempotentes: applied=%v err=%v", again, err)
	}
	return pool
}

func startServerPG(t *testing.T) (identityv1.IdentityServiceClient, *pgxpool.Pool, commonv1.HealthServiceClient) {
	t.Helper()
	pool := testPool(t)
	lis := bufconn.Listen(1024 * 1024)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := server.NewIdentity(server.Options{
		DB:       store.NewPostgresStore(pool),
		Sessions: store.NewPostgresSessions(pool, time.Minute),
		Auditor:  store.NewPostgresAuditor(pool, log),
		Hasher:   auth.NewTestingHasher(),
		Log:      log,
	})
	srv := grpc.NewServer(grpc.UnaryInterceptor(server.UnaryCorrelation(log)))
	identityv1.RegisterIdentityServiceServer(srv, svc)
	commonv1.RegisterHealthServiceServer(srv, svc)
	go func() { _ = srv.Serve(lis) }()

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("client: %v", err)
	}
	t.Cleanup(func() { srv.Stop(); _ = conn.Close() })
	return identityv1.NewIdentityServiceClient(conn), pool, commonv1.NewHealthServiceClient(conn)
}

func TestPG_FullFlowAndAuditTrail(t *testing.T) {
	client, pool, _ := startServerPG(t)
	ctx := context.Background()

	ten, err := client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "PG Cafe", OwnerEmail: "owner@pg.com", OwnerPassword: "s3creta",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}

	// Persistencia REAL: el tenant sobrevive en PostgreSQL (visible por SQL).
	var name string
	if err := pool.QueryRow(ctx, `select name from identity.tenants where id = $1`,
		ten.GetTenant().GetTenantId()).Scan(&name); err != nil || name != "PG Cafe" {
		t.Fatalf("tenant no persistido: %v (name=%q)", err, name)
	}

	authResp, err := client.AuthenticatePassword(ctx, &identityv1.AuthenticatePasswordRequest{
		Email: "owner@pg.com", Password: "s3creta",
	})
	if err != nil {
		t.Fatalf("AuthenticatePassword: %v", err)
	}
	tok := authResp.GetSession().GetToken()

	// Sesión durable: validarla POR SQL (hash guardado, no token en claro).
	var tokenHash string
	if err := pool.QueryRow(ctx,
		`select token_hash from identity.sessions where user_id = $1`,
		authResp.GetUser().GetUserId()).Scan(&tokenHash); err != nil {
		t.Fatalf("sesión no persistida: %v", err)
	}
	if tokenHash == tok || len(tokenHash) != 64 {
		t.Fatal("la BD debe guardar SOLO el SHA-256 del token, nunca el token")
	}

	val, err := client.ValidateSession(ctx, &identityv1.ValidateSessionRequest{Token: tok})
	if err != nil || !val.GetValid() {
		t.Fatalf("sesión persistida debe validar: %v", err)
	}

	// Auditoría append-only con eventos de login.
	var n int64
	if err := pool.QueryRow(ctx,
		`select count(*) from identity.audit_log where event = 'login_ok' and user_id = $1`,
		authResp.GetUser().GetUserId()).Scan(&n); err != nil || n < 1 {
		t.Fatalf("auditoría de login ausente: n=%d err=%v", n, err)
	}

	// Logout persistente: revoked=true en BD.
	if _, err := client.Logout(ctx, &identityv1.LogoutRequest{SessionToken: tok}); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	var revoked bool
	if err := pool.QueryRow(ctx,
		`select revoked from identity.sessions where token_hash = $1`,
		auth.TokenHash(tok)).Scan(&revoked); err != nil || !revoked {
		t.Fatalf("sesión no revocada en BD: %v (revoked=%v)", err, revoked)
	}
	val2, _ := client.ValidateSession(ctx, &identityv1.ValidateSessionRequest{Token: tok})
	if val2.GetValid() {
		t.Fatal("sesión revocada NO debe validar")
	}
}

func TestPG_DuplicateConstraintsFailSecure(t *testing.T) {
	client, _, _ := startServerPG(t)
	ctx := context.Background()

	if _, err := client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Dup", OwnerEmail: "dup@pg.com", OwnerPassword: "x",
	}); err != nil {
		t.Fatalf("primera: %v", err)
	}
	if _, err := client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "dup", OwnerEmail: "otro@pg.com", OwnerPassword: "x",
	}); status.Code(err) != codes.AlreadyExists {
		// lower(name) unique: el case-insensitive también colisiona.
		t.Fatalf("tenant duplicado (case-insensitive) debe fallar, got %v", err)
	}
	if _, err := client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Otro", OwnerEmail: "dup@pg.com", OwnerPassword: "x",
	}); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("email duplicado debe fallar, got %v", err)
	}
}

func TestPG_AuditTrailHasLoginFailures(t *testing.T) {
	client, pool, _ := startServerPG(t)
	ctx := context.Background()
	// Login fallido (usuario inexistente) — debe quedar en auditoría.
	_, err := client.AuthenticatePassword(ctx, &identityv1.AuthenticatePasswordRequest{
		Email: "ghost@pg.com", Password: "x",
	})
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("esperado Unauthenticated, got %v", err)
	}
	var n int64
	if err := pool.QueryRow(ctx,
		`select count(*) from identity.audit_log where event = 'login_failed'`).Scan(&n); err != nil || n < 1 {
		t.Fatalf("login_failed no auditado: n=%d err=%v", n, err)
	}
}
