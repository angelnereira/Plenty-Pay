# SPEC — security

## 1. Responsabilidad
**Hace**: custodia de secretos (sobre **OpenBao**, fork OSS de Vault), cifrado por propósito (envelope encryption con transit), registro de auditoría encadenado e inmutable, reporte y bloqueo por abuso (IPs, cuentas, velocidad), emisión de certificados de servicio para mTLS (SPIFFE).
**No hace**: autenticación de usuarios (identity), lógica de negocio.

## 2. Ficha
Unidad de despliegue con 2 procesos (ADR 0016): servicio Go (50073) + OpenBao (8200, solo red `data`). `security.proto`. Esquema `security`. Fase F05 (base), F28 (endurecimiento). Capa L1.

## 3. Modelo de datos
- OpenBao: KV v2 en `secret/plentypay/<ámbito>/<nombre>`; transit con llaves por propósito (`national_id`, `payout_destination`, `biometric_template`, `tax_id`, `pac_credentials`); PKI para certificados de servicio (TTL 24 h).
- PostgreSQL `security.audit_events (seq bigserial, id uuid, occurred_at, tenant_id, actor_user_id, actor_service, action, resource_type, resource_id, result, ip, user_agent, request_id, details jsonb, prev_hash bytea, hash bytea)` — append-only (sin UPDATE/DELETE por permisos y trigger), particionada por mes.
- `security.secret_acl (name, allowed_readers text[])`, `security.blocks (subject, kind, until, reason)`, `security.security_events` (ventana 30 días).

## 4. RPCs
| RPC | Llamador | Comportamiento | Errores (`reason`) |
|---|---|---|---|
| GetSecret | solo contenedores en `allowed_readers` (SAN mTLS) | devuelve valor; cada lectura auditada | `NOT_FOUND` |
| PutSecret / RotateSecret / ListSecrets | servicios dueños (fiscal, payments-core por tenant) y plataforma | ListSecrets solo metadatos | `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| Encrypt / Decrypt / RotateDataKey | servicios autorizados por propósito (tabla §5 R3) | ciphertext + `key_version`; Decrypt con AAD = `tenant_id|resource_id` | `UNKNOWN_KEY_PURPOSE`, `AAD_MISMATCH`, `IDEMPOTENCY_KEY_REUSED` |
| AppendAuditEvent / QueryAuditEvents / VerifyAuditChain | gateway; plataforma (`platform:security:read`); dueño del tenant (`admin:audit:read`, filtrado a su tenant) | §5 R4 | `IDEMPOTENCY_KEY_REUSED` |
| ReportSecurityEvent / IsBlocked | identity, gateway, payments-core | reglas de bloqueo §5 R5 | `UNKNOWN_EVENT_KIND`, `IDEMPOTENCY_KEY_REUSED`; motivos de bloqueo en `IsBlockedResponse.reason`: `LOGIN_FAILED`, `TOKEN_REUSE`, `VELOCITY_EXCEEDED` |
| IssueServiceCertificate | contenedores al arrancar (token de bootstrap de un solo uso) | CSR → certificado SPIFFE 24 h | `BOOTSTRAP_TOKEN_INVALID`, `IDEMPOTENCY_KEY_REUSED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-AML-05, N-AML-06, N-AML-07, N-DAT-01, N-DAT-04, N-DAT-08, N-DAT-09, N-DAT-10 y N-COM-05. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Ningún secreto en logs ni respuestas de error; valores en memoria con borrado al liberar donde el lenguaje lo permita.
- **R2** ACL por secreto: `fiscal/<tenant>/pac` → fiscal-invoicing; `rails/<rail>/*` → payments-core; `bank/*` → settlement; `jwt/*` → identity; `smtp|resend|push|jelou/*` → notifications.
- **R3** Propósitos de cifrado: `national_id` (payroll, identity), `payout_destination` (settlement), `biometric_template` (payroll), `tax_id` (identity), `pac_credentials` (security interno).
- **R4** Auditoría: `hash = sha256(prev_hash || canonical(event))`; un solo escritor serializado por partición lógica; `VerifyAuditChain` recalcula; corte → alerta crítica. Consume `pp.audit.*.recorded.v1` (idempotente por `event_id`).
- **R5** Bloqueos: 20 `LOGIN_FAILED` por IP en 10 min → bloqueo IP 1 h; `TOKEN_REUSE` → alerta + bloqueo de la cuenta hasta reset; `WEBHOOK_BAD_SIGNATURE` > 10/min de un proveedor → alerta; velocidad de pagos anómala por pagador (configurable) → bloqueo de pagos 1 h y revisión.
- **R6** OpenBao: auto-unseal con KMS del proveedor o Shamir 3-de-5 en self-hosted (custodios documentados en runbook); auditoría de OpenBao a archivo enviado a Loki.
- **R7** Rotación: llaves transit cada 90 días (versiones antiguas solo para descifrar); re-cifrado perezoso al escribir.

## 6. Eventos
Consume `pp.audit.>`. Publica alertas de seguridad como `AuditRecorded` con `action=security.*`.

## 11. Pruebas de aceptación
Un contenedor no listado no puede leer un secreto (PERMISSION_DENIED); alterar un registro de auditoría en la BD hace fallar `VerifyAuditChain`; Encrypt/Decrypt con AAD distinto falla.

## 12. Plan
F05.1 OpenBao en compose (dev mode solo local) → F05.2 servicio Go GetSecret/PutSecret con ACL → F05.3 Encrypt/Decrypt → F05.4 auditoría encadenada + consumidor → F05.5 ReportSecurityEvent/IsBlocked → F05.6 PKI + mTLS en identity y gateway → F28 unseal productivo, rotaciones, pentest.
