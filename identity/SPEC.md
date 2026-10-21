# SPEC — identity

## 1. Responsabilidad
**Hace**: cuentas de usuario, negocios (tenants) y su ciclo de vida, sesiones y tokens, roles y permisos, invitaciones de staff, recuperación de contraseña, passkeys, confirmación fuerte (step-up), contactos para notificaciones.
**No hace**: guardar secretos de terceros (security), enviar correos (notifications — identity publica la intención), KYB documental pesado (archivos en object-storage; identity guarda referencias).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto gRPC / admin | 50060 / 9100 |
| Contrato | `identity.proto` (`plentypay.identity.v1`) |
| Esquema PostgreSQL | `identity` (rol `identity_svc`) |
| Otros almacenes | NATS (publica); object-storage (documentos KYB, vía URL prefirmada emitida por el gateway) |
| Fase | F08 (núcleo), F05 (step-up/mTLS), F28 (passkeys) |
| Capa de arranque | L2 |

**Estado actual**: implementados Register (con consentimientos R18 y `reason` estable en cada rechazo), Login, ValidateToken, GetUserPermissions (con catálogo de permisos, presets y derivación de módulos R10/R12), RefreshToken con almacén **en memoria** (`internal/store`). Todo lo demás de este SPEC es objetivo.

## 3. Modelo de datos
```sql
CREATE TABLE identity.users (
  id uuid PRIMARY KEY, email text NOT NULL, email_verified_at timestamptz,
  password_hash text NOT NULL,                 -- bcrypt; prefijo indica algoritmo
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 1 AND 120),
  phone_e164 text, base_role text NOT NULL,    -- PLATFORM_ADMIN|BUSINESS_OWNER|BUSINESS_STAFF|CUSTOMER
  tenant_id uuid REFERENCES identity.tenants(id), role_id uuid REFERENCES identity.roles(id),
  status text NOT NULL DEFAULT 'ACTIVE',       -- ACTIVE|DEACTIVATED|LOCKED
  failed_logins int NOT NULL DEFAULT 0, locked_until timestamptz,
  locale text NOT NULL DEFAULT 'es_PA', created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  version int NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX users_email_lower ON identity.users (lower(email));
CREATE INDEX users_tenant ON identity.users (tenant_id) WHERE tenant_id IS NOT NULL;

CREATE TABLE identity.tenants (
  id uuid PRIMARY KEY, legal_name text NOT NULL, trade_name text NOT NULL,
  ruc text NOT NULL, dv text NOT NULL, status text NOT NULL,   -- TenantStatus
  owner_user_id uuid NOT NULL, review_notes text, reviewed_by uuid, reviewed_at timestamptz,
  primary_vertical text NOT NULL DEFAULT 'general_commercial',  -- clave de identity.verticals (validada en el servicio)
  secondary_verticals text[] NOT NULL DEFAULT '{}',              -- máximo 2
  trait_overrides jsonb NOT NULL DEFAULT '{}',                   -- respuestas explícitas del dueño {"tips": false}
  plan_code text NOT NULL DEFAULT 'standard',                    -- plan único del piloto (Q-29)
  kyb_documents jsonb NOT NULL DEFAULT '[]',   -- [{kind, object_key, uploaded_at}]
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX tenants_ruc ON identity.tenants (ruc, dv);

CREATE TABLE identity.verticals (       -- catálogo de plataforma (0007); copia ejecutable: auth.AllVerticals
  key text PRIMARY KEY, family text NOT NULL, default_traits text[] NOT NULL,
  suggested_capabilities text[] NOT NULL, role_template_keys text[] NOT NULL,
  version int NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL
);

CREATE TABLE identity.tenant_capabilities (
  tenant_id uuid NOT NULL REFERENCES identity.tenants(id), capability text NOT NULL, enabled boolean NOT NULL,
  source text NOT NULL CHECK (source IN ('VERTICAL','TRAIT','MANUAL','PLAN')),
  changed_by uuid, changed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, capability)
);
-- Cambiar el perfil recalcula solo las filas VERTICAL/TRAIT; MANUAL (decisión del dueño) y PLAN se conservan.
-- 0007 siembra a los negocios previos todas las capacidades salvo las sujetas a Q-21/Q-32/Q-33 (source PLAN).

CREATE TABLE identity.branches (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES identity.tenants(id),
  code text NOT NULL,                       -- 4 dígitos DGI; "0000" = casa matriz (validado en domain)
  name text NOT NULL, address text NOT NULL DEFAULT '',
  latitude_e6 int NOT NULL DEFAULT 0, longitude_e6 int NOT NULL DEFAULT 0, opening_hours_json text NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, code)
);
-- El tipo de sucursal (kind) de la propuesta original no está en el contrato (Branch del .proto): se agrega
-- de forma aditiva cuando una pantalla lo pida.

CREATE TABLE identity.roles (
  id uuid PRIMARY KEY, tenant_id uuid,          -- NULL = preset de plataforma
  name text NOT NULL, permissions text[] NOT NULL, is_preset bool NOT NULL DEFAULT false,
  template_key text NOT NULL DEFAULT '', template_version int NOT NULL DEFAULT 1, description text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, name)
);

CREATE TABLE identity.memberships (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES identity.users(id),
  tenant_id uuid NOT NULL REFERENCES identity.tenants(id),
  base_role text NOT NULL CHECK (base_role IN ('BUSINESS_OWNER','BUSINESS_STAFF')),
  role_id uuid REFERENCES identity.roles(id),
  scope text NOT NULL CHECK (scope IN ('TENANT','BRANCHES')),
  job_title text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','DEACTIVATED')),
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE (user_id, tenant_id)
);
CREATE UNIQUE INDEX memberships_one_active_uidx ON identity.memberships (user_id) WHERE status = 'ACTIVE'; -- MVP, Q-31
-- Las invitaciones pendientes viven en identity.invitations (scope, branch_ids, job_title, revoked_at); la
-- membresía nace ACTIVE al aceptar. users.status (ACTIVE|SUSPENDED|DEACTIVATED) y user_roles se mantienen
-- sincronizados con la membresía como lectura de compatibilidad hasta retirarlos.

CREATE TABLE identity.membership_branches (
  membership_id uuid NOT NULL REFERENCES identity.memberships(id),
  branch_id uuid NOT NULL REFERENCES identity.branches(id),
  PRIMARY KEY (membership_id, branch_id)
);
CREATE TABLE identity.consents (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES identity.users(id),
  purpose text NOT NULL,                      -- AGE_CONFIRMATION|TERMS|PRIVACY_DATA_PROCESSING|MARKETING
  text_version text NOT NULL,                 -- versión del texto que la persona vio
  granted bool NOT NULL,                      -- false = revocación o no concedido
  recorded_at timestamptz NOT NULL,           -- la pone el servidor, nunca el cliente
  channel text NOT NULL, device text NOT NULL -- los fija el gateway (N-DAT-02)
);
CREATE INDEX consents_user ON identity.consents (user_id, purpose, recorded_at DESC);
-- Un consentimiento no se borra ni se actualiza: revocar agrega una fila nueva con granted=false.

CREATE TABLE identity.sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, family_id uuid NOT NULL,
  refresh_hash bytea NOT NULL,                  -- sha256 del refresh vigente
  device_label text, ip inet, user_agent text,
  created_at timestamptz NOT NULL, last_used_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, revoke_reason text
);
CREATE INDEX sessions_user ON identity.sessions (user_id) WHERE revoked_at IS NULL;
CREATE TABLE identity.used_refresh_tokens (hash bytea PRIMARY KEY, family_id uuid NOT NULL, used_at timestamptz NOT NULL);
CREATE TABLE identity.invitations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, email text NOT NULL, role_id uuid NOT NULL,
  token_hash bytea NOT NULL, expires_at timestamptz NOT NULL, accepted_at timestamptz, invited_by uuid NOT NULL);
CREATE TABLE identity.password_resets (id uuid PRIMARY KEY, user_id uuid NOT NULL, token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL, used_at timestamptz);
-- Confirmación fuerte y passkeys (ADR 0020, migración 0011_strong_auth; RLS por app.user_id)
CREATE TABLE identity.passkeys (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES identity.users(id),
  credential_id bytea UNIQUE NOT NULL, public_key bytea NOT NULL, sign_count bigint NOT NULL, aaguid uuid,
  transports text[] NOT NULL DEFAULT '{}', backup_eligible boolean NOT NULL, backup_state boolean NOT NULL,
  device_label text NOT NULL, created_at timestamptz NOT NULL, last_used_at timestamptz, revoked_at timestamptz);
CREATE TABLE identity.webauthn_challenges (id uuid PRIMARY KEY, user_id uuid,   -- NULL: inicio de sesión sin correo
  purpose text NOT NULL,                                                          -- REGISTER | LOGIN | STEP_UP
  challenge bytea NOT NULL, session_data jsonb NOT NULL, operation text, amount_minor bigint, currency char(3),
  expires_at timestamptz NOT NULL, consumed_at timestamptz);
CREATE TABLE identity.step_up_tokens (token_hash bytea PRIMARY KEY, user_id uuid NOT NULL, operation text NOT NULL,
  amount_minor bigint NOT NULL, currency text NOT NULL, method text NOT NULL,       -- PASSKEY | PIN | PASSWORD
  expires_at timestamptz NOT NULL, consumed_at timestamptz);
CREATE TABLE identity.step_up_pins (user_id uuid PRIMARY KEY REFERENCES identity.users(id), pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0, locked_until timestamptz, updated_at timestamptz NOT NULL);
ALTER TABLE identity.sessions ADD COLUMN auth_method text NOT NULL DEFAULT 'password';   -- password | passkey
-- + idempotency_keys, outbox (data-standards.md §6)
```
RLS: `users`, `roles`, `invitations` por `tenant_id`; consultas de plataforma con rol `identity_platform` auditado.

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores (`reason`) |
|---|---|---|---|---|
| Register | público (vía gateway) | no | crea `CUSTOMER`; el gateway fuerza el rol (R6), el canal y el dispositivo; valida y registra los consentimientos (R18) | `INVALID_EMAIL`, `WEAK_PASSWORD`, `EMAIL_TAKEN`, `CONSENT_REQUIRED`, `AGE_REQUIREMENT` |
| Login | público | no | verifica contraseña, bloqueo progresivo, crea sesión, devuelve access+refresh | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_SUSPENDED` |
| ValidateToken | servicio (gateway) | — | valida access token: firma, exp, algoritmo, sesión no revocada; devuelve además `permissions`, `branch_scope` y `capabilities` calculados **ahora** (no los del momento de emisión), que el gateway propaga como `x-pp-*` | `TOKEN_INVALID` |
| GetUserPermissions | servicio / self | — | rol base + rol asignado + capacidades + alcance → `permissions`, `modules`, `branch_scope`, `capabilities` (R10, R21, R22, R24). Esta lectura (y la de ValidateToken) usa una caché por usuario de 15 s —el mismo plazo de R9— que cada mutación de acceso de la instancia vacía; otra réplica ve el cambio al vencer el TTL. Las verificaciones A1–A3 leen siempre el estado fresco | `NOT_FOUND` |
| RefreshToken | público | — | rota refresh; reuso ⇒ revoca familia y publica `SessionRevoked` | `TOKEN_INVALID`, `TOKEN_REUSED` |
| Logout | self | sí | revoca la sesión actual (o todas con `all=true`) | — |
| ListSessions / RevokeSession | self | — / sí | dispositivos con sesión; revocar una | `NOT_FOUND` |
| ChangePassword | self + step-up | sí | verifica actual, aplica política, revoca otras sesiones | `INVALID_CREDENTIALS`, `WEAK_PASSWORD`, `STEP_UP_REQUIRED` |
| RequestPasswordReset | público | — | siempre `ok=true`; si existe, outbox → notifications envía enlace `/reset/<token>` | — |
| ConfirmPasswordReset | público | sí | token válido 30 min, un uso; revoca todas las sesiones | `TOKEN_INVALID` |
| CreateBusiness | usuario autenticado sin tenant | sí | crea tenant `PENDING_REVIEW`, membresía `BUSINESS_OWNER` alcance `TENANT`, sucursal matriz `0000` (nombre `branch_name`, «Casa Matriz» por defecto) y las capacidades del perfil (vertical vacía = `general_commercial`) en 1 transacción | `ALREADY_HAS_TENANT`, `RUC_TAKEN`, `INVALID_RUC`, `VERTICAL_NOT_FOUND`, `INVALID_REQUEST` |
| ReviewBusiness | `platform:tenants:review` | sí | transición de estado §8.15; publica `TenantStatusChanged` | `INVALID_STATE_TRANSITION` |
| GetTenant | miembro del tenant / plataforma | — | datos del tenant | `NOT_FOUND` |
| ListTenants | `platform:tenants:review` | — | filtro por estado, paginado | — |
| ListVerticals | público / autenticado | — | catálogo de verticales, familias, rasgos y sugerencias | — |
| ListRoleTemplates | público / autenticado | — | plantillas de roles universales y por vertical | — |
| GetBusinessProfile | `admin:business:manage` / miembro | — | perfil comercial, verticales y rasgos operativos | `NOT_FOUND` |
| UpdateBusinessProfile | `admin:business:manage` | sí | actualiza verticales y rasgos sin borrar datos ni roles; recalcula las capacidades de perfil y conserva las `MANUAL` | `NOT_FOUND`, `VERTICAL_NOT_FOUND`, `INVALID_REQUEST` |
| SetCapabilities | `admin:business:manage` (+ step-up al apagar `finance.*` o `payroll.*`) | sí | activa/desactiva capacidades dentro del plan (`source = MANUAL`); encender una capacidad sujeta a pregunta abierta (Q-21, Q-32, Q-33) responde `CAPABILITY_DISABLED` | `CAPABILITY_DISABLED`, `PLAN_LIMIT_REACHED`, `INVALID_REQUEST`, `STEP_UP_REQUIRED` |
| UpsertBranch | `admin:business:manage` + alcance `TENANT` | sí | crea/actualiza sucursal (código DGI 4 dígitos) | `BRANCH_CODE_TAKEN`, `INVALID_BRANCH_CODE`, `INVALID_REQUEST`, `BRANCH_OUT_OF_SCOPE` |
| ListBranches | miembro del tenant | — | sucursales del comercio (`include_inactive`); con alcance `BRANCHES`, solo las propias | — |
| DeactivateBranch / ReactivateBranch | `admin:business:manage` | sí | desactiva (o reactiva) una sucursal; no permite desactivar la única activa; las membresías con alcance `BRANCHES` conservan el vínculo | `NOT_FOUND`, `CANNOT_DEACTIVATE_LAST_BRANCH` |
| InviteStaff | `admin:users:manage` (+ step-up si el rol mueve dinero) | sí | invitación con rol, alcance y cargo; valida A1 y A3; el token **no** vuelve al invitador: viaja solo en la solicitud de correo del outbox | `ROLE_NOT_FOUND`, `PERMISSION_NOT_HELD`, `BRANCH_OUT_OF_SCOPE`, `PLAN_LIMIT_REACHED`, `INVALID_EMAIL`, `INVALID_REQUEST`, `STEP_UP_REQUIRED` |
| PreviewInvitation | público con token | — | S-GEN-17: correo invitado, negocio, rol, alcance (nombres de sucursal), estado y si el correo ya tiene cuenta | `TOKEN_INVALID` |
| AcceptInvitation | público con token | sí | activa membresía del usuario: si el correo ya es un cliente, entra con **su** contraseña y conserva su cuenta (H8); si no, crea la cuenta de staff con sus aceptaciones (R18: mismas reglas y `reason` que el registro, guardadas en la misma transacción con canal `invitation`) | `TOKEN_INVALID`, `ALREADY_USED`, `INVALID_CREDENTIALS`, `WEAK_PASSWORD`, `ALREADY_HAS_TENANT`, `AGE_REQUIREMENT`, `CONSENT_REQUIRED` |
| UpdateMembership | `admin:users:manage` (+ step-up si suma permisos de dinero) | sí | actualiza rol, alcance y cargo de un miembro (vacío = no cambia; cargo `-` = borrar); valida A1–A3; la membresía del dueño no se edita aquí | `NOT_FOUND`, `ROLE_NOT_FOUND`, `PERMISSION_NOT_HELD`, `SELF_ASSIGNMENT_FORBIDDEN`, `BRANCH_OUT_OF_SCOPE`, `PERMISSION_DENIED`, `INVALID_REQUEST`, `STEP_UP_REQUIRED` |
| ListUsers / DeactivateUser | `admin:users:manage` | — / sí | staff del tenant **del token** (el `tenant_id` del cuerpo se ignora, ADR 0011) con rol, alcance, cargo y estado; con alcance `BRANCHES` solo su gente; desactivar es la baja del equipo, revoca sesiones y publica `SessionRevoked`; solo un dueño da de baja a otro dueño | `NOT_FOUND`, `CANNOT_DEACTIVATE_OWNER`, `SELF_ASSIGNMENT_FORBIDDEN`, `BRANCH_OUT_OF_SCOPE`, `PERMISSION_DENIED` |
| SuspendUser / ReactivateUser | `admin:users:manage` | sí | bloqueo temporal reversible (`SUSPENDED`): revoca sesiones y el login responde `ACCOUNT_SUSPENDED`; reactivar vuelve a `ACTIVE` (también reactiva a un `DEACTIVATED`) | `NOT_FOUND`, `CANNOT_DEACTIVATE_OWNER`, `SELF_ASSIGNMENT_FORBIDDEN` |
| ListInvitations / RevokeInvitation / ResendInvitation | `admin:users:manage` | — / sí / sí | invitaciones pendientes del negocio; revocar invalida el token; reenviar emite token nuevo y vuelve a publicar la solicitud de correo | `NOT_FOUND`, `ALREADY_USED` |
| GetAccessCatalog | autenticado | — | catálogo de permisos con módulo, nivel de acceso, capacidad asociada y marca de dinero 🔒, orden de módulos y capacidades conocidas; lo usa el editor de roles (S-ADM-03) y S-ADM-08 sin copiar el catálogo en la app | — |
| GetUserContacts | servicio (notifications) | — | email/teléfono/locale/preferencias | `NOT_FOUND` |
| UpsertRole / ListRoles / AssignRole | `admin:roles:manage` (ListRoles también con `admin:users:manage`; + step-up si el rol **suma** permisos de dinero) | sí | roles personalizados ⊆ permisos del catálogo; presets no editables ni reutilizables como nombre; valida A1 y A2 (nadie edita el rol que tiene asignado); cada edición sube `version` y publica `RoleChanged`; tenant del token | `UNKNOWN_PERMISSION`, `PRESET_READ_ONLY`, `PERMISSION_NOT_HELD`, `SELF_ASSIGNMENT_FORBIDDEN`, `ROLE_NOT_FOUND`, `ALREADY_EXISTS`, `INVALID_REQUEST`, `STEP_UP_REQUIRED` |
| ArchiveRole | `admin:roles:manage` | sí | archiva rol; no permite si tiene miembros activos | `ROLE_IN_USE`, `NOT_FOUND` |
| Begin/FinishPasskeyRegistration | self + step-up `identity.passkey.register` (R27) | sí (Finish) | WebAuthn con verificación de usuario y llave residente; atestación `none`; publica `PasskeyRegistered` (R31) | `PASSKEYS_UNAVAILABLE`, `PASSKEY_VERIFICATION_FAILED`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID` |
| Begin/FinishPasskeyLogin | público (límite de `/v1/auth/*`) | — | correo vacío = llave residente; crea la sesión como `Login` con `auth_method=passkey` (R30) | `PASSKEYS_UNAVAILABLE`, `INVALID_CREDENTIALS` |
| ListPasskeys / RevokePasskey | self (+ step-up `identity.passkey.revoke` al revocar) | sí (Revoke) | solo las propias; revocar publica `PasskeyRevoked` | `NOT_FOUND`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID` |
| SetStepUpPin / GetStepUpPinStatus | self + step-up `identity.pin.set` (nivel 3: contraseña) | sí (Set) | 6 dígitos; hash con el esquema de la contraseña; reinicia intentos y bloqueo | `PIN_INVALID`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID` |
| IssueStepUpChallenge | self (usuario del token, R26) | — | reto persistido ligado a operación + monto + moneda; devuelve la operación, el monto, los métodos permitidos (R27) y los disponibles para la persona, y las opciones WebAuthn con sus passkeys | `UNKNOWN_OPERATION`, `INVALID_REQUEST` |
| VerifyStepUp | self, dueño del reto (R26) | — | verifica la aserción (R25, R29), el PIN (R28) o la contraseña (solo nivel 3, con el bloqueo progresivo de R5); emite token de un uso, 5 min, guardando solo su hash. El reto solo se consume con una prueba válida; `TOKEN_INVALID` (reto inexistente, vencido, usado o de otra persona) viaja como `FAILED_PRECONDITION`, no 401 | `TOKEN_INVALID`, `STEP_UP_METHOD_NOT_ALLOWED`, `PASSKEY_VERIFICATION_FAILED`, `PIN_NOT_SET`, `PIN_INVALID`, `PIN_LOCKED`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `PASSKEYS_UNAVAILABLE` |
| ConsumeStepUp | servicio | — | atómico: `UPDATE ... SET consumed_at=now() WHERE consumed_at IS NULL AND expires_at>now()`; compara operación/monto/usuario | resultado `valid=false` + reason |

