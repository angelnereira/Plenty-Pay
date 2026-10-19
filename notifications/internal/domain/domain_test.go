package domain

import (
	"bytes"
	"testing"
	"time"
)

func tmpl() Template {
	return Template{
		Key:     "payment.captured",
		Channel: ChannelEmail,
		Locale:  "es_PA",
		Version: 1,
		Subject: "Pago recibido",
		Body:    "Hola {{nombre}}, recibimos {{monto}}.",
		Active:  true,
	}
}

// F20.1: variables de una plantilla, en orden estable.
func TestF20_1_TemplateVariables_Sorted(t *testing.T) {
	got := tmpl().Variables()
	if len(got) != 2 || got[0] != "monto" || got[1] != "nombre" {
		t.Fatalf("expected [monto nombre], got %v", got)
	}
}

// F20.1: render sustituye las variables.
func TestF20_1_Render_OK(t *testing.T) {
	r, err := tmpl().Render(Vars{"nombre": "Ana", "monto": "$10.00"})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if r.Body != "Hola Ana, recibimos $10.00." {
		t.Fatalf("unexpected body %q", r.Body)
	}
	if r.Subject != "Pago recibido" {
		t.Fatalf("unexpected subject %q", r.Subject)
	}
}

// F20.1: falta una variable → `TEMPLATE_PARAM_MISMATCH`, nunca un `{{` visible.
func TestF20_1_Render_MissingVariable(t *testing.T) {
	_, err := tmpl().Render(Vars{"nombre": "Ana"})
	if err == nil {
		t.Fatal("expected TEMPLATE_PARAM_MISMATCH")
	}
	if err.Error() == "" || !bytes.Contains([]byte(err.Error()), []byte("TEMPLATE_PARAM_MISMATCH")) {
		t.Fatalf("unexpected error %v", err)
	}
}

// F20.1: sobra una variable → el emisor y la plantilla no coinciden.
func TestF20_1_Render_ExtraVariable(t *testing.T) {
	_, err := tmpl().Render(Vars{"nombre": "Ana", "monto": "$1", "extra": "x"})
	if err == nil {
		t.Fatal("expected TEMPLATE_PARAM_MISMATCH")
	}
}

func TestF20_1_TemplateValidate_RejectsEmptyBody(t *testing.T) {
	tpl := tmpl()
	tpl.Body = "   "
	if err := tpl.Validate(); err != ErrTemplateParamMismatch {
		t.Fatalf("expected ErrTemplateParamMismatch, got %v", err)
	}
}

func TestF20_1_TemplateValidate_RejectsBadIdentifier(t *testing.T) {
	tpl := tmpl()
	tpl.Body = "Hola {{nombre completo}}"
	if err := tpl.Validate(); err == nil {
		t.Fatal("expected rejection of invalid identifier")
	}
}

// R1: `dedupe_key` única por hecho, canal y destinatario.
func TestR1_DedupeKey_Distinct(t *testing.T) {
	a := DedupeKey("PaymentCaptured", "pay-1", "user-1", ChannelEmail)
	b := DedupeKey("PaymentCaptured", "pay-1", "user-1", ChannelPush)
	if a == b {
		t.Fatal("expected distinct key per channel")
	}
	if a != "paymentcaptured:pay-1:user-1:email" {
		t.Fatalf("unexpected key %s", a)
	}
}

// R3: backoff 1 min, 5 min, 30 min, 2 h y agotamiento al cuarto intento.
func TestR3_NextBackoff_Schedule(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	want := []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour}
	for i, w := range want {
		at, exhausted := NextBackoff(i, now)
		if exhausted {
			t.Fatalf("attempt %d should not be exhausted", i)
		}
		if at.Sub(now) != w {
			t.Fatalf("attempt %d: expected %v, got %v", i, w, at.Sub(now))
		}
	}
	if _, exhausted := NextBackoff(4, now); !exhausted {
		t.Fatal("expected exhausted after 4 attempts")
	}
}

// R3: un fallo reencola con siguiente intento; el quinto envío marca FAILED.
func TestR3_TerminalFinalize(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	m := &Message{Status: StatusQueued}
	TerminalFinalize(m, false, now)
	if m.Status != StatusQueued || m.NextAttemptAt == nil {
		t.Fatalf("expected requeue, got %+v", m)
	}
	m.Attempts = 4
	TerminalFinalize(m, false, now)
	if m.Status != StatusFailed {
		t.Fatalf("expected FAILED, got %s", m.Status)
	}
}

// R3: éxito marca SENT con la fecha.
func TestR3_TerminalFinalize_Sent(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	m := &Message{}
	TerminalFinalize(m, true, now)
	if m.Status != StatusSent || m.SentAt == nil || !m.SentAt.Equal(now) {
		t.Fatalf("unexpected message %+v", m)
	}
}

