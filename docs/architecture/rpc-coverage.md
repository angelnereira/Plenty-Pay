# Cobertura de contratos gRPC — paso F03.1

Revisión **RPC por RPC** de los 16 `.proto` con servicio contra la sección §4 del SPEC de su
contenor dueño. Comprueba, para cada RPC: que esté documentado en el SPEC, que el nombre coincida,
que el permiso esté documentado y que la idempotencia declarada en el SPEC exista en el contrato
(`grpc-conventions.md` §3.8: *las mutaciones que crean o cambian dinero, stock o estado y pueden
reintentarse llevan `idempotency_key`*).

**Alcance**: 231 RPC en 16 protos (`common.proto` y `events.proto` no declaran servicios). La tabla
tiene 232 filas: las 231 del contrato más `analytics.AskQuestion`, que el SPEC documenta y el
`.proto` todavía no declara (pendiente de F03.2). Ejecutada el 2026-10-12 sobre los contratos de
`network-contracts/proto/` y los `*/SPEC.md`.

## Resumen

| Contenedor | `.proto` | RPC | Documentados en §4 | Permiso documentado | Con observaciones |
|---|---|---|---|---|---|
| identity | `identity.proto` | 30 | 30 | 30 | 18 |
| security | `security.proto` | 13 | 13 | 13 | 11 |
| infra-management | `infra_management.proto` | 9 | 9 | 9 | 8 |
| ledger | `ledger.proto` | 11 | 11 | 11 | 2 |
| payments-core | `payments.proto` | 17 | 17 | 17 | 7 |
| settlement | `settlement.proto` | 11 | 11 | 11 | 6 |
| fiscal-invoicing | `fiscal_invoicing.proto` | 13 | 13 | 13 | 3 |
| orders | `orders.proto` | 13 | 13 | 13 | 8 |
| pos | `pos.proto` | 18 | 18 | 18 | 9 |
| catalog | `catalog.proto` | 15 | 15 | 15 | 11 |
| inventory | `inventory.proto` | 17 | 17 | 17 | 6 |
| logistics | `logistics.proto` | 13 | 13 | 13 | 4 |
| notifications | `notifications.proto` | 13 | 13 | 13 | 8 |
| payroll | `payroll.proto` | 16 | 16 | 16 | 8 |
| geolocation | `geolocation.proto` | 9 | 9 | 9 | 2 |
| analytics-bi | `analytics.proto` | 14 | 13 | 14 | 6 |
| **Total** | | **232** | **231** | **232** | **117** |

**Conclusión de la revisión**: los 231 RPC tienen fila en §4 y permiso documentado, y ningún nombre
difiere entre contrato y SPEC. Las 117 observaciones son de tres tipos, en este orden de gravedad:

1. **El SPEC declara idempotencia que el contrato no puede expresar** (no existe el campo
   `idempotency_key`): **31 RPC** — 11 de identity, 4 de orders, 5 de pos, 3 de settlement,
   3 de payments-core, 2 de fiscal-invoicing, 1 de ledger (`ReleaseHold`), más
   `UpdateSale`, que usa `expected_version` sin clave. Los SPEC describen el comportamiento
   objetivo; el contrato va por detrás. Se cierran en **F03.2** agregando el campo (cambio aditivo).
2. **Nueve contenedores no tienen columna *Idemp.* ni *Errores (`reason`)* en §4** (catalog,
   inventory, logistics, notifications, payroll, geolocation, analytics-bi, security e
   infra-management): laguna de documentación ya registrada, asignada a **F03.5**.
3. **Dos contratos usan `double` donde el dominio es dinero** (`analytics.proto`:
   `ForecastPoint` y `AlertRule.threshold`/`AlertEvent.observed_value`), contra ADR 0013 y
   `grpc-conventions.md` §1.4. Dos campos documentados en el modelo que el contrato no transporta
   (`payment_methods` en fiscal, variantes en catalog) y cuatro que `GetClientConfig` promete y no
   declara. Todo aditivo, encolado en **F03.2**.

Dinero: **ningún** importe en `float`/`double` en los 16 protos, salvo los dos casos de analytics
mencionados. Los únicos `double` del repositorio ajenos al dinero son
`common.proto.GeoPoint.latitude/longitude`.

## Hallazgos

Referencias por id; cada tabla marca los RPC afectados.

