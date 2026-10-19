package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"sort"
	"strings"
)

// ErrProviderUnconfigured: sin credenciales el canal responde en modo log (R7).
var ErrProviderUnconfigured = errors.New("PROVIDER_CREDENTIALS_MISSING")

// Sandbox indica que el mensaje no salió de verdad: la UI lo muestra (AGENTS.md §2.12).
const Sandbox = true

// LogSender implementa los cuatro canales en modo log: no envía, registra lo que
// habría enviado. Es el comportamiento exigido por R7 cuando no hay credenciales,
// y `sandbox:true` en el registro para que nadie lo confunda con un envío real.
type LogSender struct {
	Log func(msg string)
}

// SandboxMessage es una línea de telemetría; nunca lleva el cuerpo completo ni la
// dirección del destinatario (AGENTS.md §2.16).
func (s LogSender) record(channel, templateKey string, to string) string {
	hashed := HashAddress(to)
	entry := fmt.Sprintf("notification_sandbox channel=%s template=%s recipient=%x",
		strings.ToLower(channel), templateKey, hashed[:8])
	if s.Log != nil {
		s.Log(entry)
	}
	return entry
}

func (s LogSender) Send(ctx context.Context, msg OutgoingMessage) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return s.record(msg.Locale, msg.Idempotency, msg.To), nil
}

// ResendSender habla con el proveedor HTTP principal (F20.2). El transporte se inyecta
// (`Transport`) para poder probar el payload y el modo sin credenciales sin abrir red.
type ResendSender struct {
	APIKey    string
	From      string
	Transport Transport
}

// Transport es el cliente HTTP mínimo del proveedor de correo; `*http.Client` lo
// satisface a través de `HTTTransport`.
type Transport interface {
	Post(ctx context.Context, endpoint string, apiKey string, payload []byte) (providerMessageID string, status int, err error)
}

// HTTTransport implementa Transport sobre `*http.Client`.
type HTTTransport struct {
	Client *http.Client
}

// Post llama al proveedor y devuelve el identificador del mensaje.
func (t HTTTransport) Post(ctx context.Context, endpoint, apiKey string, payload []byte) (string, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.Client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, err
	}
	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		// El proveedor respondió algo que no se puede leer: es un defecto del
		// adaptador, se propaga para que el reintento lo registre en el borde.
		return "", resp.StatusCode, fmt.Errorf("respuesta del proveedor ilegible: %w", err)
	}
	return parsed.ID, resp.StatusCode, nil
}

// Payload construye el cuerpo del envío de correo. El idempotency key viaja como
// cabecera del proveedor para que un reintento no genere un segundo correo.
func (s ResendSender) Payload(msg OutgoingMessage) ([]byte, error) {
	if err := ValidateEmail(msg.To); err != nil {
		return nil, err
	}
	if s.From == "" {
		return nil, fmt.Errorf("%w: remitente sin configurar", ErrProviderUnconfigured)
	}
	body, err := json.Marshal(map[string]any{
		"from":    s.From,
		"to":      []string{msg.To},
		"subject": msg.Subject,
		"html":    msg.Body,
		"headers": map[string]string{"X-Idempotency-Key": msg.Idempotency},
	})
	if err != nil {
		return nil, err
	}
	return body, nil
}

// Send implementa EmailSender. Sin credenciales devuelve `ErrProviderUnconfigured`
// para que el llamador caiga en modo log (R7) en vez de fingir un envío.
func (s ResendSender) Send(ctx context.Context, msg OutgoingMessage) (string, error) {
	if s.APIKey == "" || s.Transport == nil {
		return "", fmt.Errorf("%w: Resend sin credenciales", ErrProviderUnconfigured)
	}
	payload, err := s.Payload(msg)
	if err != nil {
		return "", err
	}
	id, status, err := s.Transport.Post(ctx, "https://api.resend.com/emails", s.APIKey, payload)
	if err != nil {
		return "", err
	}
	if status < 200 || status > 299 {
		return "", fmt.Errorf("proveedor de correo respondió %d", status)
	}
	return id, nil
}

// ValidateEmail comprueba la forma de una dirección sin enviar nada.
func ValidateEmail(address string) error {
	if address == "" {
		return fmt.Errorf("%w: RECIPIENT_UNREACHABLE", ErrRecipientUnreachable)
	}
	if _, err := mail.ParseAddress(address); err != nil {
		return fmt.Errorf("%w: dirección inválida", ErrRecipientUnreachable)
	}
	return nil
}

// ValidatePhone comprueba un número en E.164 (N-FMT-02).
func ValidatePhone(number string) error {
	if number == "" {
		return fmt.Errorf("%w: RECIPIENT_UNREACHABLE", ErrRecipientUnreachable)
	}
	if number[0] != '+' {
		return fmt.Errorf("%w: E.164 requiere +", ErrRecipientUnreachable)
	}
	for _, c := range number[1:] {
		if c < '0' || c > '9' {
			return fmt.Errorf("%w: E.164 solo admite dígitos", ErrRecipientUnreachable)
		}
	}
	return nil
}