**Idempotencia** (columna *Idemp.*, `grpc-conventions.md` §3): un interceptor gRPC la aplica a todo request con `idempotency_key` (16–100 caracteres) sobre la tabla estándar `idempotency_keys` (migración `0010`, RLS por tenant, purga horaria de > 72 h). Misma clave + mismo request canónico → la respuesta original sin ejecutar de nuevo; misma clave + otro contenido → `ALREADY_EXISTS` `IDEMPOTENCY_KEY_REUSED`; clave en curso → `ABORTED`; una ejecución que falla libera la clave. La reserva y el cierre van en transacciones propias porque una mutación de identity cruza varios stores: si el proceso cae entre la mutación y el cierre, la clave queda `IN_PROGRESS` y responde `ABORTED` hasta la purga (falla cerrado, nunca ejecuta dos veces). `CreateBusiness` y `AcceptInvitation` no guardan su respuesta (lleva tokens de sesión, que no se guardan en claro); ya son idempotentes por sí mismas (`ALREADY_HAS_TENANT`, `ALREADY_USED`).

## 5. Reglas de negocio
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-AML-02, N-AML-03, N-AML-04, N-AML-08, N-AML-12, N-DAT-02, N-DAT-05, N-DAT-07, N-DAT-14, N-COM-01, N-COM-06 y N-PAG-05. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Correo válido (regex simple + longitud ≤ 254), normalizado a minúsculas; único sin distinguir mayúsculas.
- **R2** Contraseña 12–128 caracteres, no en lista de comunes; bcrypt costo 12.
- **R3** Correo duplicado → `ALREADY_EXISTS` `EMAIL_TAKEN`.
- **R4** Login fallido devuelve **siempre** el mismo error y mensaje, exista o no el correo (tiempo constante: se compara contra un hash ficticio si no existe).
- **R5** Bloqueo progresivo: 5 fallos → 1 min, 10 → 15 min, 20 → 24 h + notificación; reinicia con login exitoso.
- **R6** Registro público solo crea `CUSTOMER` (el gateway lo fuerza y identity lo valida si la llamada viene del gateway).
- **R7** Access 15 min, refresh 30 días; secretos distintos ≥ 32 bytes; algoritmos explícitos.
- **R8** Refresh rotado en cada uso; presentar uno ya usado ⇒ revocar toda la familia + `SessionRevoked{reason=REFRESH_REUSE}` + `ReportSecurityEvent(TOKEN_REUSE)`.
- **R9** Un access token es inválido si su sesión está revocada (ValidateToken consulta caché de revocaciones con TTL ≤ 15 s).
- **R10** `modules` se **derivan de los permisos** (implementado en `internal/auth/permissions.go`; orden = orden de navegación de `docs/ux/screen-catalog.md` §1). Todo usuario recibe además los permisos de `CUSTOMER` (es una persona con billetera propia).

  | Módulo | Visible si tiene |
  |---|---|
  | `wallet` | algún `wallet:*` |
  | `marketplace` | `orders:create:self` u `orders:read:self` |
  | `pos` | algún `pos:*` |
  | `appointments` | algún `appointments:*` |
  | `catalog` | `catalog:write`, `catalog:import`, `catalog:listing:manage` o `catalog:pricelist:manage` |
  | `inventory` | algún `inventory:*` |
  | `orders` (del comercio) | `orders:read`, `orders:manage` u `orders:quote:manage` (no los `:self`) |
  | `logistics` | algún `logistics:*` |
  | `finance` (cobros, liquidaciones, facturas) | algún `payments:*`, `settlement:*` o `fiscal:*` |
  | `payroll` | algún `payroll:*` |
  | `analytics` | algún `analytics:*` |
  | `admin` | algún `admin:*` |
  | `platform` (consola de plataforma) | algún `platform:*` |
