# SPEC — payroll

## 1. Responsabilidad
**Hace**: empleados, turnos y horarios, marcaje de asistencia (rostro en dispositivo, PIN, QR dinámico, NFC, huella, anulación por gerente), modo quiosco, cálculo de nómina, aprobación y pago a wallets de empleados, comprobantes de pago.
**No hace**: mover dinero (payments-core/ledger T10), guardar datos sensibles en claro (security cifra cédulas y plantillas biométricas), contabilidad laboral completa (CSS/ISR en detalle: **Q-13**).

## 2. Ficha
Go · 50070 · `payroll.proto` · esquema `payroll` · object-storage (comprobantes PDF) · Fase F19 · Capa L4.

## 3. Modelo de datos
```sql
CREATE TABLE payroll.employees (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid, full_name text NOT NULL,
  national_id_ciphertext bytea, national_id_key_version text, position text, pay_type text NOT NULL, -- SALARY|HOURLY
  base_salary_minor bigint, hourly_rate_minor bigint, pay_frequency text NOT NULL, payout_party_id uuid,
  geofence_id uuid, pin_hash bytea, active boolean NOT NULL DEFAULT true, hired_on date, version int NOT NULL DEFAULT 1);
CREATE TABLE payroll.biometric_templates (employee_id uuid PRIMARY KEY, ciphertext bytea NOT NULL, key_version text NOT NULL,
  consent_at timestamptz NOT NULL, enrolled_by uuid NOT NULL);       -- embedding facial calculado en el dispositivo
CREATE TABLE payroll.shifts (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, start_local time NOT NULL,
  end_local time NOT NULL, break_minutes int NOT NULL DEFAULT 0, grace_minutes int NOT NULL DEFAULT 5);
CREATE TABLE payroll.schedule (employee_id uuid, work_date date, shift_id uuid NOT NULL, PRIMARY KEY (employee_id, work_date));
CREATE TABLE payroll.attendance (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, employee_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('IN','OUT','BREAK_START','BREAK_END')), method smallint NOT NULL,
  recorded_at timestamptz NOT NULL, location geography(Point), inside_geofence boolean, device_id text,
  client_txn_id uuid UNIQUE, override_reason text, override_by uuid, needs_review boolean NOT NULL DEFAULT false)
  PARTITION BY RANGE (recorded_at);
CREATE TABLE payroll.kiosk_sessions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid, device_label text,
  token_hash bytea NOT NULL, created_by uuid NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz);
CREATE TABLE payroll.runs (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  status smallint NOT NULL, totals jsonb, approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL,
  version int NOT NULL DEFAULT 1, UNIQUE (tenant_id, period_start, period_end));
CREATE TABLE payroll.payslips (id uuid PRIMARY KEY, run_id uuid NOT NULL, employee_id uuid NOT NULL,
  gross_minor bigint NOT NULL, deductions jsonb NOT NULL, net_minor bigint NOT NULL CHECK (net_minor >= 0),
  hours jsonb NOT NULL, payment_intent_id uuid, status text NOT NULL, pdf_object_key text, UNIQUE (run_id, employee_id));
-- + outbox, idempotency_keys
```

## 4. RPCs
| RPC | Permiso | Comportamiento clave |
|---|---|---|
| UpsertEmployee / GetEmployee / ListEmployees | `payroll:employee:manage` / `:read` | cédula → `security.Encrypt(national_id)`; nunca se devuelve completa |
| UpsertShift / AssignSchedule / ListSchedule | `payroll:employee:manage` / `:read` | |
| ClockEvent | `payroll:attendance:record` (propio) o sesión de quiosco | §5 R1–R4 |
| ListAttendance | `payroll:attendance:read` o propio | |
| EnrollBiometric | `payroll:employee:manage` + consentimiento del empleado | guarda embedding cifrado |
| CreateKioskSession | `payroll:employee:manage` | token de dispositivo de 12 h renovable; solo permite ClockEvent |
| CreatePayrollRun / GetPayrollRun / ListPayrollRuns | `payroll:run:create` / `:read` | calcula borrador §5 R5 |
| ApprovePayrollRun | `payroll:run:approve` + step-up | DRAFT → APPROVED (inmutable) |
| PayPayrollRun | `payroll:run:pay` + step-up | APPROVED → PAYING; un pago T10 por empleado vía payments-core (`payroll:<run>:<employee>`) |
| GetPayslip | `payroll:payslip:read:self` o `payroll:employee:read` | PDF |

## 5. Reglas
- **R1** Marcaje biométrico: la comparación facial se hace **en el dispositivo** contra el embedding descargado cifrado para ese quiosco/usuario; el servidor recibe método + resultado + prueba de vida firmada por la app; nunca la foto (salvo disputa, 30 días).
- **R2** QR dinámico: código rotativo cada 30 s (TOTP con secreto del quiosco) que el empleado escanea con su app; NFC: tag NDEF del quiosco con el mismo contenido firmado.
- **R3** Si el empleado tiene geocerca, `IsInside` debe ser verdadero; si no → marcaje aceptado con `needs_review=true`.
- **R4** Secuencia válida IN → (BREAK_START → BREAK_END)* → OUT; duplicados en < 60 s se ignoran (idempotentes por `client_txn_id`); anulación de gerente exige motivo y queda auditada.
- **R5** Cálculo (MVP, configurable por tenant): horas trabajadas por día según marcajes y turno; horas extra > 8 h/día o > 48 h/semana con recargo configurable (por defecto 25 %); salario fijo prorrateado por frecuencia; deducciones parametrizables (CSS, Seguro Educativo, ISR) con tasas en bps configurables — **valores legales vigentes por confirmar (Q-13)**; redondeo half-up por concepto; `net ≥ 0`.
- **R6** Pago: saldo de wallet del tenant ≥ Σ netos (si no → `INSUFFICIENT_FUNDS` antes de empezar); fallos individuales → PARTIALLY_FAILED con reintento solo de los fallidos.
- **R7** Comprobante PDF por empleado y notificación.
- **R8** Modo offline del quiosco: marcajes guardados localmente y sincronizados con `client_txn_id`.

## 6. Eventos
Publica `PayrollRunPaid`, `AuditRecorded`. Consume `PaymentCaptured/Failed` (estado de cada pago de nómina), `GeofenceCrossed` (opcional: recordatorio de marcaje).

## 7. Dependencias
payments-core (CreatePaymentIntent WALLET tenant→empleado), security (Encrypt/Decrypt), geolocation (IsInside), identity (usuario del empleado).

## 11. Pruebas de aceptación
Quincena con horas extra: cálculo coincide con hoja de referencia; pago de 10 empleados con 1 fallo → PARTIALLY_FAILED y reintento solo de ese.

## 12. Plan
F19.1 empleados (cifrado) → F19.2 turnos/horarios → F19.3 marcaje PIN/QR/NFC + geocerca → F19.4 biometría + quiosco → F19.5 cálculo → F19.6 aprobación/pago → F19.7 comprobantes → F19.8 pantallas Flutter (empleados, horarios, marcaje, quiosco, nómina, mis comprobantes).
