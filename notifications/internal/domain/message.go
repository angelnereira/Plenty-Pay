package domain

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"
)

// SenderStatus y las razones del contenedor.
var (
	ErrMessageSuppressed = errors.New("SUPPRESSED")
	ErrProviderUnset     = errors.New("PROVIDER_CREDENTIALS_MISSING")
)

// Providers por interfaz (R7). Sin credenciales el modo es `log`: no envía,
// registra, y la UI de plataforma lo muestra (SPEC §5 R7).
type EmailSender interface {
	Send(ctx context.Context, msg OutgoingMessage) (providerMessageID string, err error)
}

type PushSender interface {
	Send(ctx context.Context, msg OutgoingMessage, deviceTokens []string) (providerMessageID string, err error)
}

type SmsSender interface {
	Send(ctx context.Context, msg OutgoingMessage) (providerMessageID string, err error)
}

type WhatsAppSender interface {
	Send(ctx context.Context, msg OutgoingMessage) (providerMessageID string, err error)
}

// OutgoingMessage es lo que sale hacia un proveedor externo.
type OutgoingMessage struct {
	To          string
	Subject     string
	Body        string
	Idempotency string
	Locale      string
}

// DedupeKey (R1) — la clave es única por hecho, canal y destinatario:
// `payment-captured:<payment_id>:<user_id>:email`.
func DedupeKey(eventKind, aggregateID, userID, channel string) string {
	return strings.ToLower(eventKind) + ":" + aggregateID + ":" + userID + ":" + strings.ToLower(channel)
}

// Status del mensaje en el ciclo de vida (glosario).
const (
	StatusQueued     = "QUEUED"
	StatusSent       = "SENT"
	StatusDelivered  = "DELIVERED"
	StatusFailed     = "FAILED"
	StatusSuppressed = "SUPPRESSED"
)

// Message es una fila de notifications.messages.
type Message struct {
	ID              string
	TenantID        string
	RecipientUserID string
	Channel         string
	TemplateKey     string
	TemplateVersion int
	Status          string
	Provider        string
	Attempts        int
	LastError       string
	DedupeKey       string
	NextAttemptAt   *time.Time
	SentAt          *time.Time
}

// Backoff de R3: 1 min, 5 min, 30 min, 2 h; al cuarto intento FAILED.
var backoffSchedule = []time.Duration{
	1 * time.Minute,
	5 * time.Minute,
	30 * time.Minute,
	2 * time.Hour,
}

const maxAttempts = 4

// NextBackoff devuelve el instante del siguiente intento y si el mensaje agotó
// los reintentos. `attempts` es el número de intentos ya hechos.
func NextBackoff(attempts int, now time.Time) (time.Time, bool) {
	if attempts >= maxAttempts {
		return time.Time{}, true
	}
	idx := attempts
	if idx >= len(backoffSchedule) {
		idx = len(backoffSchedule) - 1
	}
	return now.Add(backoffSchedule[idx]), false
}

// TerminalFinalize consolida el resultado de un envío (R3).
func TerminalFinalize(m *Message, sent bool, sentAt time.Time) {
	if sent {
		m.Status = StatusSent
		m.SentAt = &sentAt
		m.Attempts++
		return
	}
	m.Attempts++
	next, exhausted := NextBackoff(m.Attempts, sentAt)
	if exhausted {
		m.Status = StatusFailed
		return
	}
	m.Status = StatusQueued
	m.NextAttemptAt = &next
}

// ShouldFallbackToAlternateChannel: R3 define el canal alternativo si la regla lo
// declara. El SMS es el alterno de correo y de WhatsApp, nunca de un aviso de
// seguridad: esos solo por in-app y push.
func ShouldFallbackToAlternateChannel(channel, status string) (string, bool) {
	if status != StatusFailed {
		return "", false
	}
	switch channel {
	case ChannelWhatsApp, ChannelEmail:
		return ChannelSMS, true
	default:
		return "", false
	}
}

// Suppression es una dirección vetada (R5): rebote duro o queja.
type Suppression struct {
	AddressHash [32]byte
	Channel     string
	Reason      string
}

// HashAddress calcula el hash de una dirección. El plano nunca guarda la dirección
// en claro (N-DAT-05, AGENTS.md §2.16).
func HashAddress(address string) [32]byte {
	return sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(address))))
}

func (s Suppression) Matches(address, channel string) bool {
	return s.Channel == channel && s.AddressHash == HashAddress(address)
}

// R4: horario silencioso 22:00–07:00 hora de Panamá para push no transaccionales.
type QuietHours struct {
	StartHour int // 22
	EndHour   int // 7
}

func (q QuietHours) InQuietHours(t time.Time) bool {
	h := t.Hour()
	if q.StartHour == q.EndHour {
		return true
	}
	if q.StartHour < q.EndHour {
		return h >= q.StartHour && h < q.EndHour
	}
	return h >= q.StartHour || h < q.EndHour
}