| Id | Gravedad | Contenedor | Hallazgo | Dónde se cierra |
|---|---|---|---|---|
| F-1 | alta | identity | 11 mutaciones documentadas como idempotentes sin campo `idempotency_key` en el `.proto` (Logout, RevokeSession, ChangePassword, ConfirmPasswordReset, CreateBusiness, ReviewBusiness, InviteStaff, AcceptInvitation, DeactivateUser, UpsertRole, AssignRole) | F03.2 |
| F-2 | media | identity | El RUC se transporta sin DV: `Tenant.tax_id`/`CreateBusinessRequest.tax_id` no permiten enviar el DV que el modelo y R17 exigen | F03.2 |
| F-3 | media | identity | `ChangePasswordRequest` no lleva `step_up_token` aunque R14 y la fila §4 exigen step-up (el patrón publicado lo lleva en el cuerpo) | F03.2 |
| F-4 | media | identity | El objeto de la operación viaja en el cuerpo en RPC acotados a *self*: `ListSessionsRequest.user_id`, `ListUsersRequest.tenant_id`, `StepUpRequest.user_id`, etc., sin obligar a derivarlos de `x-pp-user-id`/`x-pp-tenant-id` (ADR 0011/0014) | F03.2 + SPEC |
| F-5 | media | identity | `RequestPasswordReset` marcada "—" en idempotencia pese a crear fila en `password_resets` y disparar correo: un reintento envía un segundo enlace | F03.2 |
| F-6 | baja | identity | `rpc IssueStepUpChallenge(StepUpRequest)` rompe la convención `<Rpc>Request` (§1.2) | F03.2 |
| F-7 | baja | identity | `GetUserContacts` promete "preferencias" que `UserContact` no tiene | F03.2 |
| F-8 | baja | identity, settlement | Filas de lectura con la columna *Idemp.* en "sí" (`ListRoles`, `GetPayoutSchedule`): la columna deja de servir como criterio de revisión | F03.5 |
| F-9 | media | identity | `ConsumeStepUpResult.reason` declara `EXPIRED`, `MISMATCH` y `NOT_FOUND`, que no están en `docs/glossary.md` §7.3 | F03.5 |
| F-10 | alta | security, infra-management | Nueve mutaciones sin `idempotency_key` y sin columna *Idemp.* en el SPEC (PutSecret, RotateSecret, RotateDataKey, UpsertFlag, SetConfig, SetMaintenanceMode) | F03.2 + F03.5 |
| F-11 | alta | security | `AppendAuditEvent` puede duplicar filas en un almacén *append-only* encadenado; la idempotencia por `event_id` está escrita solo para el consumidor NATS, no para el RPC | F03.2 |
| F-12 | media | security | `associated_data` es `bytes` de formato libre mientras el SPEC fija el valor canónico `tenant_id\|resource_id` | F03.2 |
| F-13 | media | security | `QueryAuditEventsRequest.tenant_id` en el cuerpo en lugar del metadato | F03.2 |
| F-14 | media | security | `VerifyAuditChain` no filtra por tenant y puede revelar el id de un evento de otro comercio | F03.2 |
| F-15 | media | security | `ReportSecurityEvent` sin clave: un reintento duplica el evento y puede bloquear a quien no debía (los umbrales son por conteo) | F03.2 |
| F-16 | baja | security | `bootstrap_token`, `Secret.value` y `DecryptResponse.plaintext` no llevan en el `.proto` la advertencia de dato sensible (AGENTS.md §2.16) | F03.5 |
| F-17 | media | infra-management | Tenant en el cuerpo: `FlagContext.tenant_id` y `GetConfigRequest.scope = "tenant:<id>"` permiten leer configuración de otro comercio | F03.2 |
| F-18 | media | infra-management | `GetClientConfig` promete `latest_app_version`, `api_base_url`, `realtime_url` y `features` que `ClientConfig` no declara | F03.2 |
| F-19 | baja | infra-management | `ListFlagsResponse` y `ListServicesResponse` no usan `PageRequest`/`PageInfo` (§1.7) | F03.2 |
| F-20 | alta | ledger | `ReleaseHoldRequest` sin `idempotency_key` pese a marcar "sí por estado": libera fondos retenidos | F03.2 |
| F-21 | media | payments-core | `CancelPaymentIntentRequest` sin clave; el SPEC solo dice "por estado" | F03.2 |
| F-22 | media | payments-core | `CreateTerminalRequest` y `SetTerminalActiveRequest` sin clave | F03.2 |
| F-23 | alta | payments-core | `UpsertFeePolicyRequest` sin clave: cambia el cálculo de comisiones (dinero) | F03.2 |
| F-24 | alta | payments-core | `ResolveUnknownPaymentRequest` sin clave: fija el estado final de un pago `UNKNOWN` | F03.2 |
| F-25 | baja | settlement | `GetPayoutSchedule` (lectura) con *Idemp.* = "sí" | F03.5 |
| F-26 | media | settlement | `SetPayoutScheduleRequest` sin clave: cambia el destino de cobro con bloqueo de 48 h | F03.2 |
| F-27 | alta | settlement | `ConfirmPayoutRequest`, `FailPayoutRequest` y `ResolveExceptionRequest` sin clave; `ConfirmPayout` es el desembolso real al comercio | F03.2 |
| F-28 | alta | fiscal-invoicing | `ConfigureFiscalProfileRequest` sin clave y sin campo `pac_provider`, que el modelo y la pantalla S-FIN-09 exigen | F03.2 |
| F-29 | media | fiscal-invoicing | `UpsertTaxpayerRequest` sin clave; `IssueInvoiceRequest` sin campo para la forma de pago que el modelo declara `NOT NULL` | F03.2 |
| F-30 | media | orders | `SetCartItemRequest` y `ClearCartRequest` sin clave | F03.2 |
| F-31 | alta | orders | `CancelOrderRequest` y los tres mensajes de acción de sub-pedido sin clave; cancelar y rechazar disparan reembolsos | F03.2 |
| F-32 | alta | pos | Cinco mutaciones sin clave estando documentadas como idempotentes: `CloseCashSession`, `CreateSale`, `VoidSale`, `UpdatePosSettings` y `UpdateSale` | F03.2 |
| F-33 | media | pos | `UpdateSaleRequest` acepta líneas con precio libre, sin versión de precio: `PRICE_STALE` es indecidible | F03.2 |
| F-34 | media | pos | Tres nombres para la misma clave de idempotencia offline (`client_txn_id`, `client_sale_id`, `idempotency_key`) | F03.2 |
| F-35 | media | pos | `StreamCustomerDisplay` documenta el permiso "dispositivo emparejado", que no existe en `security-standards.md` §3 | F03.2 |
| F-36 | alta | catalog | §4 sin columna *Idemp.* ni *Errores* para 15 RPC | F03.5 |
| F-37 | alta | catalog | `UpdateProductRequest`, `ArchiveProductRequest` y `SetListingRequest` sin clave; `Product` no transporta variantes ni precio por sucursal que el modelo declara | F03.2 |
| F-38 | media | catalog | `BulkImportProducts` es *stream* y no hay mensaje donde alojar la clave de lote | F03.2 |
| F-39 | alta | inventory | §4 sin columna *Idemp.* ni *Errores* para 17 RPC | F03.5 |
| F-40 | alta | inventory | `CommitReservationRequest` y `ReleaseReservationRequest` sin clave, aunque el modelo exige `movements.idempotency_key NOT NULL` | F03.2 |
| F-41 | media | inventory | `UpdatePurchaseOrderStatusRequest` sin clave; `product_id` en el contrato frente a `variant_id` en el modelo | F03.2 |
| F-42 | baja | logistics | Celdas de permiso agrupadas (4 y 3 RPC) sin correspondencia explícita | F03.5 |
| F-43 | media | logistics | `AssignDeliveryRequest` y `CancelDeliveryRequest` sin clave | F03.2 |
| F-44 | media | notifications | El SPEC y el modelo hablan de `dedupe_key`; el contrato declara `idempotency_key` y §4 no dice qué campo lo puebla | F03.2 |
| F-45 | media | notifications | `MarkReadRequest` sin clave (idempotente por naturaleza, pero sin declarar) | F03.5 |
| F-46 | media | notifications | `UpsertTemplateRequest` sin clave con plantillas versionadas: un reintento puede duplicar la versión | F03.2 |
| F-47 | media | payroll | `UpsertEmployeeRequest` sin clave y crea el `payout_party_id`, destino del dinero de nómina | F03.2 |
| F-48 | baja | payroll | §4 no declara que el `idempotency_key` de `ClockEventRequest` es el `client_txn_id` de `attendance` | F03.5 |
| F-49 | media | payroll | `CreateKioskSessionRequest` sin clave: un reintento deja dos sesiones de quiosco válidas | F03.2 |
| F-50 | media | payroll | `ApprovePayrollRunRequest` sin clave en una transición inmutable con step-up | F03.2 |
| F-51 | media | geolocation | `IngestLocations` no tiene clave por ping ni el SPEC documenta dedupe: es la única escritura del servicio y emite `GeofenceCrossed` | F03.2 |
| F-52 | alta | analytics-bi | Dinero en `double`: `ForecastPoint.expected/lower/upper`, `AlertRule.threshold`, `AlertEvent.observed_value` (ADR 0013) | F03.2 |
| F-53 | media | analytics-bi | `CreateExportRequest` sin clave pese a lanzar un job asíncrono con enlace de 24 h | F03.2 |

