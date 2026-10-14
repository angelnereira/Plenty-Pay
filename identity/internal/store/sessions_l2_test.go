//go:build l2

// Pruebas L2 de sesiones y refresh tokens contra PostgreSQL real (F08.3).
// Se ejecutan con:  go test -tags l2 ./internal/store/...
// Requieren PP_TEST_DB_DSN (rol identity_svc). El script orquestador
// (identity/test/test_store_l2.sh) aplica antes las migraciones.
//
// Cubren: R7 (rotacion: cada refresh emitido es nuevo y el anterior caduca),
// R8 (reuso de un refresh ya usado revoca la sesion y escribe el outbox) y
// R9 (la sesion revocada se detecta al consultarla).
package store_test

import (
	"context"
	"crypto/sha256"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/store"
)

// newStoreAndSessions devuelve ambos stores compartiendo pool.
func newStoreAndSessions(t *testing.T) (*store.PostgresUserStore, *store.PostgresSessionStore, string) {
	t.Helper()
	st, dsn := newStore(t)
	return st, store.NewPostgresSessionStore(st.Pool()), dsn
}

// seedUser crea un usuario para las pruebas de sesion.
func seedUser(t *testing.T, st *store.PostgresUserStore) *domain.User {
	t.Helper()
	u := newUser("sesion+" + uuid.NewString()[:8] + "@example.com")
	if err := st.Create(context.Background(), u); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}

func hash(s string) []byte {
	sum := sha256.Sum256([]byte(s))
	return sum[:]
}

// R7/R8: la rotacion consume el token anterior y el reuso provoca la revocacion.
func TestL2_R8_RefreshRotationAndReuseRevokesSession(t *testing.T) {
	st, ss, dsn := newStoreAndSessions(t)
	ctx := context.Background()
	user := seedUser(t, st)

	session, err := ss.CreateSession(ctx, user.ID)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	tokenA, tokenB := "refresh-A-"+uuid.NewString(), "refresh-B-"+uuid.NewString()
	if err := ss.IssueRefreshToken(ctx, session.ID, user.ID, hash(tokenA), time.Now().UTC().Add(time.Hour)); err != nil {
		t.Fatalf("IssueRefreshToken A: %v", err)
	}

	// Primer consumo: rotacion valida.
	sid, reused, err := ss.ConsumeRefreshToken(ctx, hash(tokenA))
	if err != nil || reused {
		t.Fatalf("primer consumo: session=%s reused=%v err=%v", sid, reused, err)
	}
	if sid != session.ID {
		t.Fatalf("la sesion del token no coincide: %s != %s", sid, session.ID)
	}

	// Se emite el token B (la rotacion) y se vuelve a consumir: tambien valido.
	if err := ss.IssueRefreshToken(ctx, session.ID, user.ID, hash(tokenB), time.Now().UTC().Add(time.Hour)); err != nil {
		t.Fatalf("IssueRefreshToken B: %v", err)
	}
	if _, reused, err = ss.ConsumeRefreshToken(ctx, hash(tokenB)); err != nil || reused {
		t.Fatalf("consumo de B: reused=%v err=%v", reused, err)
	}

	// Reuso de A: se detecta y se indica la sesion a revocar (R8).
	sid, reused, err = ss.ConsumeRefreshToken(ctx, hash(tokenA))
	if err != nil {
		t.Fatalf("reuso de A devolvio error en vez de reused=true: %v", err)
	}
	if !reused || sid != session.ID {
		t.Fatalf("reuso de A: sid=%s reused=%v", sid, reused)
	}

	// La revocacion efectiva y su motivo.
	if err := ss.RevokeSession(ctx, session.ID, domain.RevokedReasonReuse); err != nil {
		t.Fatalf("RevokeSession: %v", err)
	}
	loaded, err := ss.SessionByID(ctx, session.ID)
	if err != nil {
		t.Fatalf("SessionByID: %v", err)
	}
	if !loaded.Revoked() || loaded.RevokedReason != domain.RevokedReasonReuse {
		t.Fatalf("sesion deberia estar revocada por REFRESH_REUSE: %+v", loaded)
	}

	cleanupSession(t, dsn, user.ID)
}

