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
  primary_vertical text REFERENCES identity.verticals(key),
  secondary_verticals text[] NOT NULL DEFAULT '{}',
  trait_overrides jsonb NOT NULL DEFAULT '{}',
  plan_code text,
  kyb_documents jsonb NOT NULL DEFAULT '[]',   -- [{kind, object_key, uploaded_at}]
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX tenants_ruc ON identity.tenants (ruc, dv);

CREATE TABLE identity.verticals (
  key text PRIMARY KEY, family text NOT NULL, default_traits text[] NOT NULL,
  suggested_modules jsonb NOT NULL, role_template_keys text[] NOT NULL, label_pack text NOT NULL,
  version int NOT NULL, active boolean NOT NULL DEFAULT true
);

CREATE TABLE identity.tenant_capabilities (
  tenant_id uuid NOT NULL, capability text NOT NULL, enabled boolean NOT NULL,
  source text NOT NULL, changed_by uuid, changed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, capability)
);

CREATE TABLE identity.branches (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES identity.tenants(id),
  code char(4) NOT NULL, name text NOT NULL, kind text NOT NULL, -- STORE|WAREHOUSE_ONLY|KITCHEN|SALON|DEPOT|VIRTUAL
  address jsonb, open_hours jsonb, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, code)
);

CREATE TABLE identity.roles (
  id uuid PRIMARY KEY, tenant_id uuid,          -- NULL = preset de plataforma
  name text NOT NULL, permissions text[] NOT NULL, is_preset bool NOT NULL DEFAULT false,
  template_key text, template_version int, description text,
  archived_at timestamptz, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, name)
);

CREATE TABLE identity.memberships (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES identity.users(id),
  tenant_id uuid NOT NULL REFERENCES identity.tenants(id),
  base_role text NOT NULL CHECK (base_role IN ('BUSINESS_OWNER','BUSINESS_STAFF')),
  role_id uuid REFERENCES identity.roles(id),
  scope text NOT NULL CHECK (scope IN ('TENANT','BRANCHES')),
  job_title text, status text NOT NULL, -- INVITED|ACTIVE|DEACTIVATED
  invited_by uuid, created_at timestamptz NOT NULL, ended_at timestamptz, version int NOT NULL DEFAULT 1,
  UNIQUE (user_id, tenant_id)
);
CREATE UNIQUE INDEX one_active_membership ON identity.memberships (user_id) WHERE status = 'ACTIVE';

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
CREATE TABLE identity.passkeys (id uuid PRIMARY KEY, user_id uuid NOT NULL, credential_id bytea UNIQUE NOT NULL,
  public_key bytea NOT NULL, sign_count bigint NOT NULL, device_label text, created_at timestamptz NOT NULL);
CREATE TABLE identity.step_up_challenges (id uuid PRIMARY KEY, user_id uuid NOT NULL, operation text NOT NULL,
  amount_minor bigint, currency text, challenge bytea NOT NULL, expires_at timestamptz NOT NULL, verified_at timestamptz);
CREATE TABLE identity.step_up_tokens (token_hash bytea PRIMARY KEY, user_id uuid NOT NULL, operation text NOT NULL,
  amount_minor bigint, currency text, expires_at timestamptz NOT NULL, consumed_at timestamptz);
