//go:build l2

// Pruebas L2 de recuperacion y cambio de contrasena contra PostgreSQL real
// (F08.7). Criterio del paso: R16 (cambiar la contrasena o hacer reset revoca
// las sesiones).
package store_test

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/store"
)

// R16: cambiar la contrasena conserva la sesion indicada y revoca las demas.
func TestL2_R16_ChangePasswordRevokesOtherSessions(t *testing.T) {
	st, _, dsn := newStoreAndSessions(t)
	ps := store.NewPostgresPasswordStore(st.Pool())
	ctx := context.Background()

	user := newUser("cambio-" + randSuffix() + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	// Dos sesiones: la actual y otra que debe caerse.
	current := openSession(t, dsn, user.ID)
	other := openSession(t, dsn, user.ID)

	newHash, _ := auth.HashPassword("clave-nueva-muy-larga")
	if err := ps.ChangePassword(ctx, user.ID, newHash, current); err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}

	if !sessionRevoked(t, dsn, other) {
		t.Fatal("la otra sesion deberia quedar revocada (R16)")
	}
	if sessionRevoked(t, dsn, current) {
		t.Fatal("la sesion actual deberia conservarse en un cambio voluntario")
	}

	// La marca de cambio permite invalidar tokens emitidos antes (R16).
	at, err := ps.PasswordChangedAt(ctx, user.ID)
	if err != nil || at == nil {
		t.Fatalf("PasswordChangedAt deberia quedar fijada: %v %v", at, err)
	}
}

// R16: el reset revoca TODAS las sesiones (no hay sesion que conservar).
func TestL2_R16_ResetRevokesAllSessions(t *testing.T) {
	st, _, dsn := newStoreAndSessions(t)
	ps := store.NewPostgresPasswordStore(st.Pool())
	ctx := context.Background()

	user := newUser("reset-" + randSuffix() + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	s1 := openSession(t, dsn, user.ID)
	s2 := openSession(t, dsn, user.ID)

	token, expiresAt, err := ps.CreatePasswordReset(ctx, user.ID)
	if err != nil {
		t.Fatalf("CreatePasswordReset: %v", err)
	}
	if d := time.Until(expiresAt); d < 29*time.Minute || d > 31*time.Minute {
		t.Fatalf("el token deberia vencer en 30 min, vencia en %v", d)
	}

	// El token se guarda hasheado.
	if !tokenHashed(t, dsn, token) {
		t.Fatal("el token de reset no deberia guardarse en claro")
	}

	// Canje: devuelve el usuario correcto.
	got, err := ps.ConsumePasswordReset(ctx, token)
	if err != nil {
		t.Fatalf("ConsumePasswordReset: %v", err)
	}
	if got != user.ID {
		t.Fatalf("usuario del token: %s, se esperaba %s", got, user.ID)
	}
	// Token de un solo uso.
	if _, err := ps.ConsumePasswordReset(ctx, token); err == nil {
		t.Fatal("el token no deberia poder reusarse")
	}

	// Reset: revoca TODAS las sesiones.
	newHash, _ := auth.HashPassword("clave-reset-muy-larga")
	if err := ps.ChangePassword(ctx, user.ID, newHash, ""); err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}
	for _, s := range []string{s1, s2} {
		if !sessionRevoked(t, dsn, s) {
			t.Fatalf("la sesion %s deberia estar revocada tras el reset", s)
		}
	}
}

// Un token vencido (30 min) se rechaza y uno desconocido tambien.
func TestL2_R16_ResetTokenExpired(t *testing.T) {
	st, _, dsn := newStoreAndSessions(t)
	ps := store.NewPostgresPasswordStore(st.Pool())
	ctx := context.Background()

	user := newUser("vencido-" + randSuffix() + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	token, _, err := ps.CreatePasswordReset(ctx, user.ID)
	if err != nil {
		t.Fatalf("CreatePasswordReset: %v", err)
	}
	// Se hace vecer el token (31 min atras).
	if _, err := poolExecAs(dsn, `UPDATE password_resets SET expires_at = now() - interval '31 minutes'`); err != nil {
		t.Fatalf("forzar vencimiento: %v", err)
	}
	if _, err := ps.ConsumePasswordReset(ctx, token); err == nil {
		t.Fatal("un token vencido deberia rechazarse")
	}
	// Token desconocido.
	if _, err := ps.ConsumePasswordReset(ctx, "token-inventado"); err == nil {
		t.Fatal("un token desconocido deberia rechazarse")
	}
	// Y no deberia haberse consumido: sigue pendiente pero vencido.
	if _, err := poolExecAs(dsn, `UPDATE password_resets SET expires_at = now() + interval '5 minutes'`); err != nil {
		t.Fatalf("reactivar: %v", err)
	}
	if _, err := ps.ConsumePasswordReset(ctx, token); err != nil {
		t.Fatalf("un token no usado deberia poder canjearse: %v", err)
	}
}

// Helpers del test.

func openSession(t *testing.T, dsn, userID string) string {
	t.Helper()
	session := uuid.NewString()
	if _, err := poolExecAs(dsn, `
		INSERT INTO sessions (id, user_id, created_at) VALUES ($1::uuid, $2::uuid, now())`, session, userID); err != nil {
		t.Fatalf("openSession: %v", err)
	}
	return session
}

// poolExecAs ejecuta como plataforma (para preparar estado en las pruebas).
func poolExecAs(dsn, sql string, args ...any) (int, error) {
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
	var affected int
	errTx := pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		tag, err := tx.Exec(context.Background(), sql, args...)
		if err != nil {
			return err
		}
		affected = int(tag.RowsAffected())
		return nil
	})
	return affected, errTx
}

func sessionRevoked(t *testing.T, dsn, sessionID string) bool {
	t.Helper()
	pool := newVerificationPool(t, dsn)
	var revoked bool
	err := pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), `SELECT revoked_at IS NOT NULL FROM sessions WHERE id = $1::uuid`, sessionID).Scan(&revoked)
	})
	if err != nil {
		t.Fatalf("sessionRevoked: %v", err)
	}
	return revoked
}

func tokenHashed(t *testing.T, dsn, token string) bool {
	t.Helper()
	pool := newVerificationPool(t, dsn)
	var stored []byte
	err := pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), `SELECT token_hash FROM password_resets ORDER BY created_at DESC LIMIT 1`).Scan(&stored)
	})
	if err != nil {
		t.Fatalf("tokenHashed: %v", err)
	}
	return string(stored) != token && len(stored) > 0
}