## Tabla de cobertura

Leyenda: ✅ sin observación · ⚠ con observación (ver el id del hallazgo) · — no aplica (lectura o
*stream*). "Fila en SPEC §4" es la línea de la tabla §4 del SPEC del contenedor; "fila combinada"
significa que el SPEC documenta varios RPC en una misma fila.

### identity (`identity.proto` · 30 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `Register` | L87 | público (vía gateway) | no | no | ✅ |
| `Login` | L88 | público | no | no | ✅ |
| `ValidateToken` | L89 | servicio (gateway) | — | — | ✅ lectura |
| `GetUserPermissions` | L90 | servicio / self | — | — | ✅ lectura |
| `RefreshToken` | L91 | público | no | — | ✅ |
| `Logout` | L92 | self | no | sí | ⚠ SPEC documenta `all=true`, campo inexistente (F-1) |
| `ListSessions` | L93 | self | — | — | ⚠ `user_id` en el cuerpo (F-4) |
| `RevokeSession` | L93 | self | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `ChangePassword` | L94 | self + step-up | no | sí | ⚠ falta `idempotency_key` y `step_up_token` (F-1, F-3) |
| `RequestPasswordReset` | L95 | público | no | — | ⚠ crea token y envía correo (F-5) |
| `ConfirmPasswordReset` | L96 | público | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `CreateBusiness` | L97 | usuario sin tenant | no | sí | ⚠ falta `idempotency_key` y el DV del RUC (F-1, F-2) |
| `ReviewBusiness` | L98 | `platform:tenants:review` | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `GetTenant` | L99 | miembro / plataforma | — | — | ✅ lectura |
| `ListTenants` | L100 | `platform:tenants:review` | — | — | ✅ lectura |
| `InviteStaff` | L101 | `admin:users:manage` | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `AcceptInvitation` | L102 | público con token | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `ListUsers` | L103 | `admin:users:manage` | — | — | ⚠ `tenant_id` en el cuerpo (F-4) |
| `DeactivateUser` | L103 | `admin:users:manage` | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `GetUserContacts` | L104 | servicio (notifications) | — | — | ⚠ promete "preferencias" ausentes (F-7) |
| `UpsertRole` | L105 | `admin:roles:manage` | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `ListRoles` | L105 | `admin:roles:manage` | — | sí | ⚠ lectura marcada idempotente (F-8) |
| `AssignRole` | L105 | `admin:roles:manage` | no | sí | ⚠ falta `idempotency_key` (F-1) |
| `BeginPasskeyRegistration` | L106 | self | — | — | ✅ |
| `FinishPasskeyRegistration` | L106 | self | — | — | ✅ |
| `BeginPasskeyLogin` | L106 | público | — | — | ✅ |
| `FinishPasskeyLogin` | L106 | público | — | — | ✅ |
| `IssueStepUpChallenge` | L107 | self | — | — | ⚠ mensaje `StepUpRequest` (F-6) |
| `VerifyStepUp` | L107 | self | — | — | ✅ |
| `ConsumeStepUp` | L108 | servicio | — | — | ⚠ `reason` fuera del catálogo (F-9) |