// R4: horario silencioso 22:00–07:00 para push no transaccional.
func TestR4_QuietHours_PushNonTransactionalDeferred(t *testing.T) {
	q := QuietHours{StartHour: 22, EndHour: 7}
	at := time.Date(2026, 10, 19, 23, 30, 0, 0, time.UTC)
	d := Decide(DecisionInput{
		Channel: ChannelPush, Category: "MARKETING", Recipient: "user-1",
		Rendered: Rendered{Body: "Hola"}, DedupeKey: "k", Now: at, Quiet: q,
	})
	if !d.Delayed {
		t.Fatal("expected delay in quiet hours")
	}
	if d.DeliverAt.Hour() != 7 {
		t.Fatalf("expected delivery at 07:00, got %v", d.DeliverAt)
	}
}

// R4: un aviso transaccional no se aplaza.
func TestR4_QuietHours_TransactionalNotDeferred(t *testing.T) {
	q := QuietHours{StartHour: 22, EndHour: 7}
	at := time.Date(2026, 10, 19, 23, 30, 0, 0, time.UTC)
	d := Decide(DecisionInput{
		Channel: ChannelPush, Category: CategoryPayment, Recipient: "user-1",
		Rendered: Rendered{Body: "Pago recibido"}, DedupeKey: "k", Now: at, Quiet: q,
	})
	if d.Delayed {
		t.Fatal("transactional push must not be deferred")
	}
}

func TestR4_QuietHours_Window(t *testing.T) {
	q := QuietHours{StartHour: 22, EndHour: 7}
	in := []int{22, 23, 0, 3, 6}
	out := []int{7, 12, 18, 21}
	for _, h := range in {
		if !q.InQuietHours(time.Date(2026, 10, 19, h, 0, 0, 0, time.UTC)) {
			t.Fatalf("expected %02d:00 inside quiet hours", h)
		}
	}
	for _, h := range out {
		if q.InQuietHours(time.Date(2026, 10, 19, h, 0, 0, 0, time.UTC)) {
			t.Fatalf("expected %02d:00 outside quiet hours", h)
		}
	}
}

// R5: una dirección suprimida no vuelve a recibir correo.
func TestR5_Suppression_BlocksEmail(t *testing.T) {
	sup := Suppression{AddressHash: HashAddress("ana@example.com"), Channel: ChannelEmail, Reason: "HARD_BOUNCE"}
	d := Decide(DecisionInput{
		Channel: ChannelEmail, Category: CategoryPayment, Recipient: "ana@example.com",
		Rendered: Rendered{Body: "Pago recibido"}, DedupeKey: "k",
		Suppressions: []Suppression{sup}, Now: time.Now(),
	})
	if !d.Suppressed || d.Reason != "HARD_BOUNCE" {
		t.Fatalf("expected suppression, got %+v", d)
	}
}

// R6: un canal corto no lleva datos sensibles.
func TestR6_ShortChannelRejectsSensitive(t *testing.T) {
	if !ContainsSensitiveData(ChannelSMS, "Tu saldo disponible es alto") {
		t.Fatal("expected sensitive marker detection in SMS")
	}
	if ContainsSensitiveData(ChannelEmail, "Tu saldo disponible es alto") {
		t.Fatal("email may carry the detail")
	}
}

func TestR6_Decide_SuppressesSensitiveShortChannel(t *testing.T) {
	d := Decide(DecisionInput{
		Channel: ChannelSMS, Category: CategoryPayment, Recipient: "+50760000000",
		Rendered: Rendered{Body: "Tu clave es 1234"}, DedupeKey: "k", Now: time.Now(),
	})
	if !d.Suppressed {
		t.Fatal("expected suppression for sensitive short channel")
	}
}

// R1/R5: el duplicado corta antes que todo lo demás.
func TestR1_Decide_DuplicateSuppresses(t *testing.T) {
	d := Decide(DecisionInput{
		Channel: ChannelEmail, Category: CategoryPayment, Recipient: "ana@example.com",
		Rendered: Rendered{Body: "Pago"}, DedupeKey: "k", AlreadySent: true, Now: time.Now(),
	})
	if !d.Suppressed || d.Reason != "DUPLICATE" {
		t.Fatalf("expected duplicate suppression, got %+v", d)
	}
}

// F20.5: la tabla R2 resuelve un evento conocido y rechaza uno desconocido.
func TestF20_5_RoutesFor_Known(t *testing.T) {
	r, err := RoutesFor("PayrollRunPaid")
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if r.Template != "payroll.paid" {
		t.Fatalf("unexpected template %s", r.Template)
	}
}

func TestF20_5_RoutesFor_UnknownEvent(t *testing.T) {
	if _, err := RoutesFor("UnknownEvent"); err == nil {
		t.Fatal("expected error for unrouted event")
	}
}

// F20.5: la tabla R2 cubre todos los eventos declarados en el SPEC §5.
func TestF20_5_RoutesFor_SpecCoverage(t *testing.T) {
	events := []string{
		"PaymentCaptured", "PaymentFailed", "RefundSucceeded", "BatchPaid", "InvoiceAccepted",
		"FolioLow", "OrderPaid", "SubOrderStatusChanged", "DeliveryStatusChanged", "StockLow",
		"PayrollRunPaid", "TenantStatusChanged", "SessionRevoked",
	}
	for _, e := range events {
		if _, err := RoutesFor(e); err != nil {
			t.Fatalf("event %s missing from R2: %v", e, err)
		}
	}
}