- **R11** Un tenant `PENDING_REVIEW` puede configurar todo excepto cobrar y publicar en marketplace (lo aplican payments-core y catalog al consumir `TenantStatusChanged` y consultando `GetTenant`).
- **R12** Roles personalizados solo pueden contener permisos del catálogo y nunca `platform:*`.
- **R13** El dueño no puede ser desactivado ni perder `admin:*` mientras sea el único dueño.
- **R14** Step-up obligatorio para las operaciones de `security-standards.md` §4 que ejecuta identity (cambio de contraseña/correo, asignar roles con permisos de dinero). identity **consume** el token (`x-pp-step-up`, cabecera HTTP `X-Step-Up-Token`) con la operación exacta con que se pidió el reto: `identity.role.upsert`, `identity.staff.invite`, `identity.membership.update`, `identity.capabilities.set` (apagar `finance.*`/`payroll.*`), `identity.password.change`, `identity.passkey.register`, `identity.passkey.revoke` e `identity.pin.set` (catálogo completo: `security-standards.md` §4.1). Sin token → `STEP_UP_REQUIRED`; token inválido, de otra operación o ya usado → `STEP_UP_INVALID`.
- **R15** Token de step-up: un solo uso, 5 min, ligado a usuario+operación+monto; consumir dos veces → `ALREADY_USED`.
- **R16** Cambiar contraseña o reset revoca todas las demás sesiones.
- **R17** RUC + DV válidos (formato DGI; algoritmo de DV en F08.6) y únicos.
- **R18** Consentimientos del registro público (N-DAT-02, N-DAT-14): obligatorios `AGE_CONFIRMATION`, `TERMS` y `PRIVACY_DATA_PROCESSING`, cada uno con la versión del texto visto; `MARKETING` es opcional y se registra también si no se concede. Se guardan con fecha del servidor, canal y dispositivo. Sin ellos no se crea la cuenta: `AGE_REQUIREMENT` si falta la confirmación de mayoría de edad, `CONSENT_REQUIRED` si faltan términos o privacidad. Una finalidad desconocida se ignora. Revocar no borra: agrega un registro con `granted=false`.
- **R19** Las contraseñas se derivan con SHA-256 + base64 antes de bcrypt costo 12 (esquema declarado en el propio hash, `sha256-bcrypt:`), porque bcrypt solo consume 72 bytes y la política permite 128 caracteres (R2).
- **R20** Perfil comercial y verticales: todo comercio registra una vertical principal y hasta 2 secundarias con sus rasgos operativos asociados. Los rasgos son personalizables en el alta o edición sin alterar la base de código de los servicios.
- **R21** Capacidades del negocio y resolución dinámica: un permiso del rol solo se concede en los permisos efectivos si **alguna** de sus capacidades asociadas (`security-standards.md` §3.1) está activa en el negocio por perfil, plan o decisión manual (salvo permisos de núcleo y plataforma). Un negocio sin capacidades registradas usa todas salvo las sujetas a preguntas abiertas. El gateway propaga `x-pp-capabilities` y los servicios deniegan invocaciones a capacidades inactivas con `FAILED_PRECONDITION` y `reason: CAPABILITY_DISABLED`.
- **R22** Asignación efectiva de roles: para usuarios `BUSINESS_STAFF`, `PermissionsForUser` resuelve exactamente los permisos del rol asignado en `memberships` (o `user_roles`) + base `CUSTOMER`. Un `BUSINESS_STAFF` sin rol asignado recibe únicamente la base `CUSTOMER` (principio deny-by-default; sin fallback al preset de cajero).
- **R23** Reglas de gobierno anti-escalada:
  - **A1**: Nadie puede crear roles ni asignar permisos que no posea en sus permisos efectivos (`PERMISSION_NOT_HELD`).
  - **A2**: Nadie puede modificar su propio rol asignado ni su propia membresía (`SELF_ASSIGNMENT_FORBIDDEN`).
  - **A3**: El alcance no puede crecer al delegar; quien posee alcance `BRANCHES` solo asigna subconjuntos de sus sucursales asignadas (`BRANCH_OUT_OF_SCOPE`).