### security (`security.proto` · 13 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `GetSecret` | L18 | `allowed_readers` (SAN mTLS) | — | sin columna | ✅ lectura |
| `PutSecret` | L19 | servicios dueños + plataforma | no | sin columna | ⚠ mutación sin clave (F-10) |
| `RotateSecret` | L19 | servicios dueños + plataforma | no | sin columna | ⚠ rotación sin clave (F-10) |
| `ListSecrets` | L19 | servicios dueños + plataforma | — | sin columna | ✅ lectura |
| `Encrypt` | L20 | servicios autorizados por propósito | — | sin columna | ⚠ AAD sin formato canónico en el contrato (F-12) |
| `Decrypt` | L20 | servicios autorizados por propósito | — | sin columna | ⚠ AAD canónico no declarado (F-12) |
| `RotateDataKey` | L20 | servicios autorizados por propósito | no | sin columna | ⚠ mutación sin clave (F-10) |
| `AppendAuditEvent` | L21 | gateway; plataforma; dueño del tenant | no | sin columna | ⚠ append-only duplicable (F-11) |
| `QueryAuditEvents` | L21 | dueño del tenant, filtrado | — | sin columna | ⚠ `tenant_id` en el cuerpo (F-13) |
| `VerifyAuditChain` | L21 | plataforma / dueño del tenant | — | sin columna | ⚠ sin filtro por tenant (F-14) |
| `ReportSecurityEvent` | L22 | identity, gateway, payments-core | no | sin columna | ⚠ reintento infla contadores (F-15) |
| `IsBlocked` | L22 | identity, gateway, payments-core | — | sin columna | ⚠ `reason` sin valores documentados |
| `IssueServiceCertificate` | L23 | contenedores al arrancar | no | sin columna | ⚠ `bootstrap_token` en el cuerpo (F-16) |


### infra-management (`infra_management.proto` · 9 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `EvaluateFlags` | L16 | servicios (contexto tenant/usuario) | — | sin columna | ⚠ `FlagContext.tenant_id` en el cuerpo (F-17) |
| `UpsertFlag` | L17 | `platform:flags:manage` | no | sin columna | ⚠ mutación sin clave (F-10) |
| `ListFlags` | L17 | `platform:flags:manage` | — | sin columna | ⚠ sin paginar (F-19) |
| `GetConfig` | L18 | servicios | — | sin columna | ⚠ `scope` con `tenant:<id>` en el cuerpo (F-17) |
| `SetConfig` | L18 | `platform:flags:manage` | no | sin columna | ⚠ mutación sin clave (F-10) |
| `SetMaintenanceMode` | L19 | `platform:flags:manage` | no | sin columna | ⚠ mutación sin clave (F-10) |
| `GetMaintenanceState` | L19 | público vía gateway | — | sin columna | ✅ |
| `ListServices` | L20 | `platform:support` | — | sin columna | ⚠ sin paginar (F-19) |
| `GetClientConfig` | L21 | público | — | sin columna | ⚠ faltan 4 campos prometidos (F-18) |


### ledger (`ledger.proto` · 11 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `PostTransaction` | L66 | servicios dueños + gateway | sí (L74) | sí (`idempotency_key` global) | ✅ |
| `ReverseTransaction` | L67 | servicios dueños | sí (L108) | sí (`rev:<id>`) | ✅ |
| `GetTransaction` | L68 | servicios + gateway | — | — | ✅ fila combinada |
| `ListTransactions` | L68 | servicios + gateway | — | — | ✅ fila combinada |
| `GetBalance` | L69 | servicios + gateway | — | — | ✅ fila combinada |
| `ListBalances` | L69 | servicios + gateway | — | — | ✅ fila combinada |
| `GetStatement` | L70 | gateway | — | — | ✅ permiso efectivo en L76 |
| `CreateHold` | L71 | payments-core | sí (L175) | sí | ✅ |
| `CaptureHold` | L72 | payments-core | sí (L188) | sí | ✅ |
| `ReleaseHold` | L73 | payments-core | no | sí por estado | ⚠ libera fondos sin clave (F-20) |
| `GetHold` | L74 | payments-core | — | — | ⚠ columna Comportamiento vacía |


