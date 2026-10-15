package realtime

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// AuthFunc valida el access token del primer mensaje (identity.ValidateToken).
type AuthFunc func(token string) (sessionID, userID, tenantID string, err error)

// Handshake upgrade la peticion HTTP y devuelve la conexion sin autenticar.
func Handshake(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, err
	}
	return &Conn{
		ws:   ws,
		send: make(chan Envelope, 32),
		subs: map[string]Subscription{},
	}, nil
}

// Serve ejecuta el bucle de la conexion: espera el auth, luego sirve mensajes
// hasta el cierre. El hub puede ser nil en pruebas de protocolo.
func (c *Conn) Serve(hub *Hub, auth AuthFunc) {
	c.hub = hub
	defer c.Close()

	// Plazo para autenticarse (SPEC §5 y §6: 5 s).
	_ = c.ws.SetReadDeadline(time.Now().Add(AuthTimeout))
	env, err := c.readEnvelope()
	if err != nil || env.Type != "auth" || env.Token == "" {
		c.writeConn(Envelope{Type: "error", Reason: "AUTH_REQUIRED"})
		return
	}
	sessionID, userID, tenantID, err := auth(env.Token)
	if err != nil {
		c.writeConn(Envelope{Type: "error", Reason: "TOKEN_INVALID"})
		return
	}
	c.SessionID, c.UserID, c.TenantID = sessionID, userID, tenantID
	if hub != nil {
		hub.Register(c)
		defer hub.Unregister(c)
	}

	// Autenticada: sin deadline de lectura (los pings la mantienen viva).
	_ = c.ws.SetReadDeadline(time.Time{})
	go c.writePump()

	for {
		env, err := c.readEnvelope()
		if err != nil {
			return
		}
		switch env.Type {
		case "ping":
			c.writeConn(Envelope{Type: "pong"})
		case "subscribe":
			c.handleSubscribe(env)
		case "unsubscribe":
			c.mu.Lock()
			delete(c.subs, env.ID)
			c.mu.Unlock()
		case "auth":
			// Renovacion de token antes de expirar (SPEC §5).
			sessionID, userID, tenantID, err := auth(env.Token)
			if err != nil {
				c.writeConn(Envelope{Type: "error", Reason: "TOKEN_INVALID"})
				return
			}
			c.SessionID, c.UserID, c.TenantID = sessionID, userID, tenantID
		default:
			c.writeConn(Envelope{Type: "error", Reason: "BAD_MESSAGE"})
		}
	}
}

// handleSubscribe valida el topic y el limite de suscripciones.
func (c *Conn) handleSubscribe(env Envelope) {
	if env.ID == "" || !knownTopic(env.Topic) {
		c.writeConn(Envelope{Type: "error", Reason: "BAD_MESSAGE"})
		return
	}
	c.mu.Lock()
	if len(c.subs) >= MaxSubscriptions {
		c.mu.Unlock()
		c.writeConn(Envelope{Type: "error", Reason: "TOO_MANY_SUBSCRIPTIONS"})
		return
	}
	c.subs[env.ID] = Subscription{ID: env.ID, Topic: env.Topic, Params: env.Params}
	c.mu.Unlock()
	c.writeConn(Envelope{Type: "subscribed", Sub: env.ID, Topic: env.Topic})
}

func knownTopic(topic string) bool {
	switch topic {
	case TopicInbox, TopicPaymentStatus, TopicDelivery, TopicCustomerDisplay, TopicGeoSubject, TopicSession:
		return true
	}
	return false
}

// Publish encola un evento para esta conexion.
func (c *Conn) Publish(topic string, data json.RawMessage) {
	seq := uint64(0)
	if c.hub != nil {
		seq = c.hub.nextSeq()
	}
	select {
	case c.send <- Envelope{Type: "event", Topic: topic, Data: data, Seq: seq}:
	default:
		// Conexion lenta: se cierra en vez de acumular (limite del SPEC).
		c.close()
	}
}

// Subscriptions devuelve las suscripciones activas (pruebas).
func (c *Conn) Subscriptions() []Subscription {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]Subscription, 0, len(c.subs))
	for _, s := range c.subs {
		out = append(out, s)
	}
	return out
}

// writePump envia los eventos encolados y los pings periodicos.
func (c *Conn) writePump() {
	ticker := time.NewTicker(PingPeriod)
	defer ticker.Stop()
	for {
		select {
		case env, ok := <-c.send:
			if !ok {
				return
			}
			_ = c.ws.SetWriteDeadline(time.Now().Add(WriteWait))
			if err := c.ws.WriteJSON(env); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.ws.SetWriteDeadline(time.Now().Add(WriteWait))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readEnvelope lee un mensaje JSON del cliente.
func (c *Conn) readEnvelope() (Envelope, error) {
	var env Envelope
	err := c.ws.ReadJSON(&env)
	return env, err
}

// writeConn envia un mensaje de control (fuera del pump).
func (c *Conn) writeConn(env Envelope) {
	_ = c.ws.SetWriteDeadline(time.Now().Add(WriteWait))
	_ = c.ws.WriteJSON(env)
}

// Close cierra la conexion una sola vez.
func (c *Conn) Close() {
	c.once.Do(func() {
		close(c.send)
		_ = c.ws.Close()
	})
}

func (c *Conn) close() { c.Close() }

// Handler construye el http.Handler del endpoint /v1/realtime.
func Handler(hub *Hub, auth AuthFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := Handshake(w, r)
		if err != nil {
			return
		}
		conn.Serve(hub, auth)
	}
}
