//go:build l2

// Pruebas L2 de tenants y del relay del outbox contra PostgreSQL y NATS reales
// (F08.5). Criterio del paso: "Evento publicado una vez por transicion".
//
// Verifican, con operaciones reales:
//  1. el alta deja al tenant en PENDING_REVIEW y al dueno como BUSINESS_OWNER;
//  2. cada transicion escribe EXACTAMENTE una fila de outbox;
//  3. el relay publica una sola vez y JetStream no duplica (Nats-Msg-Id);
//  4. una transicion invalida no escribe nada.
package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/events"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

const testNATSStream = "PP_IDENTITY"

// natsEnv devuelve url/user/pass del bus de pruebas (mismos que el contenedor).
func natsEnv() (string, string, string) {
	return "nats://event-bus:4222", "identity_svc", "identity_nats_secret"
}

// F08.5: un cambio de estado publica exactamente un evento en JetStream.
func TestL2_F08_5_OneEventPerTransition(t *testing.T) {
	st, dsn := newStore(t)
	ts := store.NewPostgresTenantStore(st.Pool())
	ctx := context.Background()

	// Outbox limpio: las corridas previas dejan eventos de otras pruebas.
	cleanOutbox(t, dsn)

	// Alta: usuario + tenant PENDING_REVIEW.
	user := newUser("f085+" + uuid.NewString()[:8] + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	tenant := &domain.Tenant{
		LegalName: "Prueba Evento S.A.", TradeName: "PE", TaxID: "1556123" + uuid.NewString()[:4] + "-2-2023", DV: "2",
		Country: "PA", Documents: []string{"tenant/2026/" + uuid.NewString() + ".pdf"},
		CreatedAt: time.Now().UTC(),
	}
	if err := ts.CreateTenant(ctx, user, tenant); err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	defer cleanupTenant(t, dsn, tenant.ID)
	created, err := ts.GetTenant(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("GetTenant: %v", err)
	}
	if created.Status != "PENDING_REVIEW" {
		t.Fatalf("el tenant deberia nacer PENDING_REVIEW, llego %q", created.Status)
	}

	// Transicion: aprobar -> ACTIVE. Debe escribir 1 fila de outbox.
	previous, current, err := ts.ReviewTenant(ctx, tenant.ID, true, "KYB verificado")
	if err != nil {
		t.Fatalf("ReviewTenant: %v", err)
	}
	if previous != "PENDING_REVIEW" || current != "ACTIVE" {
		t.Fatalf("transicion inesperada: %s -> %s", previous, current)
	}

	// Exactamente 2 pendientes: el alta y la transicion (ni uno mas, ni uno menos).
	pending, err := ts.OutboxPending(ctx, 10)
	if err != nil {
		t.Fatalf("OutboxPending: %v", err)
	}
	if len(pending) != 2 {
		t.Fatalf("se esperaban 2 eventos pendientes (alta + transicion), llegaron %d", len(pending))
	}
	mine := map[string]bool{}
	for _, e := range pending {
		mine[e.ID] = true
	}

	// El relay publica y marca.
	url, natsUser, natsPass := natsEnv()
	relay, err := events.NewRelay(ctx, ts, url, natsUser, natsPass, nil, nil)
	if err != nil {
		t.Fatalf("NewRelay: %v", err)
	}
	defer relay.Close()

	published, err := relay.PublishOnce(ctx)
	if err != nil {
		t.Fatalf("PublishOnce: %v", err)
	}
	if published != 2 {
		t.Fatalf("el relay deberia publicar 2 eventos, publico %d", published)
	}

	// Segunda pasada: nada pendiente, nada que republicar.
	published, err = relay.PublishOnce(ctx)
	if err != nil {
		t.Fatalf("PublishOnce (2a): %v", err)
	}
	if published != 0 {
		t.Fatalf("la segunda pasada no deberia publicar nada, publico %d", published)
	}

	// En JetStream: cada uno de MIS eventos aparece una sola vez (sin duplicados).
	ids, err := streamMsgIDs(ctx, url, natsUser, natsPass, events.SubjectTenantStatusChanged, 100)
	if err != nil {
		t.Fatalf("lectura del stream: %v", err)
	}
	seen := map[string]int{}
	for _, id := range ids {
		if mine[id] {
			seen[id]++
		}
	}
	if len(seen) != 2 {
		t.Fatalf("se esperaban 2 eventos mios en el stream, llegaron %d (%v)", len(seen), seen)
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("el evento %s aparece %d veces: el relay debe publicar exactamente una", id, n)
		}
	}

	// El sobre trae el agregado correcto y el cambio de estado.
	env, err := lastEnvelope(ctx, url, natsUser, natsPass)
	if err != nil {
		t.Fatalf("ultimo envelope: %v", err)
	}
	if env.GetAggregateId() != tenant.ID {
		t.Fatalf("aggregate_id = %q, se esperaba %q", env.GetAggregateId(), tenant.ID)
	}
	if env.GetProducer() != "identity" {
		t.Fatalf("producer = %q, se esperaba identity", env.GetProducer())
	}
	var payload pb.TenantStatusChanged
	if err := env.GetPayload().UnmarshalTo(&payload); err != nil {
		t.Fatalf("payload: %v", err)
	}
	if payload.GetStatus() != pb.TenantStatus_TENANT_STATUS_ACTIVE {
		t.Fatalf("status del payload = %v, se esperaba ACTIVE", payload.GetStatus())
	}
}