### payments-core (`payments.proto` · 17 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `CreatePaymentIntent` | L81 | `payments:charge` / `wallet:*` | sí (L76) | sí | ✅ |
| `ConfirmPaymentIntent` | L82 | pagador | sí (L90) | sí | ✅ |
| `CancelPaymentIntent` | L83 | creador o comercio | no | por estado | ⚠ sin clave (F-21) |
| `GetPaymentIntent` | L84 | `payments:read` o pagador | — | — | ✅ fila combinada |
| `GetPayment` | L84 | `payments:read` | — | — | ✅ fila combinada |
| `ListPayments` | L84 | `payments:read` | — | — | ✅ fila combinada |
| `RefundPayment` | L85 | `payments:refund` + step-up | sí (L167) | sí | ✅ |
| `GetRefund` | L86 | `payments:read` | — | — | ⚠ sin ruta HTTP documentada |
| `CreateTerminal` | L87 | `payments:terminal:manage` | no | sí | ⚠ sin clave (F-22) |
| `ListTerminals` | L87 | `payments:terminal:manage` | — | — | ✅ fila combinada |
| `SetTerminalActive` | L87 | `payments:terminal:manage` | no | sí | ⚠ sin clave (F-22) |
| `ResolveTerminal` | L88 | autenticado | — | — | ✅ |
| `QuoteFees` | L89 | quien puede cobrar/pagar | — | — | ✅ |
| `UpsertFeePolicy` | L90 | `platform:flags:manage` | no | sí | ⚠ cambia comisiones sin clave (F-23) |
| `ListFeePolicies` | L90 | `payments:fees:read` | — | — | ✅ fila combinada |
| `HandleRailWebhook` | L91 | solo api-gateway | no | por `provider_event_id` | ⚠ mecanismo alternativo documentado en R12 |
| `ResolveUnknownPayment` | L92 | `platform:reconcile` | no | sí | ⚠ fija estado UNKNOWN sin clave (F-24) |


### settlement (`settlement.proto` · 11 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `GetPayoutSchedule` | L55 | `settlement:read` | — | sí | ⚠ lectura marcada idempotente (F-25) |
| `SetPayoutSchedule` | L55 | `settlement:schedule:manage` + step-up | no | sí | ⚠ cambia destino sin clave (F-26) |
| `CreateBatch` | L56 | job interno / `settlement:schedule:manage` | sí (L68) | sí (`tenant+period_end`) | ✅ |
| `GetBatch` | L57 | `settlement:read` | — | — | ✅ fila combinada |
| `ListBatches` | L57 | `settlement:read` | — | — | ✅ fila combinada |
| `ConfirmPayout` | L58 | job conector / `platform:reconcile` | no | sí | ⚠ desembolso real sin clave (F-27) |
| `FailPayout` | L59 | job conector / `platform:reconcile` | no | sí | ⚠ sin clave y sin errores (F-27) |
| `ImportRailStatement` | L60 | `platform:reconcile` | sí (L91) | sí (`rail+date`) | ✅ |
| `GetReconciliationReport` | L61 | `platform:reconcile` | — | — | ⚠ sin errores documentados |
| `ListReconciliationExceptions` | L61 | `settlement:reconcile` | — | — | ✅ fila combinada |
| `ResolveException` | L62 | `platform:reconcile` | no | sí | ⚠ puede generar asiento sin clave (F-27) |


### fiscal-invoicing (`fiscal_invoicing.proto` · 13 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `EvaluateDocumentPolicy` | L51 | `fiscal:issue` / pos, orders | — | — | ✅ |
| `IssueInvoice` | L52 | `fiscal:issue` / pos, orders | sí (L87) | sí | ✅ |
| `IssueCreditNote` | L53 | `fiscal:note:issue` | sí (L95) | sí | ✅ `IssueNoteRequest` común |
| `IssueDebitNote` | L53 | `fiscal:note:issue` | sí (L95) | sí | ✅ fila combinada |
| `GetInvoice` | L54 | `fiscal:read` | — | — | ✅ fila combinada |
| `ListInvoices` | L54 | `fiscal:read` | — | — | ✅ fila combinada |
| `RefreshInvoiceStatus` | L55 | worker / webhook PAC | — | — | ⚠ sin errores documentados |
| `GetInvoiceDocument` | L56 | `fiscal:read` o cliente | — | — | ✅ |
| `ConfigureFiscalProfile` | L57 | `fiscal:profile:manage` + step-up | no | sí | ⚠ sin clave y sin `pac_provider` (F-28) |
| `GetFiscalProfile` | L58 | `fiscal:read` | — | — | ✅ fila combinada |
| `GetFolioStatus` | L58 | `fiscal:read` | — | — | ✅ fila combinada |
| `UpsertTaxpayer` | L59 | `fiscal:issue` | no | sí | ⚠ sin clave (F-29) |
| `SearchTaxpayers` | L59 | `fiscal:issue` | — | — | ✅ fila combinada |