- **R24** Alcance por sucursal (`branch_scope`): toda membresía posee alcance `TENANT` (`*`) o `BRANCHES` (UUIDs de sus sucursales **activas**, ordenados y separados por coma). El gateway propaga el metadato `x-pp-branch-scope`; un alcance `BRANCHES` sin sucursales activas viaja vacío (no se envía) y un servicio lo lee como «ninguna sucursal», nunca como «todas». Acciones fuera del alcance asignado son denegadas con `PERMISSION_DENIED` y `reason: BRANCH_OUT_OF_SCOPE`; una sucursal de otro negocio responde igual, sin revelar que existe. Una persona sin negocio recibe solo la base, sea cual sea su rol base guardado.

- **R25** Toda aserción WebAuthn se verifica en identity (firma contra la llave pública registrada, reto de un solo uso, origen en `WEBAUTHN_ORIGINS`, `rpId`, verificación de usuario). Una aserción alterada, de otro origen o de un reto ya usado → `PASSKEY_VERIFICATION_FAILED` y ningún token. Sin `WEBAUTHN_RP_ID` → `PASSKEYS_UNAVAILABLE` (ADR 0020).
- **R26** El usuario del reto, de la verificación y de `ChangePassword` sale del metadato `x-pp-user-id`; el `user_id` del cuerpo se ignora. Verificar el reto de otra persona → `TOKEN_INVALID`. `ChangePassword` **consume** el token con la operación `identity.password.change`.
- **R27** Cada operación acepta solo los métodos de `security-standards.md` §4.1; uno no listado → `STEP_UP_METHOD_NOT_ALLOWED`; una operación fuera del catálogo → `UNKNOWN_OPERATION`. La contraseña solo vale en nivel 3; el PIN nunca autoriza `identity.pin.set`.
- **R28** PIN: 6 dígitos (`PIN_INVALID` al crearlo con otro formato); sin PIN → `PIN_NOT_SET`; fallo → `PIN_INVALID` y suma un intento; al llegar a `stepup.pin.max_attempts` (3) → `PIN_LOCKED` durante `stepup.pin.lock_minutes` (5) y evento `PIN_LOCKED` a security. Un acierto reinicia el contador. Nunca se verifica en la app.
- **R29** Un contador de firmas que retrocede (cuando el guardado es > 0) se rechaza con `PASSKEY_VERIFICATION_FAILED` y evento `PASSKEY_COUNTER_REGRESSION`; contador 0 (passkeys sincronizadas) se acepta.
- **R30** Entrar con passkey crea la sesión igual que `Login` (tokens, familia de refresh) con `auth_method = passkey`; credencial desconocida o revocada → el mismo `INVALID_CREDENTIALS` de R4.
- **R31** Registrar o revocar una passkey publica `PasskeyRegistered` / `PasskeyRevoked` por el outbox en la misma transacción (notifications avisa a la persona).
- **R32** Retos y tokens viven en PostgreSQL (`webauthn_challenges`, `step_up_tokens`), no en memoria: un reinicio o una réplica los conserva. Del token solo se guarda su SHA-256; `ConsumeStepUp` es un `UPDATE … WHERE consumed_at IS NULL AND expires_at > now()` atómico.

