// Package realtime implementa el WebSocket /v1/realtime del gateway
// (api-gateway/SPEC.md §5): autenticacion por primer mensaje, suscripciones por
// topic y cierre inmediato al recibir SessionRevoked (R10).
//
// Protocolo (SPEC §5):
//   cliente -> servidor: {"type":"auth","token":"..."} | subscribe | unsubscribe | ping
//   servidor -> cliente: {"type":"event","sub":...,"topic":...,"data":{...},"seq":n}
//                         | {"type":"error","reason":...} | {"type":"pong"}
package realtime

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Limites del SPEC §5.
const (
	// AuthTimeout: sin mensaje auth en 5 s se cierra la conexion.
	AuthTimeout = 5 * time.Second
	// WriteWait/PongWait/PingPeriod: ping cada 25 s, cierre si 2 pings sin respuesta.
	WriteWait  = 10 * time.Second
	PongWait   = 60 * time.Second
	PingPeriod = 25 * time.Second
	// MaxSubscriptions por conexion.
	MaxSubscriptions = 20
)

// Errores del protocolo (reason estables, grpc-conventions.md §4).
var (
	ErrAuthTimeout  = errors.New("auth timeout")
	ErrAuthRequired = errors.New("auth required")
	ErrTooManySubs  = errors.New("too many subscriptions")
	ErrBadMessage   = errors.New("bad message")
)

// upgrader configura el handshake WebSocket. Se comprueba el origen en el
// handler (el gateway es la unica puerta, ADR 0015).
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(*http.Request) bool { return true },
}

// Envelope es un mensaje del protocolo.
type Envelope struct {
	Type   string          `json:"type"`
	Token  string          `json:"token,omitempty"`
	Sub    string          `json:"sub,omitempty"`
	Topic  string          `json:"topic,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Data   json.RawMessage `json:"data,omitempty"`
	Seq    uint64          `json:"seq,omitempty"`
	Reason string          `json:"reason,omitempty"`
	ID     string          `json:"id,omitempty"`
}

// Topics conocidos (SPEC §5).
const (
	TopicInbox         = "inbox"
	TopicPaymentStatus = "payment.status"
	TopicDelivery      = "delivery"
	TopicCustomerDisplay = "customer_display"
	TopicGeoSubject    = "geo.subject"
	TopicSession       = "session"
)

// Subscription es una suscripcion activa de una conexion.
type Subscription struct {
	ID     string          `json:"id"`
	Topic  string          `json:"topic"`
	Params json.RawMessage `json:"params,omitempty"`
}

// Conn es una conexion WebSocket autenticada.
type Conn struct {
	ws   *websocket.Conn
	hub  *Hub
	send chan Envelope

	// Identidad (se rellena con el auth).
	SessionID string
	UserID    string
	TenantID  string

	mu   sync.Mutex
	subs map[string]Subscription
	once sync.Once
}

// Hub registra las conexiones por sesion y por usuario (SPEC §5: una conexion
// por sesion de dispositivo).
type Hub struct {
	mu    sync.Mutex
	byKey map[string]*Conn // clave: "<session_id>" o "<user_id>" para el cierre masivo
	byUser map[string]map[*Conn]struct{}
	seq   uint64
	now   func() time.Time
}

// NewHub construye el hub.
func NewHub() *Hub {
	return &Hub{
		byKey:  map[string]*Conn{},
		byUser: map[string]map[*Conn]struct{}{},
		now:    time.Now,
	}
}

// Register anade la conexion al hub. Si la sesion ya tenia una conexion, la
// anterior se cierra (limite de 1 por sesion de dispositivo).
func (h *Hub) Register(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if prev, ok := h.byKey[c.SessionID]; ok && prev != c {
		prev.close()
	}
	h.byKey[c.SessionID] = c
	if c.UserID != "" {
		if h.byUser[c.UserID] == nil {
			h.byUser[c.UserID] = map[*Conn]struct{}{}
		}
		h.byUser[c.UserID][c] = struct{}{}
	}
}

// Unregister quita la conexion.
func (h *Hub) Unregister(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if cur, ok := h.byKey[c.SessionID]; ok && cur == c {
		delete(h.byKey, c.SessionID)
	}
	if set, ok := h.byUser[c.UserID]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.byUser, c.UserID)
		}
	}
}

// CloseSessions cierra las conexiones de esas sesiones (R10: <= 5 s; aqui es
// inmediato). Devuelve cuantas se cerraron.
func (h *Hub) CloseSessions(sessionIDs []string) int {
	h.mu.Lock()
	conns := make([]*Conn, 0, len(sessionIDs))
	for _, id := range sessionIDs {
		if c, ok := h.byKey[id]; ok {
			conns = append(conns, c)
			delete(h.byKey, id)
		}
	}
	h.mu.Unlock()
	for _, c := range conns {
		c.close()
	}
	return len(conns)
}

// CloseUser cierra todas las conexiones de un usuario.
func (h *Hub) CloseUser(userID string) int {
	h.mu.Lock()
	var conns []*Conn
	for c := range h.byUser[userID] {
		conns = append(conns, c)
		delete(h.byKey, c.SessionID)
	}
	delete(h.byUser, userID)
	h.mu.Unlock()
	for _, c := range conns {
		c.close()
	}
	return len(conns)
}

// Count devuelve las conexiones activas (pruebas).
func (h *Hub) Count() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.byKey)
}

// nextSeq incrementa el contador de eventos de la conexion.
func (h *Hub) nextSeq() uint64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.seq++
	return h.seq
}
