//go:build l2

// Pruebas L2 de la confirmación fuerte contra PostgreSQL real (ADR 0020, migración 0011).
// Reglas: R15 (un uso, vinculación exacta), R26 (el reto es de su usuario), R28 (intentos y
// bloqueo del PIN sin perder fallos concurrentes), R32 (persistido, solo el hash, consumo atómico).
package store_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/store"
)

func seedStrongAuthUser(t *testing.T) (*store.PostgresStrongAuthStore, string, string) {
	t.Helper()
	st, _, dsn := newStoreAndSessions(t)
	user := newUser("confirma-" + randSuffix() + "@example.com")
	if err := st.Create(context.Background(), user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { cleanupSession(t, dsn, user.ID) })
	return store.NewPostgresStrongAuthStore(st.Pool()), user.ID, dsn
}

// R32 y R15: el token se guarda hasheado, se consume una sola vez aunque lleguen dos consumos a la
// vez, y un consumo con otra vinculación no lo gasta.
func TestL2_R32_TokenHashedAndConsumedOnce(t *testing.T) {
	sa, userID, dsn := seedStrongAuthUser(t)
	ctx := context.Background()
	now := time.Now().UTC()
	token := "token-" + uuid.NewString()
	sum := sha256.Sum256([]byte(token))
	b := store.StepUpBinding{UserID: userID, Operation: domain.OpPaymentsRefund, AmountMinor: 4200, Currency: "USD"}
	if err := sa.IssueToken(ctx, sum[:], b, domain.MethodPIN, now.Add(5*time.Minute)); err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	var stored []byte
	pool := newVerificationPool(t, dsn)
	err := pgx.BeginTxFunc(ctx, pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT token_hash FROM step_up_tokens WHERE user_id = $1::uuid`, userID).Scan(&stored)
	})
	if err != nil || !bytes.Equal(stored, sum[:]) || bytes.Contains(stored, []byte(token)) {
		t.Fatalf("solo se guarda el SHA-256 del token: %v", err)
	}
	wrong := b
	wrong.AmountMinor = 4199
	if r, err := sa.ConsumeToken(ctx, sum[:], wrong, now); err != nil || r != store.ConsumeMismatch {
		t.Fatalf("otro monto: %q %v", r, err)
	}
	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		valid int
	)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := sa.ConsumeToken(ctx, sum[:], b, now)
			if err != nil {
				t.Errorf("ConsumeToken: %v", err)
				return
			}
			if r == "" {
				mu.Lock()
				valid++
				mu.Unlock()
			} else if r != store.ConsumeAlreadyUsed {
				t.Errorf("motivo inesperado: %q", r)
			}
		}()
	}
	wg.Wait()
	if valid != 1 {
		t.Fatalf("exactamente un consumo es válido, hubo %d", valid)
	}
	other := sha256.Sum256([]byte("no-existe"))
	if r, _ := sa.ConsumeToken(ctx, other[:], b, now); r != store.ConsumeNotFound {
		t.Fatalf("token desconocido: %q", r)
	}
	expired := sha256.Sum256([]byte(token + "-vencido"))
	_ = sa.IssueToken(ctx, expired[:], b, domain.MethodPIN, now.Add(time.Minute))
	if r, _ := sa.ConsumeToken(ctx, expired[:], b, now.Add(2*time.Minute)); r != store.ConsumeExpired {
		t.Fatalf("token vencido: %q", r)
	}
}

// R26 y R32: el reto persiste, solo lo ve su dueño y se consume una vez.
func TestL2_R26_ChallengeOwnedAndSingleUse(t *testing.T) {
	sa, userID, _ := seedStrongAuthUser(t)
	ctx := context.Background()
	now := time.Now().UTC()
	id := uuid.Must(uuid.NewV7()).String()
	c := store.StepUpChallenge{ID: id, UserID: userID, Purpose: store.ChallengePurposeStepUp, Challenge: []byte("reto-32-bytes"),
		Operation: domain.OpWalletTransfer, AmountMinor: 900, Currency: "USD", ExpiresAt: now.Add(5 * time.Minute)}
	if err := sa.CreateChallenge(ctx, c); err != nil {
		t.Fatalf("CreateChallenge: %v", err)
	}
	got, err := sa.GetChallenge(ctx, id, userID, now)
	if err != nil || got.Operation != c.Operation || got.AmountMinor != 900 || got.Currency != "USD" || string(got.SessionData) != "{}" {
		t.Fatalf("GetChallenge: %v %+v", err, got)
	}
	if _, err := sa.GetChallenge(ctx, id, uuid.NewString(), now); !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("otra persona no ve el reto: %v", err)
	}
	if _, err := sa.GetChallenge(ctx, "no-es-uuid", userID, now); !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("un id mal formado es un reto inexistente: %v", err)
	}
	if err := sa.ConsumeChallenge(ctx, id, userID, now); err != nil {
		t.Fatalf("ConsumeChallenge: %v", err)
	}
	if err := sa.ConsumeChallenge(ctx, id, userID, now); !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("un reto se usa una vez: %v", err)
	}
	if _, err := sa.GetChallenge(ctx, id, userID, now); !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("un reto usado ya no se lee: %v", err)
	}
}

// R28: los fallos concurrentes del PIN no se pierden y el tercero bloquea; un acierto reinicia.
func TestL2_R28_PinFailuresAreAtomic(t *testing.T) {
	sa, userID, _ := seedStrongAuthUser(t)
	ctx := context.Background()
	now := time.Now().UTC()
	if p, err := sa.GetPin(ctx, userID); err != nil || p != nil {
		t.Fatalf("sin PIN: %v %+v", err, p)
	}
	if _, err := sa.RecordPinFailure(ctx, userID, domain.DefaultPinPolicy, now); !errors.Is(err, domain.ErrPinNotSet) {
		t.Fatalf("fallo sin PIN: %v", err)
	}
	if err := sa.SetPin(ctx, userID, "sha256-bcrypt:hash-de-prueba", now); err != nil {
		t.Fatalf("SetPin: %v", err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := sa.RecordPinFailure(ctx, userID, domain.DefaultPinPolicy, now); err != nil {
				t.Errorf("RecordPinFailure: %v", err)
			}
		}()
	}
	wg.Wait()
	p, err := sa.GetPin(ctx, userID)
	if err != nil || p.FailedAttempts != 3 || !p.LockedAt(now) {
		t.Fatalf("tres fallos simultáneos cuentan los tres y bloquean: %v %+v", err, p)
	}
	if err := sa.ResetPinFailures(ctx, userID, now); err != nil {
		t.Fatalf("ResetPinFailures: %v", err)
	}
	if p, _ := sa.GetPin(ctx, userID); p.FailedAttempts != 0 || p.LockedUntil != nil || p.Hash != "sha256-bcrypt:hash-de-prueba" {
		t.Fatalf("el acierto reinicia sin tocar el hash: %+v", p)
	}
}

// R32: la purga borra lo vencido y conserva lo vigente.
func TestL2_R32_PurgeExpired(t *testing.T) {
	sa, userID, _ := seedStrongAuthUser(t)
	ctx := context.Background()
	now := time.Now().UTC()
	old := uuid.Must(uuid.NewV7()).String()
	live := uuid.Must(uuid.NewV7()).String()
	for _, c := range []store.StepUpChallenge{
		{ID: old, UserID: userID, Purpose: store.ChallengePurposeStepUp, Challenge: []byte("a"), Operation: domain.OpPaymentsRefund, ExpiresAt: now.Add(-time.Hour)},
		{ID: live, UserID: userID, Purpose: store.ChallengePurposeStepUp, Challenge: []byte("b"), Operation: domain.OpPaymentsRefund, ExpiresAt: now.Add(time.Hour)},
	} {
		if err := sa.CreateChallenge(ctx, c); err != nil {
			t.Fatalf("CreateChallenge: %v", err)
		}
	}
	if _, err := sa.PurgeStepUp(ctx, now.Add(-time.Minute)); err != nil {
		t.Fatalf("PurgeStepUp: %v", err)
	}
	if _, err := sa.GetChallenge(ctx, live, userID, now); err != nil {
		t.Fatalf("el reto vigente sigue: %v", err)
	}
}