### orders (`orders.proto` · 13 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `GetCart` | L47 | `orders:create:self` | — | — | ✅ fila combinada |
| `SetCartItem` | L47 | `orders:create:self` | no | — | ⚠ mutación sin clave (F-30) |
| `ClearCart` | L47 | `orders:create:self` | no | — | ⚠ mutación sin clave (F-30) |
| `QuoteCheckout` | L48 | `orders:create:self` | — | — | ✅ lectura |
| `Checkout` | L49 | `orders:create:self` + step-up | sí (L64) | sí | ✅ |
| `GetOrder` | L50 | `orders:read:self` | — | — | ✅ fila combinada |
| `ListMyOrders` | L50 | `orders:read:self` | — | — | ✅ fila combinada |
| `CancelOrder` | L51 | «comprador» (no es permiso del catálogo) | no | sí | ⚠ dispara reembolso sin clave (F-31) |
| `ListMerchantOrders` | L52 | `orders:read` | — | — | ⚠ sin errores documentados |
| `AcceptSubOrder` | L53 | `orders:manage` | no | sí por estado | ⚠ transición sin clave (F-31) |
| `RejectSubOrder` | L53 | `orders:manage` | no | sí por estado | ⚠ dispara reembolso sin clave (F-31) |
| `MarkSubOrderReady` | L53 | `orders:manage` | no | sí por estado | ⚠ transición sin clave (F-31) |
| `MarkSubOrderCompleted` | L53 | `orders:manage` | no | sí por estado | ⚠ transición sin clave (F-31) |


### pos (`pos.proto` · 18 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `OpenCashSession` | L60 | `pos:session:manage` | sí (L64) | sí | ✅ |
| `CloseCashSession` | L60 | `pos:session:manage` | no | sí | ⚠ arqueo sin clave (F-32) |
| `GetCashSession` | L60 | `pos:session:manage` | — | sí | ⚠ fila agrupa lectura con mutaciones |
| `RecordCashMovement` | L61 | `pos:session:manage` | sí (L67) | sí | ✅ |
| `CreateSale` | L62 | `pos:sell` (+`pos:discount:apply`) | no | sí | ⚠ solo `client_sale_id` (F-32) |
| `UpdateSale` | L62 | `pos:sell` | no (usa `expected_version`) | sí | ⚠ sin clave ni versión de precio (F-32, F-33) |
| `ParkSale` | L63 | `pos:sell` | no | — | ✅ no toca dinero ni stock |
| `ResumeSale` | L63 | `pos:sell` | no | — | ✅ |
| `Checkout` | L64 | `pos:sell` | sí (L115) | sí | ✅ |
| `VoidSale` | L65 | `pos:void` (+supervisor) | no | sí | ⚠ anulación sin clave (F-32) |
| `RefundSale` | L66 | `pos:refund` + step-up | sí (L121) | sí | ✅ |
| `GetSale` | L67 | `pos:sell` | — | — | ✅ fila combinada |
| `ListSales` | L67 | `pos:sell` | — | — | ✅ fila combinada |
| `GetReceipt` | L67 | `pos:sell` | — | — | ✅ fila combinada |
| `SyncOfflineSales` | L68 | `pos:sell` | sí por venta (L128) | sí por `client_txn_id` | ⚠ tres nombres para la clave (F-34) |
| `StreamCustomerDisplay` | L69 | «dispositivo emparejado» (no es permiso) | — | — | ⚠ permiso inexistente (F-35) |
| `GetPosSettings` | L70 | `pos:sell` | — | sí | ⚠ fila agrupa lectura con mutación |
| `UpdatePosSettings` | L70 | `pos:settings:manage` | no | sí | ⚠ sin clave (F-32) |


### catalog (`catalog.proto` · 15 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `CreateProduct` | L49 | `catalog:write` | sí (L58) | sin columna | ⚠ SPEC sin Idemp. ni Errores (F-36) |
| `UpdateProduct` | L49 | `catalog:write` | no | sin columna | ⚠ cambia precio sin clave (F-37) |
| `ArchiveProduct` | L49 | `catalog:write` | no | sin columna | ⚠ cambia estado sin clave (F-37) |
| `GetProduct` | L50 | `catalog:read` | — | sin columna | ✅ fila combinada |
| `ListProducts` | L50 | `catalog:read` | — | sin columna | ✅ fila combinada |
| `LookupByBarcode` | L50 | `catalog:read` | — | sin columna | ✅ fila combinada |
| `BulkImportProducts` | L51 | `catalog:import` | no | sin columna | ⚠ stream sin clave de lote (F-38) |
| `UpsertCategory` | L52 | `catalog:write` | no | sin columna | ⚠ sin clave |
| `ListCategories` | L52 | `catalog:read` | — | sin columna | ✅ fila combinada |
| `CreateUploadUrl` | L53 | `catalog:write` / `admin:business:manage` | no | sin columna | ⚠ no toca dinero ni stock |
| `SetListing` | L54 | `catalog:listing:manage` | no | sin columna | ⚠ pública/despublica sin clave (F-37) |
| `SearchMarketplace` | L55 | «autenticado» (no es permiso) | — | sin columna | ⚠ sin filtro `in_stock` prometido |
| `GetMarketplaceProduct` | L56 | «autenticado» | — | sin columna | ⚠ nivel de acceso, no permiso |
| `GetStorefront` | L56 | «autenticado» | — | sin columna | ⚠ fila combinada |
| `UpdateStorefront` | L57 | `catalog:listing:manage` | no | sin columna | ⚠ sin clave |