### Vectores de prueba normativos
| Vector | Caso de prueba | Regla verificada | Prueba |
|---|---|---|---|
| **V1** | Persona sin negocio | R10 | `TestR10_CustomerOnly` |
| **V2** | Dueño con inventario y logística apagados | R21 | `TestR21_OwnerLimitedByCapabilities` |
| **V3** | Barbero con plantilla stylist en sucursal específica | R24 | `TestR24_StylistBranchScope` |
| **V4** | Rol con capacidad apagada temporalmente | R21 | `TestR21_DisabledCapabilityDropsPermission` |
| **V5** | Cajero de tenant en `PENDING_REVIEW` | R11 | `TestR11_PendingTenantKeepsPermissions` |
| **V6** | Staff con rol personalizado asignado | R22 | `TestR22_AssignedCustomRoleResolves` |
| **V7** | Delegación que expande alcance de sucursal | R23 (A3) | `TestR23_ScopeCannotGrow` |
| **V8** | Delegación de permiso no poseído | R23 (A1) | `TestR23_CannotGrantUnheldPermission` |
| **V9** | Auto-modificación de propio rol o membresía | R23 (A2) | `TestR23_NoSelfEscalation` |

## 6. Eventos
Publica: `pp.identity.tenant.status_changed.v1` (`TenantStatusChanged`), `pp.identity.session.revoked.v1` (`SessionRevoked`), `pp.identity.role.changed.v1`, `pp.identity.membership.changed.v1`, `pp.identity.capabilities.changed.v1`, `pp.identity.branch.changed.v1`, `pp.identity.passkey.registered.v1` (`PasskeyRegistered`), `pp.identity.passkey.revoked.v1` (`PasskeyRevoked`), `pp.audit.identity.recorded.v1`. A security (`ReportSecurityEvent`): `STEP_UP_FAILED`, `PIN_LOCKED`, `PASSKEY_COUNTER_REGRESSION`. Solicitudes de correo (reset, invitación, bienvenida, bloqueo) se publican como `pp.identity.notification.requested.v1` con `notifications.SendRequest` embebido *(mensaje a agregar en F20.2 — hasta entonces notifications consume los eventos anteriores)*.
Consume: nada.