// F20.6: una categoría transaccional no se puede apagar en todos los canales.
func TestF20_6_TransactionalInAppRequired(t *testing.T) {
	p := NewPreferences()
	p.Set("u1", CategoryPayment, ChannelEmail, false)
	p.Set("u1", CategoryPayment, ChannelPush, false)
	if err := ValidatePreferencesSettings(p, "u1", CategoryPayment, ChannelInApp, false); err != ErrTransactionalInAppReq {
		t.Fatalf("expected ErrTransactionalInAppReq, got %v", err)
	}
}

// F20.6: apagar marketing sí se permite en cualquier canal.
func TestF20_6_MarketingCanBeDisabled(t *testing.T) {
	p := NewPreferences()
	p.Set("u1", "MARKETING", ChannelEmail, true)
	if err := ValidatePreferencesSettings(p, "u1", "MARKETING", ChannelEmail, false); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	p.Set("u1", "MARKETING", ChannelEmail, false)
	if p.Allowed("u1", "MARKETING", ChannelEmail) {
		t.Fatal("expected disabled after Set")
	}
}

// F20.6: seguridad no se desactiva con marketing.
func TestF20_6_SecurityIndependent(t *testing.T) {
	p := NewPreferences()
	p.Set("u1", "MARKETING", ChannelPush, false)
	if !p.Allowed("u1", CategorySecurity, ChannelPush) {
		t.Fatal("security notifications must stay enabled")
	}
}

// F20.4: un token push se reasigna al último usuario que lo registra.
func TestF20_4_RegisterDevice_Reassign(t *testing.T) {
	devices := map[string]Device{}
	RegisterDevice(devices, Device{PushToken: "tok", UserID: "u1"})
	RegisterDevice(devices, Device{PushToken: "tok", UserID: "u2"})
	if devices["tok"].UserID != "u2" {
		t.Fatalf("expected reassignment to u2, got %s", devices["tok"].UserID)
	}
	got := DevicesForUser(devices, "u1")
	if len(got) != 0 {
		t.Fatalf("expected no tokens for u1, got %v", got)
	}
}

func TestF20_4_DevicesForUser_Sorted(t *testing.T) {
	devices := map[string]Device{}
	RegisterDevice(devices, Device{PushToken: "tok-b", UserID: "u1"})
	RegisterDevice(devices, Device{PushToken: "tok-a", UserID: "u1"})
	got := DevicesForUser(devices, "u1")
	if len(got) != 2 || got[0] != "tok-a" || got[1] != "tok-b" {
		t.Fatalf("unexpected tokens %v", got)
	}
}

// F20.3: la bandeja solo devuelve lo del usuario y de más reciente a más antigua.
func TestF20_3_ListInbox_OwnItemsSorted(t *testing.T) {
	items := []InboxItem{
		{ID: "1", UserID: "u1", CreatedAt: time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)},
		{ID: "2", UserID: "u2", CreatedAt: time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)},
		{ID: "3", UserID: "u1", CreatedAt: time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)},
	}
	got := ListInbox(items, "u1")
	if len(got) != 2 || got[0].ID != "3" || got[1].ID != "1" {
		t.Fatalf("unexpected inbox %+v", got)
	}
}

// F20.3: marcar leído un ítem ajeno falla (ADR 0011: el actor sale de los metadatos).
func TestF20_3_MarkRead_NotOwnItem(t *testing.T) {
	items := []InboxItem{{ID: "1", UserID: "u1"}}
	if _, err := MarkRead(items, "1", "u2", time.Now()); err == nil {
		t.Fatal("expected rejection of another user's item")
	}
}

func TestF20_3_MarkRead_OwnItem(t *testing.T) {
	items := []InboxItem{{ID: "1", UserID: "u1"}}
	at := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	out, err := MarkRead(items, "1", "u1", at)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if out[0].ReadAt == nil || !out[0].ReadAt.Equal(at) {
		t.Fatalf("expected read_at, got %+v", out[0])
	}
}

func TestF20_3_MarkRead_NotFound(t *testing.T) {
	items := []InboxItem{{ID: "1", UserID: "u1"}}
	if _, err := MarkRead(items, "missing", "u1", time.Now()); err == nil {
		t.Fatal("expected NOT_FOUND")
	}
}

// R3: el canal alternativo solo existe si la regla lo declara.
func TestR3_AlternateChannel_Declared(t *testing.T) {
	ch, ok := ShouldFallbackToAlternateChannel(ChannelWhatsApp, StatusFailed)
	if !ok || ch != ChannelSMS {
		t.Fatalf("expected SMS fallback, got %s ok=%v", ch, ok)
	}
	if _, ok := ShouldFallbackToAlternateChannel(ChannelEmail, StatusSent); ok {
		t.Fatal("no fallback on success")
	}
}
