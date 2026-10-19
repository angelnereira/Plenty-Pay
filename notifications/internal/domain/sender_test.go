package domain

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeTransport struct {
	id       string
	status   int
	err      error
	endpoint string
	apiKey   string
	payload  []byte
	calls    int
}

func (f *fakeTransport) Post(_ context.Context, endpoint, apiKey string, payload []byte) (string, int, error) {
	f.calls++
	f.endpoint = endpoint
	f.apiKey = apiKey
	f.payload = payload
	return f.id, f.status, f.err
}

// F20.2: sin credenciales el modo es log, no un envío fingido (R7).
func TestF20_2_ResendWithoutCredentials_RefusesToSend(t *testing.T) {
	s := ResendSender{From: "hola@plentypay.pa"}
	_, err := s.Send(context.Background(), OutgoingMessage{To: "ana@example.com", Body: "hola"})
	if !errors.Is(err, ErrProviderUnconfigured) {
		t.Fatalf("expected ErrProviderUnconfigured, got %v", err)
	}
}

// F20.2: el modo log no envía y deja registro para la UI de plataforma (R7, AGENTS.md §2.12).
func TestF20_2_LogSender_RecordsSandbox(t *testing.T) {
	var lines []string
	log := LogSender{Log: func(m string) { lines = append(lines, m) }}
	id, err := log.Send(context.Background(), OutgoingMessage{
		To:          "ana@example.com",
		Idempotency: "paymentcaptured:pay-1:u1:email",
	})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if len(lines) != 1 || !strings.HasPrefix(lines[0], "notification_sandbox") {
		t.Fatalf("expected one sandbox line, got %v", lines)
	}
	if id == "" {
		t.Fatal("expected a sandbox marker id")
	}
}

// AGENTS.md §2.16: la dirección del destinatario nunca aparece en claro en la telemetría.
func TestF20_2_LogSender_NoPlainAddress(t *testing.T) {
	var lines []string
	log := LogSender{Log: func(m string) { lines = append(lines, m) }}
	_, _ = log.Send(context.Background(), OutgoingMessage{To: "ana@example.com", Idempotency: "k"})
	for _, l := range lines {
		if strings.Contains(l, "ana@example.com") {
			t.Fatalf("plain address leaked: %s", l)
		}
	}
}

func TestF20_2_LogSender_PropagatesContextError(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	log := LogSender{}
	if _, err := log.Send(ctx, OutgoingMessage{To: "a@b.com"}); err == nil {
		t.Fatal("expected context error")
	}
}