### inventory (`inventory.proto` · 17 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `UpsertWarehouse` | L41 | `inventory:adjust` | no | sin columna | ⚠ SPEC sin Idemp. ni Errores (F-39) |
| `ListWarehouses` | L41 | `inventory:read` | — | sin columna | ✅ fila combinada |
| `GetStock` | L42 | `inventory:read` | — | sin columna | ✅ fila combinada |
| `ListStock` | L42 | `inventory:read` | — | sin columna | ✅ fila combinada |
| `AdjustStock` | L43 | `inventory:adjust` | sí (L76) | sin columna | ✅ |
| `TransferStock` | L44 | `inventory:adjust` | sí (L84) | sin columna | ✅ |
| `ListMovements` | L45 | `inventory:read` | — | sin columna | ✅ |
| `ReserveStock` | L46 | «orders (servicio)» (llamador) | sí (L106) | sin columna | ⚠ permiso vs llamador |
| `CommitReservation` | L46 | «orders (servicio)» | no | sin columna | ⚠ genera movimiento sin clave (F-40) |
| `ReleaseReservation` | L46 | «orders (servicio)» | no | sin columna | ⚠ libera reserva sin clave (F-40) |
| `UpsertSupplier` | L47 | `inventory:purchase:manage` | no | sin columna | ⚠ sin clave |
| `ListSuppliers` | L47 | `inventory:purchase:manage` | — | sin columna | ✅ fila combinada |
| `CreatePurchaseOrder` | L48 | `inventory:purchase:manage` | sí (L138) | sin columna | ✅ |
| `UpdatePurchaseOrderStatus` | L48 | `inventory:purchase:manage` | no | sin columna | ⚠ transición sin clave (F-41) |
| `ReceiveGoods` | L49 | `inventory:receive` | sí (L141) | sin columna | ✅ |
| `ListPurchaseOrders` | L49 | `inventory:purchase:manage` | — | sin columna | ✅ fila combinada |
| `GetReorderSuggestions` | L50 | `inventory:read` | — | sin columna | ✅ |


### logistics (`logistics.proto` · 13 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `UpsertCarrier` | L33 | `logistics:manage` | no | sin columna | ⚠ celda agrupa 4 RPC (F-42) |
| `ListCarriers` | L33 | `logistics:read` | — | sin columna | ✅ fila combinada |
| `UpsertDriver` | L33 | `logistics:manage` | no | sin columna | ⚠ sin clave |
| `ListDrivers` | L33 | `logistics:read` | — | sin columna | ✅ fila combinada |
| `CreateDelivery` | L34 | `logistics:manage` / orders | sí (L67) | sin columna | ✅ |
| `AssignDelivery` | L35 | `logistics:manage` | no | sin columna | ⚠ transición sin clave (F-43) |
| `RecordCheckpoint` | L36 | `logistics:deliver` | sí (L69) | sin columna | ✅ |
| `CancelDelivery` | L37 | `logistics:manage` | no | sin columna | ⚠ transición sin clave (F-43) |
| `GetDelivery` | L38 | `logistics:read` | — | sin columna | ✅ fila combinada |
| `ListDeliveries` | L38 | `logistics:read` | — | sin columna | ✅ fila combinada |
| `ListMyDeliveries` | L38 | `logistics:deliver` | — | sin columna | ✅ app del repartidor |
| `GetPublicTracking` | L39 | público con token | — | sin columna | ✅ |
| `StreamDelivery` | L40 | comercio/repartidor/cliente vía gateway | — | sin columna | ✅ stream |


### notifications (`notifications.proto` · 13 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `Send` | L33 | servicios internos | sí (L50) | sin columna | ⚠ SPEC lo llama `dedupe_key` (F-44) |
| `SendBatch` | L33 | servicios internos | sí por elemento (L73) | sin columna | ⚠ clave por elemento no declarada |
| `GetNotification` | L34 | servicios / plataforma | — | sin columna | ✅ |
| `ListInbox` | L35 | propio usuario | — | sin columna | ✅ |
| `MarkRead` | L35 | propio usuario | no | sin columna | ⚠ mutación sin clave (F-45) |
| `StreamInbox` | L35 | propio usuario | — | sin columna | ✅ stream |
| `RegisterDevice` | L36 | propio usuario | no | sin columna | ⚠ sin clave |
| `UnregisterDevice` | L36 | propio usuario | no | sin columna | ⚠ borrado idempotente natural |
| `GetPreferences` | L37 | propio usuario | — | sin columna | ✅ |
| `SetPreferences` | L37 | propio usuario | no | sin columna | ⚠ PUT idempotente natural |
| `UpsertTemplate` | L38 | `notifications:template:manage` | no | sin columna | ⚠ plantillas versionadas (F-46) |
| `ListTemplates` | L38 | plataforma | — | sin columna | ✅ fila combinada |
| `HandleInboundWebhook` | L39 | gateway | — | sin columna | ⚠ sin errores documentados |