// DeferUntilQuietHoursEnd devuelve el instante en que termina la ventana silenciosa
// del canal indicado. Las categorías transaccionales no se aplazan.
func DeferUntilQuietHoursEnd(channel, category string, now time.Time, q QuietHours) (time.Time, bool) {
	if channel != ChannelPush {
		return time.Time{}, false
	}
	if category == CategoryPayment || category == CategorySecurity {
		return time.Time{}, false
	}
	if !q.InQuietHours(now) {
		return time.Time{}, false
	}
	// Avanza al primer minuto de la hora de fin del día local.
	end := time.Date(now.Year(), now.Month(), now.Day(), q.EndHour, 0, 0, 0, now.Location())
	if !end.After(now) {
		end = end.AddDate(0, 0, 1)
	}
	return end, true
}

// Decision es lo que el consumidor decide antes de encolar.
type Decision struct {
	Channel    string
	Delayed    bool
	DeliverAt  time.Time
	Suppressed bool
	Reason     string
}

// Decide aplica R1, R4, R5 y R6 en un solo lugar.
type DecisionInput struct {
	Channel      string
	Category     string
	Template     Template
	Rendered     Rendered
	Recipient    string
	DedupeKey    string
	AlreadySent  bool
	Suppressions []Suppression
	Now          time.Time
	Quiet        QuietHours
}

// DecideChannel es el orden de las reglas: duplicado → supresión → datos sensibles
// → horario silencioso. La primera que aplica corta.
func Decide(in DecisionInput) Decision {
	if in.AlreadySent {
		// R1: el mismo hecho entregado 3 veces produce un solo envío.
		return Decision{Channel: in.Channel, Suppressed: true, Reason: "DUPLICATE"}
	}
	for _, s := range in.Suppressions {
		if s.Matches(in.Recipient, in.Channel) {
			// R5: una dirección suprimida no recibe más correo.
			return Decision{Channel: in.Channel, Suppressed: true, Reason: s.Reason}
		}
	}
	if ContainsSensitiveData(in.Channel, in.Rendered.Body) {
		return Decision{Channel: in.Channel, Suppressed: true, Reason: "SENSITIVE_DATA_IN_SHORT_CHANNEL"}
	}
	if at, ok := DeferUntilQuietHoursEnd(in.Channel, in.Category, in.Now, in.Quiet); ok {
		// R4: el push no transaccional espera a que termine la ventana silenciosa.
		return Decision{Channel: in.Channel, Delayed: true, DeliverAt: at}
	}
	return Decision{Channel: in.Channel}
}

// Preference decide si el usuario recibe un mensaje en un canal (F20.6, SPEC §4).
type Preference struct {
	UserID   string
	Category string
	Channel  string
	Enabled  bool
}

// Preferences agrupa por usuario.
type Preferences map[string]map[string]map[string]bool

func NewPreferences() Preferences { return Preferences{} }

// Set fija una preferencia.
func (p Preferences) Set(userID, category, channel string, enabled bool) {
	if p[userID] == nil {
		p[userID] = map[string]map[string]bool{}
	}
	if p[userID][category] == nil {
		p[userID][category] = map[string]bool{}
	}
	p[userID][category][channel] = enabled
}

// Allowed aplica R5/SPEC §4: una categoría transaccional siempre conserva in-app.
func (p Preferences) Allowed(userID, category, channel string) bool {
	byCategory, ok := p[userID]
	if !ok {
		return true
	}
	byChannel, ok := byCategory[category]
	if !ok {
		return true
	}
	enabled, ok := byChannel[channel]
	if !ok {
		return true
	}
	if !enabled && (category == CategoryPayment || category == CategorySecurity) {
		// Categoría transaccional: si el canal elegido está apagado, cae a in-app.
		return channel == ChannelInApp
	}
	return enabled
}

// ValidatePreferencesSettings rechaza apagar una categoría transaccional en todos
// los canales: `TRANSACTIONAL_IN_APP_REQUIRED`.
func ValidatePreferencesSettings(current Preferences, userID, category, channel string, enabled bool) error {
	if enabled {
		return nil
	}
	if category != CategoryPayment && category != CategorySecurity {
		return nil
	}
	if channel == ChannelInApp {
		return ErrTransactionalInAppReq
	}
	// Si tras apagar este canal no queda ninguno habilitado (in-app incluido), se rechaza.
	for ch := range current[userID][category] {
		if ch == channel {
			continue
		}
		if current[userID][category][ch] {
			return nil
		}
	}
	byChannel, ok := current[userID][category]
	if !ok || len(byChannel) == 0 {
		return ErrTransactionalInAppReq
	}
	return nil
}