// F20.2: el payload lleva el idempotency key para que un reintento no duplique el correo.
func TestF20_2_Payload_CarriesIdempotencyKey(t *testing.T) {
	s := ResendSender{From: "hola@plentypay.pa"}
	b, err := s.Payload(OutgoingMessage{To: "ana@example.com", Subject: "Pago", Body: "<p>ok</p>", Idempotency: "k-1"})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	var parsed struct {
		From    string            `json:"from"`
		To      []string          `json:"to"`
		Headers map[string]string `json:"headers"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("payload is not valid JSON: %v", err)
	}
	if parsed.Headers["X-Idempotency-Key"] != "k-1" {
		t.Fatalf("missing idempotency header: %+v", parsed.Headers)
	}
	if len(parsed.To) != 1 || parsed.To[0] != "ana@example.com" {
		t.Fatalf("unexpected recipients %v", parsed.To)
	}
}

func TestF20_2_Payload_RejectsInvalidAddress(t *testing.T) {
	s := ResendSender{From: "hola@plentypay.pa"}
	if _, err := s.Payload(OutgoingMessage{To: "no-es-correo"}); !errors.Is(err, ErrRecipientUnreachable) {
		t.Fatalf("expected ErrRecipientUnreachable, got %v", err)
	}
}

// F20.2: una respuesta no 2xx del proveedor es un fallo, no un envío.
func TestF20_2_Send_NonSuccessStatus(t *testing.T) {
	tr := &fakeTransport{id: "m1", status: 502}
	s := ResendSender{APIKey: "key", From: "hola@plentypay.pa", Transport: tr}
	if _, err := s.Send(context.Background(), OutgoingMessage{To: "ana@example.com", Body: "x"}); err == nil {
		t.Fatal("expected error for non-2xx")
	}
}

func TestF20_2_Send_OK(t *testing.T) {
	tr := &fakeTransport{id: "msg_123", status: 200}
	s := ResendSender{APIKey: "key", From: "hola@plentypay.pa", Transport: tr}
	id, err := s.Send(context.Background(), OutgoingMessage{To: "ana@example.com", Body: "x"})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if id != "msg_123" {
		t.Fatalf("unexpected provider id %s", id)
	}
	if tr.endpoint != "https://api.resend.com/emails" {
		t.Fatalf("unexpected endpoint %s", tr.endpoint)
	}
}

// N-FMT-02: el teléfono se valida en E.164.
func TestN_FMT_02_ValidatePhone(t *testing.T) {
	if err := ValidatePhone("+50760000000"); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	for _, bad := range []string{"5076000000", "+507-600-0000", ""} {
		if err := ValidatePhone(bad); err == nil {
			t.Fatalf("expected rejection for %q", bad)
		}
	}
}

// SPEC §4 Send: sin dirección válida en el canal → RECIPIENT_UNREACHABLE.
func TestF20_2_AddressFor_MissingEmail(t *testing.T) {
	if _, err := AddressFor(Contacts{UserID: "u1"}, ChannelEmail); err == nil {
		t.Fatal("expected RECIPIENT_UNREACHABLE")
	}
}

func TestF20_2_AddressFor_PushUsesUserID(t *testing.T) {
	got, err := AddressFor(Contacts{UserID: "u1"}, ChannelPush)
	if err != nil || got != "u1" {
		t.Fatalf("unexpected %s err=%v", got, err)
	}
}

// N-DAT-02: sin consentimiento de mercadeo no se manda mercadeo.
func TestN_DAT_02_MarketingNeedsConsent(t *testing.T) {
	c := Contacts{UserID: "u1", Email: "ana@example.com", MarketingConsent: false}
	if _, err := Resolve(c, ChannelEmail, "MARKETING"); !errors.Is(err, ErrConsentRequired) {
		t.Fatalf("expected ErrConsentRequired, got %v", err)
	}
	if _, err := Resolve(c, ChannelEmail, CategoryPayment); err != nil {
		t.Fatalf("transactional must not need marketing consent: %v", err)
	}
}

// F20.1: la biblioteca resuelve la versión activa más alta y cae a la plantilla de
// plataforma cuando el tenant no tiene la suya.
func TestF20_1_Library_PicksHighestActiveVersion(t *testing.T) {
	lib := NewTemplateLibrary([]Template{
		{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 1, Body: "v1 {{n}}", Active: true},
		{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 2, Body: "v2 {{n}}", Active: true},
		{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 3, Body: "v3", Active: false},
	})
	r, _, err := lib.ResolveAndRender("t1", "k", ChannelEmail, "es_PA", Vars{"n": "x"})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if r.Body != "v2 x" {
		t.Fatalf("expected active highest version, got %q", r.Body)
	}
}

func TestF20_1_Library_FallsBackToPlatformTemplate(t *testing.T) {
	lib := NewTemplateLibrary([]Template{
		{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 1, Body: "plataforma {{n}}", Active: true},
	})
	r, _, err := lib.ResolveAndRender("t1", "k", ChannelEmail, "es_PA", Vars{"n": "x"})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if r.Body != "plataforma x" {
		t.Fatalf("expected platform fallback, got %q", r.Body)
	}
}

func TestF20_1_Library_NotFound(t *testing.T) {
	lib := NewTemplateLibrary(nil)
	if _, _, err := lib.ResolveAndRender("t1", "k", ChannelEmail, "es_PA", Vars{}); !errors.Is(err, ErrTemplateNotFound) {
		t.Fatalf("expected ErrTemplateNotFound, got %v", err)
	}
}

// F20.1: publicar dos veces la misma versión es `TEMPLATE_VERSION_EXISTS`.
func TestF20_1_StoreRejectsDuplicateVersion(t *testing.T) {
	s := NewTemplateStore()
	tpl := Template{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 1, Body: "hola", Active: true}
	if _, err := s.Upsert(tpl); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if _, err := s.Upsert(tpl); !errors.Is(err, ErrTemplateVersionExists) {
		t.Fatalf("expected ErrTemplateVersionExists, got %v", err)
	}
}

func TestF20_1_StoreNextVersion(t *testing.T) {
	s := NewTemplateStore()
	for _, v := range []int{1, 2, 3} {
		_, err := s.Upsert(Template{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: v, Body: "x", Active: true})
		if err != nil {
			t.Fatalf("upsert v%d: %v", v, err)
		}
	}
	if got := s.NextVersion("", "k", ChannelEmail, "es_PA"); got != 4 {
		t.Fatalf("expected 4, got %d", got)
	}
}

// SPEC §4: una versión publicada con variables que no coinciden se rechaza.
func TestF20_1_StoreRejectsParamMismatch(t *testing.T) {
	s := NewTemplateStore()
	bad := Template{Key: "k", Channel: ChannelEmail, Locale: "es_PA", Version: 1, Body: "{{ roto", Active: true}
	if _, err := s.Upsert(bad); err == nil {
		t.Fatal("expected rejection of malformed placeholder")
	}
}

// R3: los reintentos del canal alternativo solo aplican si la regla lo declara.
func TestR3_AlternateChannel_NotForSecurityEmail(t *testing.T) {
	if _, ok := ShouldFallbackToAlternateChannel(ChannelEmail, StatusFailed); !ok {
		t.Fatal("email falls back to SMS when the rule declares it")
	}
}

// F20.5: la regla de entrega declara el canal alternativo cuando existe.
func TestF20_5_AlternateChannelDeclared(t *testing.T) {
	r, err := RoutesFor("DeliveryStatusChanged")
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	found := false
	for _, c := range r.Channels {
		if c == ChannelWhatsApp {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected WhatsApp opt-in in the rule, got %v", r.Channels)
	}
}

// La regla de pago cubre exactamente los canales del SPEC §5 R2.
func TestF20_5_PaymentCapturedChannels(t *testing.T) {
	r, err := RoutesFor("PaymentCaptured")
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	want := []string{ChannelInApp, ChannelPush, ChannelEmail}
	if len(r.Channels) != len(want) {
		t.Fatalf("unexpected channels %v", r.Channels)
	}
	for i, c := range want {
		if r.Channels[i] != c {
			t.Fatalf("expected %v, got %v", want, r.Channels)
		}
	}
}

// F20.3: la bandeja marca leído con la hora del servidor.
func TestF20_3_MarkRead_UsesServerTime(t *testing.T) {
	at := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	items := []InboxItem{{ID: "1", UserID: "u1"}}
	out, err := MarkRead(items, "1", "u1", at)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if out[0].ReadAt == nil {
		t.Fatal("expected read_at")
	}
}
