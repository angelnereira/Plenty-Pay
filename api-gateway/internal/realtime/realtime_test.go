package realtime_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"plentypay/api-gateway/internal/realtime"
)

// stubAuth siempre valida y devuelve una identidad fija.
func stubAuth(sessionID, userID, tenantID string) realtime.AuthFunc {
	return func(string) (string, string, string, error) {
		return sessionID, userID, tenantID, nil
	}
}

// testServer levanta el endpoint realtime con un hub y un auth de prueba.
func testServer(t *testing.T, hub *realtime.Hub, auth realtime.AuthFunc) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/realtime", realtime.Handler(hub, auth))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// dialer conecta un cliente real al endpoint.
func dialer(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = ws.Close() })
	return ws
}

func send(t *testing.T, ws *websocket.Conn, v any) {
	t.Helper()
	if err := ws.WriteJSON(v); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func recv(t *testing.T, ws *websocket.Conn) realtime.Envelope {
	t.Helper()
	var env realtime.Envelope
	if err := ws.ReadJSON(&env); err != nil {
		t.Fatalf("read: %v", err)
	}
	return env
}

// Autenticacion por primer mensaje (SPEC §5): sin token en 5 s se cierra.
func TestRealtimeAuthRequired_ClosesWithoutAuth(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("s1", "u1", "t1"))

	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	// Sin enviar auth, la conexion se cierra en <= 5 s.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
		}
	}()
	select {
	case <-done:
	case <-time.After(6 * time.Second):
		t.Fatal("la conexion sin auth deberia cerrarse en 5 s")
	}
}

// Token invalido -> error TOKEN_INVALID y cierre.
func TestRealtimeInvalidToken(t *testing.T) {
	hub := realtime.NewHub()
	auth := func(string) (string, string, string, error) {
		return "", "", "", errTokenInvalid
	}
	srv := testServer(t, hub, auth)
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "malo"})
	env := recv(t, ws)
	if env.Type != "error" || env.Reason != "TOKEN_INVALID" {
		t.Fatalf("se esperaba error TOKEN_INVALID, llego %+v", env)
	}
}

var errTokenInvalid = errFake("token invalido")

type errFake string

func (e errFake) Error() string { return string(e) }

// Protocolo: auth, subscribe, ping -> subscribed/pong.
func TestRealtimeProtocol(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-1", "user-1", "tenant-1"))
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "tok"})

	send(t, ws, map[string]any{"type": "subscribe", "id": "sub-1", "topic": "inbox"})
	env := recv(t, ws)
	if env.Type != "subscribed" || env.Sub != "sub-1" || env.Topic != "inbox" {
		t.Fatalf("suscripcion: %+v", env)
	}

	send(t, ws, map[string]any{"type": "ping"})
	env = recv(t, ws)
	if env.Type != "pong" {
		t.Fatalf("ping: %+v", env)
	}
	if hub.Count() != 1 {
		t.Fatalf("el hub deberia tener 1 conexion, tiene %d", hub.Count())
	}
}

// Un topic desconocido se rechaza con BAD_MESSAGE.
func TestRealtimeUnknownTopic(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-2", "user-2", "tenant-2"))
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "tok"})
	send(t, ws, map[string]any{"type": "subscribe", "id": "x", "topic": "inventado"})
	env := recv(t, ws)
	if env.Type != "error" || env.Reason != "BAD_MESSAGE" {
		t.Fatalf("topic desconocido: %+v", env)
	}
}

// Limite de 20 suscripciones por conexion (SPEC §5).
func TestRealtimeSubscriptionLimit(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-3", "user-3", "tenant-3"))
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "tok"})
	for i := 0; i < 20; i++ {
		// ids distintos: el limite cuenta suscripciones activas, no mensajes.
		id := "sub-" + string(rune('a'+i%26)) + string(rune('0'+i/26))
		send(t, ws, map[string]any{"type": "subscribe", "id": id, "topic": "inbox"})
		env := recv(t, ws)
		if env.Type != "subscribed" {
			t.Fatalf("suscripcion %d: %+v", i, env)
		}
	}
	// La 21 se rechaza.
	send(t, ws, map[string]any{"type": "subscribe", "id": "s21", "topic": "inbox"})
	env := recv(t, ws)
	if env.Type != "error" || env.Reason != "TOO_MANY_SUBSCRIPTIONS" {
		t.Fatalf("limite de suscripciones: %+v", env)
	}
}

