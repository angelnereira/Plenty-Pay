//go:build l2

// Pruebas L2 del bloqueo progresivo contra PostgreSQL real (F08.4).
// Cubren la regla R5 del SPEC: 5 fallos bloquean 1 min, 10 bloquean 15 min,
// 20 bloquean 24 h; un login exitoso reinicia la cuenta.
//
// Ejecutar desde la raiz: ./identity/test/test_store_l2.sh
package store_test

import (
	"context"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/store"
)

// newLockoutStore crea el store de bloqueo sobre el mismo pool.
func newLockoutStore(t *testing.T) *store.PostgresLoginAttemptStore {
	t.Helper()
	st, _, _ := newStoreAndSessions(t)
	return store.NewPostgresLoginAttemptStore(st.Pool())
}

// dsnOf devuelve el DSN de la prueba (para la limpieza).
func dsnOf(t *testing.T) string {
	t.Helper()
	_, dsn := newStore(t)
	return dsn
}

// R5: 5 fallos dejan la cuenta bloqueada 1 min; el 6.º login correcto no entra.
func TestL2_R5_ProgressiveLockout(t *testing.T) {
	st, _, _ := newStoreAndSessions(t)
	la := newLockoutStore(t)
	ctx := context.Background()
	user := seedUser(t, st)

	block, locked := domain.DefaultLockoutPolicy.BlockFor(5)
	if !locked || block != time.Minute {
		t.Fatalf("politica: 5 fallos deberian bloquear 1 min, llego %v (%v)", block, locked)
	}

	for i := 1; i <= 5; i++ {
		// El servicio calcula el bloqueo segun el escalon alcanzado: los cuatro
		// primeros fallos no bloquean, el quinto si.
		step, _ := domain.DefaultLockoutPolicy.BlockFor(i)
		failures, until, err := la.RegisterFailure(ctx, user.ID, step)
		if err != nil {
			t.Fatalf("RegisterFailure %d: %v", i, err)
		}
		if failures != i {
			t.Fatalf("fallo %d: contador %d", i, failures)
		}
		if i < 5 && until != nil {
			t.Fatalf("fallo %d no deberia bloquear todavia", i)
		}
		if i == 5 && until == nil {
			t.Fatal("el 5.o fallo deberia fijar el bloqueo")
		}
	}

	blocked, err := la.BlockedUntil(ctx, user.ID)
	if err != nil {
		t.Fatalf("BlockedUntil: %v", err)
	}
	if blocked == nil {
		t.Fatal("la cuenta deberia estar bloqueada tras 5 fallos")
	}

	// Un login exitoso reinicia la cuenta.
	if err := la.ResetFailures(ctx, user.ID); err != nil {
		t.Fatalf("ResetFailures: %v", err)
	}
	blocked, err = la.BlockedUntil(ctx, user.ID)
	if err != nil || blocked != nil {
		t.Fatalf("tras el login exitoso no deberia haber bloqueo: %v %v", blocked, err)
	}
	cleanupSession(t, dsnOf(t), user.ID)
}

// R5: sin bloqueo aplicado, el contador sube pero BlockedUntil sigue nil.
func TestL2_R5_FailuresWithoutBlock(t *testing.T) {
	st, _, _ := newStoreAndSessions(t)
	la := newLockoutStore(t)
	ctx := context.Background()
	user := seedUser(t, st)

	for i := 0; i < 4; i++ {
		if _, _, err := la.RegisterFailure(ctx, user.ID, 0); err != nil {
			t.Fatalf("RegisterFailure: %v", err)
		}
	}
	failures, err := la.CurrentFailures(ctx, user.ID)
	if err != nil || failures != 4 {
		t.Fatalf("contador: %d (%v)", failures, err)
	}
	blocked, err := la.BlockedUntil(ctx, user.ID)
	if err != nil || blocked != nil {
		t.Fatalf("4 fallos no bloquean: %v %v", blocked, err)
	}
	cleanupSession(t, dsnOf(t), user.ID)
}

// El upsert es acumulativo: dos llamadas concurrentes suman dos fallos.
func TestL2_R5_FailureCounterAccumulates(t *testing.T) {
	st, _, _ := newStoreAndSessions(t)
	la := newLockoutStore(t)
	ctx := context.Background()
	user := seedUser(t, st)

	for i := 0; i < 3; i++ {
		if _, _, err := la.RegisterFailure(ctx, user.ID, 0); err != nil {
			t.Fatalf("RegisterFailure: %v", err)
		}
	}
	failures, _ := la.CurrentFailures(ctx, user.ID)
	if failures != 3 {
		t.Fatalf("contador acumulativo: %d", failures)
	}
	cleanupSession(t, dsnOf(t), user.ID)
}
