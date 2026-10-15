//go:build l2

// Verificacion de nivel L4 del criterio de F09.5: "cierre por SessionRevoked
// <= 5 s". Usa infraestructura real: NATS JetStream (event-bus de Compose) y un
// WebSocket real contra un servidor HTTP real.
//
// Etiqueta l2 = requiere infraestructura (misma convención que el resto de
// pruebas de integración del repositorio).
package realtime_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/realtime"
)

// natsURLTest se puede sobreescribir con PP_TEST_NATS_URL. Por defecto apunta al
// bus de Compose: esta prueba debe ejecutarse DENTRO de la red de Docker
// (el script api-gateway/test/test_realtime_l4.sh lo hace).
var (
	natsURLTest  = envOr("PP_TEST_NATS_URL", "nats://event-bus:4222")
	natsUserTest = envOr("PP_TEST_NATS_USER", "identity_svc")
	natsPassTest = envOr("PP_TEST_NATS_PASS", "identity_nats_secret")
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func TestR10_SessionRevokedClosesSocketWithin5s(t *testing.T) {
	// 1. NATS real.
	nc, err := nats.Connect(natsURLTest, nats.UserInfo(natsUserTest, natsPassTest))
	if err != nil {
		t.Fatalf("connect nats: %v", err)
	}
	defer nc.Close()
	js, err := nc.JetStream()
	if err != nil {
		t.Fatalf("jetstream: %v", err)
	}

	// 2. Hub + consumidor (durable unico por ejecucion: no compite con otros).
	hub := realtime.NewHub()
	consumer, err := newConsumerForTest(t, hub)
	if err != nil {
		t.Fatalf("consumer: %v", err)
	}
	defer consumer.Close()

	// 3. Servidor HTTP real con el endpoint realtime.
	authOK := func(string) (string, string, string, error) {
		return "sess-l4", "user-l4", "tenant-l4", nil
	}
	srv := httptest.NewServer(http.HandlerFunc(realtime.Handler(hub, authOK)))
	defer srv.Close()

	// 4. Cliente WebSocket real que se autentica (queda registrado en el hub).
	ws, _, err := websocket.DefaultDialer.Dial("ws"+srv.URL[len("http"):]+"/v1/realtime", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer func() { _ = ws.Close() }()
	if err := ws.WriteJSON(map[string]any{"type": "auth", "token": "tok"}); err != nil {
		t.Fatalf("auth: %v", err)
	}
	if err := ws.WriteJSON(map[string]any{"type": "subscribe", "id": "s", "topic": "session"}); err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	// Lee el "subscribed".
	var ack realtime.Envelope
	if err := ws.ReadJSON(&ack); err != nil {
		t.Fatalf("ack: %v", err)
	}
	if hub.Count() != 1 {
		t.Fatalf("hub: %d conexiones", hub.Count())
	}

	// 5. Publicar SessionRevoked con esa sesion (como lo hace identity).
	env := &pb.EventEnvelope{
		EventId:       uuid.NewString(),
		EventType:     "identity.session.revoked",
		SchemaVersion: 1,
		Producer:      "identity",
		AggregateId:   "sess-l4",
		OccurredAt:    timestamppb.New(time.Now()),
	}
	payload, err := anypb.New(&pb.SessionRevoked{UserId: "user-l4", SessionIds: []string{"sess-l4"}, Reason: "LOGOUT_ALL"})
	if err != nil {
		t.Fatalf("payload: %v", err)
	}
	env.Payload = payload
	body, err := proto.Marshal(env)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if _, err := js.Publish(realtime.SubjectSessionRevoked, body, nats.MsgId(env.EventId)); err != nil {
		t.Fatalf("publish: %v", err)
	}

	// 6. El socket debe cerrarse en <= 5 s (criterio del paso).
	closed := make(chan struct{})
	go func() {
		defer close(closed)
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
		}
	}()
	start := time.Now()
	select {
	case <-closed:
		t.Logf("socket cerrado en %v tras SessionRevoked", time.Since(start))
	case <-time.After(5 * time.Second):
		t.Fatal("la conexion no se cerro en 5 s tras SessionRevoked")
	}
	if hub.Count() != 0 {
		t.Fatalf("el hub deberia quedar vacio, tiene %d", hub.Count())
	}
}

// newConsumerForTest crea el consumidor con durable unico (aislamiento).
func newConsumerForTest(t *testing.T, hub *realtime.Hub) (*realtime.SessionRevokedConsumer, error) {
	t.Helper()
	consumer, err := realtime.NewSessionRevokedConsumerWithName(context.Background(), hub,
		natsURLTest, natsUserTest, natsPassTest, "api-gateway-realtime-test-"+uuid.NewString()[:8])
	if err != nil {
		return nil, err
	}
	t.Cleanup(func() { consumer.Close() })
	return consumer, nil
}