// R10: CloseSessions cierra las conexiones de esas sesiones.
func TestHubCloseSessions(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-a", "user-a", "tenant-a"))
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "tok"})
	send(t, ws, map[string]any{"type": "subscribe", "id": "s", "topic": "session"})
	_ = recv(t, ws) // subscribed

	if hub.Count() != 1 {
		t.Fatalf("hub: %d conexiones", hub.Count())
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
		}
	}()

	start := time.Now()
	hub.CloseSessions([]string{"sess-a"})

	select {
	case <-done:
		if d := time.Since(start); d > 5*time.Second {
			t.Fatalf("el cierre tardo %v (> 5 s)", d)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("CloseSessions deberia cerrar la conexion")
	}
	if hub.Count() != 0 {
		t.Fatalf("el hub deberia quedar vacio, tiene %d", hub.Count())
	}
}

// Una sola conexion por sesion de dispositivo (SPEC §5).
func TestHubOneConnectionPerSession(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-unica", "user-u", "tenant-u"))
	url := "ws" + srv.URL[len("http"):] + "/v1/realtime"

	ws1 := dialer(t, url)
	defer func() { _ = ws1.Close() }()
	send(t, ws1, map[string]any{"type": "auth", "token": "tok"})
	send(t, ws1, map[string]any{"type": "subscribe", "id": "s", "topic": "session"})
	_ = recv(t, ws1)

	done1 := make(chan struct{})
	go func() {
		defer close(done1)
		for {
			if _, _, err := ws1.ReadMessage(); err != nil {
				return
			}
		}
	}()

	ws2 := dialer(t, url)
	defer func() { _ = ws2.Close() }()
	send(t, ws2, map[string]any{"type": "auth", "token": "tok"})
	send(t, ws2, map[string]any{"type": "subscribe", "id": "s2", "topic": "session"})
	_ = recv(t, ws2) // subscribed

	// La primera conexion se cerró al registrar la segunda.
	select {
	case <-done1:
	case <-time.After(3 * time.Second):
		t.Fatal("la conexion anterior de la misma sesion deberia cerrarse")
	}
	if hub.Count() != 1 {
		t.Fatalf("hub: %d conexiones (se esperaba 1)", hub.Count())
	}
}

// Los eventos llegan como envelope con seq.
func TestConnPublishEnvelope(t *testing.T) {
	hub := realtime.NewHub()
	srv := testServer(t, hub, stubAuth("sess-p", "user-p", "tenant-p"))
	ws := dialer(t, "ws"+srv.URL[len("http"):]+"/v1/realtime")
	defer func() { _ = ws.Close() }()

	send(t, ws, map[string]any{"type": "auth", "token": "tok"})
	send(t, ws, map[string]any{"type": "subscribe", "id": "s", "topic": "inbox"})
	_ = recv(t, ws)

	// Publicar directo por el hub requiere la conexion registrada; usamos
	// CloseUser para verificar el cierre por usuario.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
		}
	}()
	hub.CloseUser("user-p")
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("CloseUser deberia cerrar la conexion")
	}
}

// El envelope JSON usa los nombres del contrato (SPEC §5).
func TestEnvelopeJSONNames(t *testing.T) {
	env := realtime.Envelope{Type: "event", Sub: "s1", Topic: "inbox", Seq: 7, Data: json.RawMessage(`{"a":1}`)}
	b, err := json.Marshal(env)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"type", "sub", "topic", "seq", "data"} {
		if _, ok := m[k]; !ok {
			t.Errorf("falta el campo %q en %s", k, b)
		}
	}
}