## 7. Dependencias
Llama a: nadie (hoja). `security.ReportSecurityEvent` en F05 (deadline 500 ms, fallo no bloquea el login; se registra en log).
Es llamado por: api-gateway, payments-core, settlement, orders, logistics, payroll, notifications.

## 8. Configuración
| Variable | Oblig. | Default | Descripción |
|---|---|---|---|
| `PORT` | no | `50060` | escucha gRPC (implementado) |
| `ADMIN_PORT` | no | `9100` | salud `/healthz/live` y `/healthz/ready` (implementado, F02.1) y `/metrics` (contadores, implementado) |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |
| `DEPLOY_ENV` | no | `dev` | valor de `deployment.environment.name` |
| `OTEL_TRACES_EXPORTER` | no | vacío | vacío (no exporta) o `console` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | — | colector OTLP gRPC; si se define, tiene prioridad |
| `ACCESS_TOKEN_SECRET` | sí | — | ≥ 32 caracteres (implementado; F05 lo lee de OpenBao) |
| `REFRESH_TOKEN_SECRET` | sí | — | ≥ 32 caracteres y distinto del anterior (implementado) |
| `DATABASE_URL` | sí (F08.2+) | — | rol `identity_svc` |
| `NATS_URL` | sí (F08.5+) | — | event-bus |
| `BCRYPT_COST` | no | 12 | ≥ 12 |
| `WEBAUTHN_RP_ID` | no | vacío | dominio registrable de las passkeys (Q-39); vacío = passkeys apagadas (`PASSKEYS_UNAVAILABLE`) |
| `WEBAUTHN_RP_NAME` | no | `PlentyPay` | nombre del sitio que muestra el sistema operativo |
| `WEBAUTHN_ORIGINS` | si hay `WEBAUTHN_RP_ID` | — | orígenes permitidos separados por coma: `https://<dominio>` y `android:apk-key-hash:<hash>` por certificado de firma |
| `STEPUP_PIN_MAX_ATTEMPTS` · `STEPUP_PIN_LOCK_MINUTES` | no | 3 · 5 | respaldo local de `stepup.pin.max_attempts` y `stepup.pin.lock_minutes` de infra-management |