-- + idempotency_keys, outbox (data-standards.md §6)
```
RLS: `users`, `roles`, `invitations` por `tenant_id`; consultas de plataforma con rol `identity_platform` auditado.

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores (`reason`) |
|---|---|---|---|---|
| Register | público (vía gateway) | no | crea `CUSTOMER`; el gateway fuerza el rol (R6), el canal y el dispositivo; valida y registra los consentimientos (R18) | `INVALID_EMAIL`, `WEAK_PASSWORD`, `EMAIL_TAKEN`, `CONSENT_REQUIRED`, `AGE_REQUIREMENT` |
| Login | público | no | verifica contraseña, bloqueo progresivo, crea sesión, devuelve access+refresh | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_SUSPENDED` |
| ValidateToken | servicio (gateway) | — | valida access token: firma, exp, algoritmo, sesión no revocada | `TOKEN_INVALID` |
| GetUserPermissions | servicio / self | — | rol base + rol personalizado → `permissions` y `modules` | `NOT_FOUND` |
| RefreshToken | público | — | rota refresh; reuso ⇒ revoca familia y publica `SessionRevoked` | `TOKEN_INVALID`, `TOKEN_REUSED` |
| Logout | self | sí | revoca la sesión actual (o todas con `all=true`) | — |
| ListSessions / RevokeSession | self | — / sí | dispositivos con sesión; revocar una | `NOT_FOUND` |
| ChangePassword | self + step-up | sí | verifica actual, aplica política, revoca otras sesiones | `INVALID_CREDENTIALS`, `WEAK_PASSWORD`, `STEP_UP_REQUIRED` |
| RequestPasswordReset | público | — | siempre `ok=true`; si existe, outbox → notifications envía enlace `/reset/<token>` | — |
| ConfirmPasswordReset | público | sí | token válido 30 min, un uso; revoca todas las sesiones | `TOKEN_INVALID` |
| CreateBusiness | usuario autenticado sin tenant | sí | crea tenant `PENDING_REVIEW`, membresía `BUSINESS_OWNER` alcance `TENANT`, sucursal matriz `0000` y capacidades base en 1 transacción | `ALREADY_HAS_TENANT`, `RUC_TAKEN`, `INVALID_RUC`, `VERTICAL_NOT_FOUND` |
| ReviewBusiness | `platform:tenants:review` | sí | transición de estado §8.15; publica `TenantStatusChanged` | `INVALID_STATE_TRANSITION` |
| GetTenant | miembro del tenant / plataforma | — | datos del tenant | `NOT_FOUND` |
| ListTenants | `platform:tenants:review` | — | filtro por estado, paginado | — |
| ListVerticals | público / autenticado | — | catálogo de verticales, familias, rasgos y sugerencias | — |
| ListRoleTemplates | público / autenticado | — | plantillas de roles universales y por vertical | — |
| GetBusinessProfile | `admin:business:manage` / miembro | — | perfil comercial, verticales y rasgos operativos | `NOT_FOUND` |
| UpdateBusinessProfile | `admin:business:manage` | sí | actualiza verticales y rasgos sin borrar datos ni roles | `NOT_FOUND`, `VERTICAL_NOT_FOUND` |
| SetCapabilities | `admin:business:manage` | sí | activa/desactiva capacidades dentro del plan | `CAPABILITY_DISABLED`, `PLAN_LIMIT_REACHED` |
| UpsertBranch | `admin:business:manage` | sí | crea/actualiza sucursal (código DGI 4 dígitos) | `BRANCH_CODE_TAKEN`, `INVALID_BRANCH_CODE` |
| ListBranches | miembro del tenant | — | sucursales activas del comercio | — |
| DeactivateBranch / ReactivateBranch | `admin:business:manage` | sí | desactiva (o reactiva) una sucursal; no permite desactivar la única activa; las membresías con alcance `BRANCHES` conservan el vínculo | `NOT_FOUND`, `CANNOT_DEACTIVATE_LAST_BRANCH` |
| InviteStaff | `admin:users:manage` | sí | invitación con rol, alcance y cargo; valida A1, A2, A3 | `ROLE_NOT_FOUND`, `PERMISSION_NOT_HELD`, `BRANCH_OUT_OF_SCOPE`, `PLAN_LIMIT_REACHED` |
| AcceptInvitation | público con token | sí | activa membresía del usuario (existente o nuevo) | `TOKEN_INVALID` |
| UpdateMembership | `admin:users:manage` | sí | actualiza rol, alcance y cargo de un miembro; valida A1–A3 | `NOT_FOUND`, `PERMISSION_NOT_HELD`, `SELF_ASSIGNMENT_FORBIDDEN`, `BRANCH_OUT_OF_SCOPE` |
| ListUsers / DeactivateUser | `admin:users:manage` | — / sí | staff del tenant con rol, alcance, cargo y estado; desactivar es la baja del equipo y revoca sesiones | `NOT_FOUND`, `CANNOT_DEACTIVATE_OWNER`, `SELF_ASSIGNMENT_FORBIDDEN` |
| SuspendUser / ReactivateUser | `admin:users:manage` | sí | bloqueo temporal reversible (`SUSPENDED`): revoca sesiones y el login responde `ACCOUNT_SUSPENDED`; reactivar vuelve a `ACTIVE` (también reactiva a un `DEACTIVATED`) | `NOT_FOUND`, `CANNOT_DEACTIVATE_OWNER`, `SELF_ASSIGNMENT_FORBIDDEN` |
| ListInvitations / RevokeInvitation / ResendInvitation | `admin:users:manage` | — / sí / sí | invitaciones pendientes del negocio; revocar invalida el token; reenviar emite token nuevo y vuelve a publicar la solicitud de correo | `NOT_FOUND`, `ALREADY_USED` |
| GetAccessCatalog | autenticado | — | catálogo de permisos con módulo, nivel de acceso, capacidad asociada y marca de dinero 🔒, orden de módulos y capacidades conocidas; lo usa el editor de roles (S-ADM-03) y S-ADM-08 sin copiar el catálogo en la app | — |
| GetUserContacts | servicio (notifications) | — | email/teléfono/locale/preferencias | `NOT_FOUND` |
| UpsertRole / ListRoles / AssignRole | `admin:roles:manage` (+ step-up si el rol tiene permisos de dinero) | sí | roles personalizados ⊆ permisos del catálogo; presets no editables; valida A1 | `UNKNOWN_PERMISSION`, `PRESET_READ_ONLY`, `PERMISSION_NOT_HELD`, `STEP_UP_REQUIRED` |
| ArchiveRole | `admin:roles:manage` | sí | archiva rol; no permite si tiene miembros activos | `ROLE_IN_USE`, `NOT_FOUND` |
| Begin/FinishPasskeyRegistration, Begin/FinishPasskeyLogin | self / público | — | WebAuthn (F28) | `TOKEN_INVALID` |
| IssueStepUpChallenge / VerifyStepUp | self | — | desafío ligado a operación+monto; token 5 min | `TOKEN_INVALID` |
| ConsumeStepUp | servicio | — | atómico: `UPDATE ... SET consumed_at=now() WHERE consumed_at IS NULL AND expires_at>now()`; compara operación/monto/usuario | resultado `valid=false` + reason |

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
- **R14** Step-up obligatorio para las operaciones de `security-standards.md` §4 que ejecuta identity (cambio de contraseña/correo, asignar roles con permisos de dinero).
- **R15** Token de step-up: un solo uso, 5 min, ligado a usuario+operación+monto; consumir dos veces → `ALREADY_USED`.
- **R16** Cambiar contraseña o reset revoca todas las demás sesiones.
- **R17** RUC + DV válidos (formato DGI; algoritmo de DV en F08.6) y únicos.
- **R18** Consentimientos del registro público (N-DAT-02, N-DAT-14): obligatorios `AGE_CONFIRMATION`, `TERMS` y `PRIVACY_DATA_PROCESSING`, cada uno con la versión del texto visto; `MARKETING` es opcional y se registra también si no se concede. Se guardan con fecha del servidor, canal y dispositivo. Sin ellos no se crea la cuenta: `AGE_REQUIREMENT` si falta la confirmación de mayoría de edad, `CONSENT_REQUIRED` si faltan términos o privacidad. Una finalidad desconocida se ignora. Revocar no borra: agrega un registro con `granted=false`.
- **R19** Las contraseñas se derivan con SHA-256 + base64 antes de bcrypt costo 12 (esquema declarado en el propio hash, `sha256-bcrypt:`), porque bcrypt solo consume 72 bytes y la política permite 128 caracteres (R2).
- **R20** Perfil comercial y verticales: todo comercio registra una vertical principal y hasta 2 secundarias con sus rasgos operativos asociados. Los rasgos son personalizables en el alta o edición sin alterar la base de código de los servicios.
- **R21** Capacidades del negocio y resolución dinámica: un permiso del rol solo se concede en los permisos efectivos si su capacidad asociada (`security-standards.md` §3.1) está activa en el negocio por perfil o plan (salvo permisos de núcleo y plataforma). El gateway propaga `x-pp-capabilities` y los servicios deniegan invocaciones a capacidades inactivas con `FAILED_PRECONDITION` y `reason: CAPABILITY_DISABLED`.
- **R22** Asignación efectiva de roles: para usuarios `BUSINESS_STAFF`, `PermissionsForUser` resuelve exactamente los permisos del rol asignado en `memberships` (o `user_roles`) + base `CUSTOMER`. Un `BUSINESS_STAFF` sin rol asignado recibe únicamente la base `CUSTOMER` (principio deny-by-default; sin fallback al preset de cajero).
- **R23** Reglas de gobierno anti-escalada:
  - **A1**: Nadie puede crear roles ni asignar permisos que no posea en sus permisos efectivos (`PERMISSION_NOT_HELD`).
  - **A2**: Nadie puede modificar su propio rol asignado ni su propia membresía (`SELF_ASSIGNMENT_FORBIDDEN`).
  - **A3**: El alcance no puede crecer al delegar; quien posee alcance `BRANCHES` solo asigna subconjuntos de sus sucursales asignadas (`BRANCH_OUT_OF_SCOPE`).
- **R24** Alcance por sucursal (`branch_scope`): toda membresía posee alcance `TENANT` (`*`) o `BRANCHES` (lista de UUIDs de sucursales). El gateway propaga el metadato `x-pp-branch-scope`. Acciones fuera del alcance asignado son denegadas con `PERMISSION_DENIED` y `reason: BRANCH_OUT_OF_SCOPE`.

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
Publica: `pp.identity.tenant.status_changed.v1` (`TenantStatusChanged`), `pp.identity.session.revoked.v1` (`SessionRevoked`), `pp.identity.role.changed.v1`, `pp.identity.membership.changed.v1`, `pp.identity.capabilities.changed.v1`, `pp.identity.branch.changed.v1`, `pp.audit.identity.recorded.v1`. Solicitudes de correo (reset, invitación, bienvenida, bloqueo) se publican como `pp.identity.notification.requested.v1` con `notifications.SendRequest` embebido *(mensaje a agregar en F20.2 — hasta entonces notifications consume los eventos anteriores)*.
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