// Device (F20.4): un token push pertenece a un solo usuario; la reasignación es al
// último que lo registra.
type Device struct {
	ID         string
	UserID     string
	Platform   string
	PushToken  string
	AppVersion string
	LastSeenAt time.Time
}

// RegisterDevice aplica la reasignación al último usuario del token.
func RegisterDevice(devices map[string]Device, d Device) map[string]Device {
	if existing, ok := devices[d.PushToken]; ok && existing.UserID != d.UserID {
		// El token cambia de dueño: se reasigna al último (SPEC §4).
		devices[d.PushToken] = d
		return devices
	}
	devices[d.PushToken] = d
	return devices
}

// DevicesForUser devuelve los tokens de un usuario, ordenados para que el envío
// sea determinista.
func DevicesForUser(devices map[string]Device, userID string) []string {
	var out []string
	for _, d := range devices {
		if d.UserID == userID {
			out = append(out, d.PushToken)
		}
	}
	sortStrings(out)
	return out
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

// InboxItem (F20.3).
type InboxItem struct {
	ID        string
	UserID    string
	TenantID  string
	Title     string
	Body      string
	DeepLink  string
	Category  string
	ReadAt    *time.Time
	CreatedAt time.Time
}

// MarkRead marca un ítem como leído; `NOT_FOUND` si no pertenece al usuario
// (ADR 0011: el tenant y el actor salen de los metadatos, nunca del cuerpo).
func MarkRead(items []InboxItem, id, userID string, at time.Time) ([]InboxItem, error) {
	found := false
	for i := range items {
		if items[i].ID != id {
			continue
		}
		if items[i].UserID != userID {
			return nil, ErrRecipientUnreachable
		}
		items[i].ReadAt = &at
		found = true
	}
	if !found {
		return nil, errors.New("NOT_FOUND")
	}
	return items, nil
}

// ListInbox devuelve los ítems del usuario, más recientes primero.
func ListInbox(items []InboxItem, userID string) []InboxItem {
	out := make([]InboxItem, 0, len(items))
	for _, it := range items {
		if it.UserID == userID {
			out = append(out, it)
		}
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].CreatedAt.After(out[j-1].CreatedAt); j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// SubscriptionRules es la tabla R2 del SPEC (revisión de código).
type SubscriptionRule struct {
	Event            string
	Category         string
	Channels         []string
	Template         string
	AlternateChannel string
}

func defaultSubscriptionRules() []SubscriptionRule {
	return []SubscriptionRule{
		{Event: "PaymentCaptured", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush, ChannelEmail}, Template: "payment.captured"},
		{Event: "PaymentFailed", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush}, Template: "payment.failed"},
		{Event: "RefundSucceeded", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush, ChannelEmail}, Template: "refund.succeeded"},
		{Event: "InvoiceAccepted", Category: CategoryPayment, Channels: []string{ChannelEmail}, Template: "invoice.issued"},
		{Event: "OrderPaid", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush}, Template: "order.paid"},
		{Event: "SubOrderStatusChanged", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush}, Template: "order.status"},
		{Event: "DeliveryStatusChanged", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelPush, ChannelWhatsApp, ChannelSMS}, Template: "delivery.status"},
		{Event: "BatchPaid", Category: CategoryPayment, Channels: []string{ChannelInApp, ChannelEmail}, Template: "settlement.paid"},
		{Event: "PayrollRunPaid", Category: CategoryPayment, Channels: []string{ChannelPush, ChannelEmail}, Template: "payroll.paid"},
		{Event: "FolioLow", Category: "FISCAL", Channels: []string{ChannelInApp, ChannelEmail}, Template: "fiscal.folio_low"},
		{Event: "StockLow", Category: "INVENTORY", Channels: []string{ChannelInApp}, Template: "inventory.low"},
		{Event: "TenantStatusChanged", Category: "BUSINESS", Channels: []string{ChannelEmail, ChannelInApp}, Template: "business.status"},
		{Event: "SessionRevoked", Category: CategorySecurity, Channels: []string{ChannelEmail, ChannelPush}, Template: "security.session_revoked"},
	}
}

var subscriptionRules = defaultSubscriptionRules()

// RoutesFor devuelve los canales de un evento, o error si el evento no está en R2:
// un evento desconocido no genera ningún mensaje (SPEC §1 "no decide cuándo notificar").
func RoutesFor(event string) (SubscriptionRule, error) {
	for _, r := range subscriptionRules {
		if r.Event == event {
			return r, nil
		}
	}
	return SubscriptionRule{}, fmt.Errorf("TEMPLATE_NOT_FOUND: evento sin regla %s", event)
}

// AllSubscriptionRules devuelve una copia de la tabla R2 para la revisión de código.
func AllSubscriptionRules() []SubscriptionRule {
	out := make([]SubscriptionRule, len(subscriptionRules))
	copy(out, subscriptionRules)
	return out
}