## 9. Observabilidad
De negocio: `pp_logins_total{result}`, `pp_lockouts_total`, `pp_refresh_reuse_detected_total`, `pp_step_up_total{operation,result}`. Alerta crítica si `pp_refresh_reuse_detected_total` crece.
Obligatorias §2.1 (`internal/observability`): `pp_rpc_server_requests_total{service,rpc,code}`, `pp_rpc_server_duration_seconds{service,rpc}` (histograma 5 ms–10 s) y `pp_build_info{service,version,commit}`. Las etiquetas prohibidas de §2.3 (`user_id`, `tenant_id`, `request_id`, montos) se descartan en el registro.

## 10. Seguridad
Hashes de tokens (nunca el token) en BD; correos enmascarados en logs; rate limit en gateway para `/v1/auth/*` (10/min por IP, 5/min por correo).
Contraseñas: `sha256-bcrypt:<hash bcrypt costo 12>` (R19). El esquema va en el valor guardado, de modo que migrar a argon2id no invalida las contraseñas vigentes (`security-standards.md` §2).

## 11. Pruebas de aceptación
1. Dado un correo nuevo, cuando me registro, recibo tokens y mi rol es CUSTOMER (aunque pida otro).
2. Dado 5 fallos, el 6.º intento correcto dentro de 1 min devuelve `ACCOUNT_LOCKED`.
3. Dado un refresh usado, presentarlo de nuevo revoca la familia y el access vigente deja de validar en ≤ 15 s.
4. Dado un staff con rol Cajero, `GetUserPermissions` devuelve exactamente los permisos del preset (+ los de CUSTOMER) y módulos `wallet, marketplace, pos, inventory, finance, payroll` (prueba `TestR10_ModulesDerivedFromPermissions`).
5. Dado un token de step-up, consumirlo dos veces devuelve `valid=false, reason=ALREADY_USED`.
6. Dado un registro sin la confirmación de mayoría de edad, cuando se crea la cuenta, se rechaza con `AGE_REQUIREMENT` y no queda usuario; con las tres obligatorias, quedan registrados usuario, finalidad, versión del texto, fecha, canal y dispositivo (`TestN_DAT_02_*`, `TestN_DAT_14_*`).

## 12. Plan de implementación
F08.1 almacén en memoria + RPC núcleo (✅) → F08.2 PostgreSQL + migraciones + RLS (✅) → F08.3 sesiones/refresh con rotación y reuso (✅) → F08.4 bloqueo progresivo (✅) → F08.5 tenants + CreateBusiness/ReviewBusiness + relay del outbox (✅) → F08.6 roles personalizados + invitaciones (✅) → F08.7 reset de contraseña (✅) → F05.x step-up y mTLS → F08.8 pantallas Flutter (perfil, sesiones, alta de negocio, equipo, roles) → F28 passkeys y EdDSA/JWKS.

## 13. Riesgos y preguntas abiertas
Q-04 (requisitos KYB exactos de la SBP para comercios), Q-09 (proveedor de verificación de identidad).