### payroll (`payroll.proto` · 16 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `UpsertEmployee` | L40 | `payroll:employee:manage` | no | sin columna | ⚠ crea destino de dinero sin clave (F-47) |
| `GetEmployee` | L40 | `payroll:employee:read` | — | sin columna | ✅ fila combinada |
| `ListEmployees` | L40 | `payroll:employee:read` | — | sin columna | ✅ fila combinada |
| `UpsertShift` | L41 | `payroll:employee:manage` | no | sin columna | ⚠ sin clave |
| `AssignSchedule` | L41 | `payroll:employee:manage` | no | sin columna | ⚠ clave natural no declarada |
| `ListSchedule` | L41 | `payroll:employee:read` | — | sin columna | ✅ fila combinada |
| `ClockEvent` | L42 | `payroll:attendance:record` / quiosco | sí (L78) | sin columna | ⚠ SPEC lo llama `client_txn_id` (F-48) |
| `ListAttendance` | L43 | `payroll:attendance:read` / propio | — | sin columna | ✅ |
| `EnrollBiometric` | L44 | manage + consentimiento | no | sin columna | ⚠ reescribe plantilla sin clave |
| `CreateKioskSession` | L45 | `payroll:employee:manage` | no | sin columna | ⚠ reintento = 2 sesiones válidas (F-49) |
| `CreatePayrollRun` | L46 | `payroll:run:create` | sí (L124) | sin columna | ✅ |
| `GetPayrollRun` | L46 | `payroll:run:read` | — | sin columna | ✅ fila combinada |
| `ListPayrollRuns` | L46 | `payroll:run:read` | — | sin columna | ✅ fila combinada |
| `ApprovePayrollRun` | L47 | `payroll:run:approve` + step-up | no | sin columna | ⚠ transición inmutable sin clave (F-50) |
| `PayPayrollRun` | L48 | `payroll:run:pay` + step-up | sí (L129) | sin columna | ✅ clave interna `payroll:<run>:<employee>` |
| `GetPayslip` | L49 | `payroll:payslip:read:self` / `:read` | — | sin columna | ⚠ SPEC dice "PDF", el proto no lleva objeto |


### geolocation (`geolocation.proto` · 9 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `IngestLocations` | L26 | gateway (`logistics:deliver` / `payroll:attendance:record`) | no | sin columna | ⚠ única escritura, sin dedupe (F-51) |
| `GetLastLocation` | L27 | logistics, payroll, gateway | — | sin columna | ✅ fila combinada |
| `GetTrack` | L27 | logistics, payroll, gateway | — | sin columna | ✅ rango ≤ 24 h |
| `WatchSubject` | L28 | gateway / logistics | — | sin columna | ✅ stream |
| `FindNearby` | L29 | logistics | — | sin columna | ✅ |
| `IsInside` | L30 | payroll, logistics | — | sin columna | ✅ |
| `UpsertGeofence` | L31 | `logistics:geofence:manage` | no | sin columna | ⚠ clave natural no declarada |
| `ListGeofences` | L31 | `logistics:geofence:manage` | — | sin columna | ✅ fila combinada |
| `DeleteGeofence` | L31 | `logistics:geofence:manage` | — | sin columna | ✅ fila combinada |


### analytics-bi (`analytics.proto` · 14 RPC)

| RPC | Fila en SPEC §4 | Permiso documentado | Idemp. en el `.proto` | Idemp. en el SPEC | Nota |
|---|---|---|---|---|---|
| `ListMetrics` | L18 | `analytics:read` | — | sin columna | ✅ |
| `QueryMetric` | L18 | `analytics:read` | — | sin columna | ✅ `value_minor` para dinero |
| `GetForecast` | L19 | `analytics:read` | — | sin columna | ⚠ `double` en dinero (F-52) |
| `ListSegments` | L20 | `analytics:read` | — | sin columna | ✅ |
| `GetProductAbc` | L21 | `analytics:read` | — | sin columna | ✅ `revenue_minor` |
| `UpsertDashboard` | L22 | `analytics:dashboard:manage` | no | sin columna | ⚠ sin clave |
| `ListDashboards` | L22 | `analytics:read` | — | sin columna | ✅ fila combinada |
| `GetDashboard` | L22 | `analytics:read` | — | sin columna | ✅ fila combinada |
| `UpsertAlertRule` | L23 | `analytics:alert:manage` | no | sin columna | ⚠ `threshold` en `double` (F-52) |
| `ListAlertRules` | L23 | `analytics:read` | — | sin columna | ✅ fila combinada |
| `ListAlertEvents` | L23 | `analytics:read` | — | sin columna | ⚠ `observed_value` en `double` (F-52) |
| `CreateExport` | L24 | `analytics:export` | no | sin columna | ⚠ job duplicable (F-53) |
| `GetExport` | L24 | `analytics:export` | — | sin columna | ✅ fila combinada |
| `AskQuestion` | L25 | `analytics:read` | — | — | ⚠ documentado, ausente del `.proto` (pendiente F03.2) |