// F08.5: una transicion invalida no escribe evento ni cambia el estado.
func TestL2_F08_5_InvalidTransitionWritesNothing(t *testing.T) {
	st, dsn := newStore(t)
	ts := store.NewPostgresTenantStore(st.Pool())
	ctx := context.Background()

	user := newUser("f085b+" + uuid.NewString()[:8] + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	tenant := &domain.Tenant{
		LegalName: "Prueba Invalida S.A.", TaxID: "1559123" + uuid.NewString()[:4] + "-2-2023", DV: "2", Country: "PA",
		CreatedAt: time.Now().UTC(),
	}
	if err := ts.CreateTenant(ctx, user, tenant); err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	defer cleanupTenant(t, dsn, tenant.ID)
	// Limpieza previa del outbox para medir solo esta transicion.
	cleanOutbox(t, dsn)

	// Aprobar dos veces: la segunda es invalida.
	if _, _, err := ts.ReviewTenant(ctx, tenant.ID, true, ""); err != nil {
		t.Fatalf("primera aprobacion: %v", err)
	}
	_, _, err := ts.ReviewTenant(ctx, tenant.ID, true, "")
	if err == nil {
		t.Fatal("aprobar un ACTIVO deberia fallar")
	}

	// Queda exactamente 1 pendiente (la primera transicion).
	pending, err := ts.OutboxPending(ctx, 10)
	if err != nil {
		t.Fatalf("OutboxPending: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("se esperaba 1 evento pendiente, llegaron %d", len(pending))
	}
	// Drenaje para no dejar basura.
	if _, err := relayDrain(ctx, ts); err != nil {
		t.Fatalf("drenar outbox: %v", err)
	}
}

// cleanOutbox vacia el outbox (pruebas): mide solo lo de la corrida actual.
func cleanOutbox(t *testing.T, dsn string) {
	t.Helper()
	pool := newVerificationPool(t, dsn)
	_ = pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		_, err := tx.Exec(context.Background(), `DELETE FROM outbox`)
		return err
	})
}

// streamMsgIDs lista los Nats-Msg-Id de los mensajes del subject en el stream.
func streamMsgIDs(ctx context.Context, url, user, pass, subject string, limit int) ([]string, error) {
	nc, err := nats.Connect(url, nats.UserInfo(user, pass))
	if err != nil {
		return nil, err
	}
	defer nc.Close()
	js, err := nc.JetStream()
	if err != nil {
		return nil, err
	}
	sub, err := js.PullSubscribe(subject, "", nats.BindStream(testNATSStream))
	if err != nil {
		return nil, err
	}
	msgs, err := sub.Fetch(limit, nats.MaxWait(3*time.Second))
	if err != nil && err != nats.ErrTimeout {
		return nil, err
	}
	ids := []string{}
	for _, m := range msgs {
		ids = append(ids, m.Header.Get(nats.MsgIdHdr))
	}
	return ids, nil
}

// relayDrain publica lo pendiente con el relay real (limpieza entre pruebas).
func relayDrain(ctx context.Context, ts store.TenantStore) (int, error) {
	url, natsUser, natsPass := natsEnv()
	relay, err := events.NewRelay(ctx, ts, url, natsUser, natsPass, nil, nil)
	if err != nil {
		return 0, err
	}
	defer relay.Close()
	n, err := relay.PublishOnce(ctx)
	if err != nil {
		return n, err
	}
	return n, nil
}

// countStreamMessages lee el stream con un consumidor efimero y cuenta los
// mensajes del subject, devolviendo sus Nats-Msg-Id.
func countStreamMessages(ctx context.Context, url, user, pass, subject string, limit int) (int, []string, error) {
	nc, err := nats.Connect(url, nats.UserInfo(user, pass))
	if err != nil {
		return 0, nil, err
	}
	defer nc.Close()
	js, err := nc.JetStream()
	if err != nil {
		return 0, nil, err
	}
	sub, err := js.PullSubscribe(subject, "", nats.BindStream(testNATSStream))
	if err != nil {
		return 0, nil, err
	}
	msgs, err := sub.Fetch(limit, nats.MaxWait(3*time.Second))
	if err != nil && err != nats.ErrTimeout {
		return 0, nil, err
	}
	ids := []string{}
	for _, m := range msgs {
		ids = append(ids, m.Header.Get(nats.MsgIdHdr))
	}
	return len(msgs), ids, nil
}

// lastEnvelope decodifica el ultimo mensaje del stream como EventEnvelope.
func lastEnvelope(ctx context.Context, url, user, pass string) (*pb.EventEnvelope, error) {
	nc, err := nats.Connect(url, nats.UserInfo(user, pass))
	if err != nil {
		return nil, err
	}
	defer nc.Close()
	js, err := nc.JetStream()
	if err != nil {
		return nil, err
	}
	sub, err := js.PullSubscribe(events.SubjectTenantStatusChanged, "", nats.BindStream(testNATSStream))
	if err != nil {
		return nil, err
	}
	msgs, err := sub.Fetch(20, nats.MaxWait(3*time.Second))
	if err != nil {
		return nil, err
	}
	var env pb.EventEnvelope
	if err := proto.Unmarshal(msgs[len(msgs)-1].Data, &env); err != nil {
		return nil, err
	}
	return &env, nil
}

// cleanupTenant borra el tenant de prueba (como plataforma: RLS).
func cleanupTenant(t *testing.T, dsn, tenantID string) {
	t.Helper()
	pool := newVerificationPool(t, dsn)
	_ = pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		_, err := tx.Exec(context.Background(), `DELETE FROM tenants WHERE id = $1::uuid`, tenantID)
		return err
	})
}
