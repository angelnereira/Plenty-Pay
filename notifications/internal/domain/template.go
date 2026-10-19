package domain

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

var (
	ErrTemplateNotFound      = errors.New("TEMPLATE_NOT_FOUND")
	ErrTemplateParamMismatch = errors.New("TEMPLATE_PARAM_MISMATCH")
	ErrTemplateVersionExists = errors.New("TEMPLATE_VERSION_EXISTS")
	ErrRecipientUnreachable  = errors.New("RECIPIENT_UNREACHABLE")
	ErrConsentRequired       = errors.New("CONSENT_REQUIRED")
	ErrIdempotencyKeyReused  = errors.New("IDEMPOTENCY_KEY_REUSED")
	ErrTransactionalInAppReq = errors.New("TRANSACTIONAL_IN_APP_REQUIRED")
)

// Channel y Category salen de docs/glossary.md §1.
const (
	ChannelEmail    = "EMAIL"
	ChannelPush     = "PUSH"
	ChannelSMS      = "SMS"
	ChannelWhatsApp = "WHATSAPP"
	ChannelInApp    = "IN_APP"

	// Categorías transaccionales: no se pueden desactivar en todos los canales
	// (SPEC §4 SetPreferences, `TRANSACTIONAL_IN_APP_REQUIRED`).
	CategoryPayment  = "PAYMENT"
	CategorySecurity = "SECURITY"
)

// Template es una versión de una plantilla por canal e idioma (F20.1).
type Template struct {
	ID       string
	TenantID string // "" = plantilla de plataforma
	Key      string
	Channel  string
	Locale   string
	Version  int
	Subject  string
	Body     string
	Active   bool
}

// Vars son los valores de render. El render es estricto: una variable usada en la
// plantilla y no entregada es un error, y una variable entregada y no usada también
// (`TEMPLATE_PARAM_MISMATCH`), para que ninguna plantilla se lea a medias.
type Vars map[string]string

// placeholderRe acepta `{{nombre}}`. Los identificadores son ASCII, sin espacios.
// `malformedRe` detecta cualquier `{{ … }}` que no sea un identificador válido, y
// `unclosedRe` un `{{` sin cierre, para que una plantilla rota se rechace en vez de
// publicarse con el marcador visible en el mensaje del usuario.
var placeholderRe = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_.]+)\s*\}\}`)
var malformedRe = regexp.MustCompile(`\{\{.*?\}\}`)
var unclosedRe = regexp.MustCompile(`\{\{`)

// Variables devuelve el conjunto de variables usadas por el asunto y el cuerpo,
// en orden alfabético.
func (t Template) Variables() []string {
	seen := map[string]struct{}{}
	for _, text := range []string{t.Subject, t.Body} {
		for _, m := range placeholderRe.FindAllStringSubmatch(text, -1) {
			seen[m[1]] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// Validate comprueba que la plantilla no está vacía y que sus variables tienen
// forma de identificador (SPEC §4 "variables validadas contra el esquema").
func (t Template) Validate() error {
	if t.Key == "" || t.Locale == "" || t.Channel == "" {
		return ErrTemplateNotFound
	}
	if strings.TrimSpace(t.Body) == "" {
		return ErrTemplateParamMismatch
	}
	for _, v := range t.Variables() {
		if !identifierRe.MatchString(v) {
			return fmt.Errorf("%w: variable inválida %q", ErrTemplateParamMismatch, v)
		}
	}
	// Todo `{{ … }}` debe haber sido reconocido, y no puede quedar un `{{` sin
	// cierre: si queda alguno, el marcador se publicaría literal en el mensaje.
	for _, text := range []string{t.Subject, t.Body} {
		for _, raw := range malformedRe.FindAllString(text, -1) {
			if !placeholderRe.MatchString(raw) {
				return fmt.Errorf("%w: marcador no válido %q", ErrTemplateParamMismatch, raw)
			}
		}
		if unclosedRe.MatchString(text) {
			return fmt.Errorf("%w: marcador sin cerrar", ErrTemplateParamMismatch)
		}
	}
	return nil
}

var identifierRe = regexp.MustCompile(`^[A-Za-z0-9_.]+$`)

// Rendered es el resultado de renderizar una plantilla.
type Rendered struct {
	Subject string
	Body    string
}

// Render sustituye cada `{{variable}}` por su valor. Falla si falta una variable
// o si sobra una; nunca deja un `{{` visible en el mensaje que sale al usuario.
func (t Template) Render(v Vars) (Rendered, error) {
	used := map[string]struct{}{}
	fill := func(s string) (string, error) {
		var missing []string
		out := placeholderRe.ReplaceAllStringFunc(s, func(m string) string {
			name := placeholderRe.FindStringSubmatch(m)[1]
			val, ok := v[name]
			if !ok {
				missing = append(missing, name)
				return ""
			}
			used[name] = struct{}{}
			return val
		})
		if len(missing) > 0 {
			sort.Strings(missing)
			return "", fmt.Errorf("%w: faltan %s", ErrTemplateParamMismatch, strings.Join(dedupe(missing), ", "))
		}
		return out, nil
	}

	subject, err := fill(t.Subject)
	if err != nil {
		return Rendered{}, err
	}
	body, err := fill(t.Body)
	if err != nil {
		return Rendered{}, err
	}

	// Variable entregada y no usada: la plantilla y el emisor no coinciden.
	var unused []string
	for k := range v {
		if _, ok := used[k]; !ok {
			unused = append(unused, k)
		}
	}
	if len(unused) > 0 {
		sort.Strings(unused)
		return Rendered{}, fmt.Errorf("%w: sobran %s", ErrTemplateParamMismatch, strings.Join(unused, ", "))
	}

	return Rendered{Subject: subject, Body: body}, nil
}

func dedupe(in []string) []string {
	out := in[:0]
	for i, s := range in {
		if i == 0 || in[i-1] != s {
			out = append(out, s)
		}
	}
	return out
}

// R6: los canales cortos (SMS, WhatsApp) no llevan datos sensibles; los montos sí.
// El saldo completo y el detalle de la operación nunca van en un canal corto.
func ContainsSensitiveData(channel, text string) bool {
	if channel != ChannelSMS && channel != ChannelWhatsApp {
		return false
	}
	markers := []string{"saldo disponible", "número de tarjeta", "numero de tarjeta", "CVV", "clave", "PIN"}
	low := strings.ToLower(text)
	for _, m := range markers {
		if strings.Contains(low, strings.ToLower(m)) {
			return true
		}
	}
	return false
}