// Contacts son los datos de contacto que identity entrega (este contenedor no los guarda).
type Contacts struct {
	UserID           string
	Email            string
	PhoneE164        string
	WhatsApp         string
	MarketingConsent bool
}

// AddressFor devuelve la dirección del canal y la marca como no entregable si no la hay.
func AddressFor(c Contacts, channel string) (string, error) {
	switch channel {
	case ChannelEmail:
		if err := ValidateEmail(c.Email); err != nil {
			return "", err
		}
		return c.Email, nil
	case ChannelSMS:
		if err := ValidatePhone(c.PhoneE164); err != nil {
			return "", err
		}
		return c.PhoneE164, nil
	case ChannelWhatsApp:
		if err := ValidatePhone(c.WhatsApp); err != nil {
			return "", err
		}
		return c.WhatsApp, nil
	case ChannelPush, ChannelInApp:
		// El push y el in-app no llevan dirección: se dirigen por `user_id`.
		if c.UserID == "" {
			return "", fmt.Errorf("%w: usuario sin identificador", ErrRecipientUnreachable)
		}
		return c.UserID, nil
	default:
		return "", fmt.Errorf("%w: canal %s desconocido", ErrRecipientUnreachable, channel)
	}
}

// Resolver comprueba consentimiento y dirección antes de encolar (SPEC §4 Send).
func Resolve(c Contacts, channel, category string) (string, error) {
	if category == "MARKETING" && !c.MarketingConsent {
		// N-DAT-02: el consentimiento de mercadeo es previo y separado por finalidad.
		return "", fmt.Errorf("%w: sin consentimiento de mercadeo", ErrConsentRequired)
	}
	return AddressFor(c, channel)
}

// TemplateLibrary indexa plantillas por (key, channel, locale) y resuelve la versión
// activa más alta.
type TemplateLibrary struct {
	byKey map[string][]Template
}

// NewTemplateLibrary indexa las plantillas por tenant y elige la versión activa más alta.
func NewTemplateLibrary(all []Template) *TemplateLibrary {
	lib := &TemplateLibrary{byKey: map[string][]Template{}}
	for _, t := range all {
		k := libKey(t.TenantID, t.Key, t.Channel, t.Locale)
		lib.byKey[k] = append(lib.byKey[k], t)
	}
	for k := range lib.byKey {
		sort.SliceStable(lib.byKey[k], func(i, j int) bool {
			return lib.byKey[k][i].Version > lib.byKey[k][j].Version
		})
	}
	return lib
}

func libKey(tenantID, key, channel, locale string) string {
	return strings.Join([]string{tenantID, key, channel, locale}, "|")
}

// ResolveAndRender busca la plantilla activa y la renderiza. `tenantID` vacío busca la
// plantilla de plataforma como respaldo (tenant_id NULL en la tabla).
func (l *TemplateLibrary) ResolveAndRender(tenantID, key, channel, locale string, v Vars) (Rendered, string, error) {
	for _, candidate := range []string{tenantID, ""} {
		list := l.byKey[libKey(candidate, key, channel, locale)]
		for _, tpl := range list {
			if !tpl.Active {
				continue
			}
			r, err := tpl.Render(v)
			if err != nil {
				return Rendered{}, "", err
			}
			return r, tpl.Locale, nil
		}
	}
	return Rendered{}, "", fmt.Errorf("%w: %s/%s/%s", ErrTemplateNotFound, key, channel, locale)
}

// Store de plantillas con control de versión (F20.1): publicar una versión que ya
// existe devuelve `TEMPLATE_VERSION_EXISTS`.
type TemplateStore struct {
	templates map[string]Template
}

// NewTemplateStore crea el almacén.
func NewTemplateStore() *TemplateStore {
	return &TemplateStore{templates: map[string]Template{}}
}

func storeKey(tenantID, key, channel, locale string, version int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%d", tenantID, key, channel, locale, version)
}

// Upsert publica una versión nueva.
func (s *TemplateStore) Upsert(t Template) (Template, error) {
	if err := t.Validate(); err != nil {
		return Template{}, err
	}
	k := storeKey(t.TenantID, t.Key, t.Channel, t.Locale, t.Version)
	if _, exists := s.templates[k]; exists {
		return Template{}, fmt.Errorf("%w: %s v%d", ErrTemplateVersionExists, t.Key, t.Version)
	}
	s.templates[k] = t
	return t, nil
}

// NextVersion devuelve la siguiente versión libre para esa plantilla.
func (s *TemplateStore) NextVersion(tenantID, key, channel, locale string) int {
	max := 0
	prefix := strings.Join([]string{tenantID, key, channel, locale}, "|")
	for k, tpl := range s.templates {
		if strings.HasPrefix(k, prefix+"|") && tpl.Version > max {
			max = tpl.Version
		}
	}
	return max + 1
}

// Preview renderiza sin enviar (SPEC §4 "vista previa").
func (s *TemplateStore) Preview(t Template, v Vars) (Rendered, error) {
	return t.Render(v)
}