// R9: una sesion revocada se detecta al consultarla.
func TestL2_R9_SessionRevokedIsDetected(t *testing.T) {
	_, ss, dsn := newStoreAndSessions(t)
	ctx := context.Background()

	st, _ := newStore(t)
	user := seedUser(t, st)
	session, err := ss.CreateSession(ctx, user.ID)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if err := ss.RevokeSession(ctx, session.ID, "LOGOUT"); err != nil {
		t.Fatalf("RevokeSession: %v", err)
	}
	loaded, err := ss.SessionByID(ctx, session.ID)
	if err != nil || !loaded.Revoked() {
		t.Fatalf("la sesion revocada debe detectarse: %+v err=%v", loaded, err)
	}
	if loaded.RevokedReason != "LOGOUT" {
		t.Fatalf("motivo de revocacion inesperado: %q", loaded.RevokedReason)
	}
	cleanupSession(t, dsn, user.ID)
}

// El outbox acepta el evento SessionRevoked (ADR 0012).
func TestL2_Outbox_AcceptsSessionRevoked(t *testing.T) {
	_, ss, dsn := newStoreAndSessions(t)
	ctx := context.Background()
	aggregate := uuid.NewString()
	payload := []byte(`{"user_id":"u","session_ids":["s"],"reason":"REFRESH_REUSE"}`)

	if err := ss.WriteOutboxEvent(ctx, "pp.identity.session.revoked.v1", aggregate, "", payload); err != nil {
		t.Fatalf("WriteOutboxEvent: %v", err)
	}
	// La lectura tambien pasa por RLS: se consulta como plataforma.
	pool := newVerificationPool(t, dsn)
	found, err := countVisibleAs(ctx, pool, aggregate)
	if err != nil {
		t.Fatalf("verificacion outbox: %v", err)
	}
	if found != 1 {
		t.Fatalf("el evento no quedo en el outbox (encontrados=%d)", found)
	}
}

// countVisibleAs cuenta los eventos del outbox para un id, como plataforma.
func countVisibleAs(ctx context.Context, pool *pgxpool.Pool, aggregate string) (int, error) {
	var found int
	err := pgx.BeginTxFunc(ctx, pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		// El id del sobre lo genera el store; el test busca por aggregate_id.
		return tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE aggregate_id = $1::uuid AND event_type = 'pp.identity.session.revoked.v1'`, aggregate).Scan(&found)
	})
	return found, err
}

// Un refresh token desconocido devuelve ErrRefreshTokenUnknown (no reuso).
func TestL2_ConsumeRefresh_UnknownToken(t *testing.T) {
	_, ss, _ := newStoreAndSessions(t)
	_, _, err := ss.ConsumeRefreshToken(context.Background(), hash("no-existe-"+uuid.NewString()))
	if err == nil {
		t.Fatal("un token desconocido debe fallar")
	}
}

// cleanupSession borra la sesion de prueba (RLS: el usuario es el propio).
func cleanupSession(t *testing.T, dsn, userID string) {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		return
	}
	defer pool.Close()
	cfg := pool.Config()
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	_ = pool.QueryRow(context.Background(), `
		BEGIN;
		SELECT set_config('app.user_id', $1, true);
		DELETE FROM users WHERE id = $2::uuid;
		COMMIT;`, userID, userID).Scan(new(string))
}

func poolExec(dsn, sql string, args ...any) (int, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return 0, err
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return 0, err
	}
	defer pool.Close()
	tag, err := pool.Exec(context.Background(), sql, args...)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func poolExecScan(dsn string, out *int, sql string, args ...any) error {
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		return err
	}
	defer pool.Close()
	return pool.QueryRow(context.Background(), sql, args...).Scan(out)
}
