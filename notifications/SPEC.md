# SPEC — notifications

## 1. Responsabilidad
**Hace**: único contenedor que envía mensajes: correo (Resend como proveedor principal, SMTP como alternativa OSS), push (FCM/APNs; UnifiedPush para Linux/escritorio), SMS (proveedor por configurar), WhatsApp vía Jelou, bandeja in-app en tiempo real; plantillas versionadas por idioma; preferencias por usuario; reintentos y rebotes.
**No hace**: decidir *cuándo* notificar un hecho de negocio (los productores publican eventos; aquí hay reglas de suscripción), guardar contactos (los pide a identity).

## 2. Ficha
Go · 50071 · `notifications.proto` · esquema `notifications` · object-storage (adjuntos) · Fase F20 · Capa L3.

## 3. Modelo de datos
```sql
CREATE TABLE notifications.templates (id uuid PRIMARY KEY, tenant_id uuid,     -- NULL = plantilla de plataforma
  key text NOT NULL, channel text NOT NULL, locale text NOT NULL, version int NOT NULL,
  subject text, body text NOT NULL, active boolean NOT NULL, UNIQUE (tenant_id, key, channel, locale, version));
CREATE TABLE notifications.messages (id uuid PRIMARY KEY, tenant_id uuid, recipient_user_id uuid, channel text NOT NULL,
  template_key text NOT NULL, template_version int NOT NULL, status text NOT NULL,   -- QUEUED|SENT|DELIVERED|FAILED|SUPPRESSED
  provider text, provider_message_id text, attempts smallint NOT NULL DEFAULT 0, last_error text,
  dedupe_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL, sent_at timestamptz) PARTITION BY RANGE (created_at);
CREATE TABLE notifications.inbox (id uuid PRIMARY KEY, user_id uuid NOT NULL, tenant_id uuid, title text NOT NULL, body text NOT NULL,
  deep_link text, category text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL);
CREATE INDEX inbox_user ON notifications.inbox (user_id, created_at DESC);
CREATE TABLE notifications.devices (id uuid PRIMARY KEY, user_id uuid NOT NULL, platform text NOT NULL, push_token text NOT NULL UNIQUE,
  app_version text, last_seen_at timestamptz NOT NULL);
CREATE TABLE notifications.preferences (user_id uuid, category text, channel text, enabled boolean NOT NULL,
  PRIMARY KEY (user_id, category, channel));
CREATE TABLE notifications.suppressions (address_hash bytea PRIMARY KEY, channel text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL);
-- + processed_events
```

## 4. RPCs
| RPC | Llamador / permiso | Comportamiento |
|---|---|---|
| Send / SendBatch | servicios internos | `dedupe_key` obligatorio; resuelve contactos (identity.GetUserContacts), preferencias, plantilla, canal; encola |
| GetNotification | servicios / plataforma | |
| ListInbox / MarkRead / StreamInbox | propio usuario | |
| RegisterDevice / UnregisterDevice | propio usuario | un token push pertenece a un solo usuario (reasignación al último) |
| GetPreferences / SetPreferences | propio usuario | categorías transaccionales (pagos, seguridad) no se pueden desactivar en todos los canales: al menos in-app |
| UpsertTemplate / ListTemplates | `notifications:template:manage` (tenant) / plataforma | variables validadas contra esquema de la plantilla; vista previa |
| HandleInboundWebhook | gateway | rebotes/quejas de correo → supresión; mensajes entrantes de WhatsApp (Jelou) → evento para soporte (F25) |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-12, N-CON-10 y el consentimiento de mercadeo de N-DAT-02. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Idempotencia por `dedupe_key` (p. ej. `payment-captured:<payment_id>:<user_id>:email`).
- **R2** Reglas de suscripción (tabla de código revisada en este SPEC):

| Evento | Destinatarios | Canales | Plantilla |
|---|---|---|---|
| `PaymentCaptured` | pagador, comercio | in-app, push, correo (recibo) | `payment.captured` |
| `PaymentFailed` | pagador | in-app, push | `payment.failed` |
| `PaymentUnknown` (> 15 min) | plataforma (soporte) | correo interno | `ops.payment_unknown` |
| `RefundSucceeded` | pagador | in-app, push, correo | `refund.succeeded` |
| `BatchPaid` | dueño del comercio | in-app, correo | `settlement.paid` |
| `InvoiceAccepted` | cliente con correo | correo con PDF | `invoice.issued` |
| `FolioLow` | dueño, contador | in-app, correo | `fiscal.folio_low` |
| `OrderPaid` | comprador; comercios (nuevo pedido) | in-app, push | `order.paid` / `merchant.new_order` |
| `SubOrderStatusChanged` | comprador | in-app, push | `order.status` |
| `DeliveryStatusChanged` | comprador (con link público) | push, WhatsApp (opt-in), SMS fallback | `delivery.status` |
| `StockLow` | dueño, almacenista | in-app | `inventory.low` |
| `PayrollRunPaid` | empleados | push, correo (comprobante) | `payroll.paid` |
| `TenantStatusChanged` | dueño | correo, in-app | `business.status` |
| `SessionRevoked` (REFRESH_REUSE) | usuario | correo, push | `security.session_revoked` |
| Solicitudes de identity (reset, invitación, bienvenida, bloqueo) | usuario | correo | `auth.*` |

- **R3** Reintentos con backoff (1 min, 5 min, 30 min, 2 h) hasta 4; luego FAILED; canal alternativo si la regla lo define.
- **R4** Horario silencioso 22:00–07:00 (Panamá) para push no transaccionales.
- **R5** Direcciones suprimidas (rebote duro/queja) no reciben correo.
- **R6** Plantillas sin datos sensibles (sin saldos completos en SMS/WhatsApp; montos sí).
- **R7** Proveedores por interfaz (`EmailSender`, `PushSender`, `SmsSender`, `WhatsAppSender`); sin credenciales → modo log (no envía, registra) y la UI de plataforma lo muestra.

## 6. Eventos
Consume los de R2. No publica eventos de negocio (solo `AuditRecorded` de cambios de plantillas).

## 7. Dependencias
identity (GetUserContacts; 1 s, caché 5 min). Proveedores externos por HTTPS (egress controlado).

## 11. Pruebas de aceptación
Mismo evento entregado 3 veces por NATS → 1 correo; rebote duro → siguiente envío SUPPRESSED; preferencias desactivan push de marketing pero no de seguridad.

## 12. Plan
F20.1 plantillas + render → F20.2 correo (Resend/SMTP) → F20.3 bandeja + stream → F20.4 push + dispositivos → F20.5 reglas de suscripción (consumidores) → F20.6 preferencias/supresiones → F20.7 WhatsApp (Jelou) y SMS → F20.8 pantallas Flutter (bandeja, preferencias, plantillas).

## 13. Riesgos
Q-14 (contrato y API de Jelou; proveedor de SMS en Panamá).
