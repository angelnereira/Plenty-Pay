# SPEC — api-gateway

## 1. Responsabilidad
**Hace**: única puerta de entrada de la app Flutter y de terceros (webhooks). Termina HTTPS, valida tokens, aplica rate limits, verifica el permiso por ruta, construye el contexto de petición (`x-pp-*`), traduce JSON ↔ gRPC, expone el WebSocket de tiempo real, publica OpenAPI.
**No hace**: lógica de negocio, acceso a bases de datos, cálculo de nada. Si una ruta necesita "pensar", el pensamiento va al servicio.

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto | 8080 HTTP(S) público / 9100 admin |
| Contratos | consume todos los `.proto` de servicios que expone (`consumers.txt`) |
| Datos | ninguno propio; NATS KV (contadores de rate limit, F09.6) y consumo de `pp.identity.session.revoked.v1` |
| Fase | F09 (núcleo), crece con cada fase que expone rutas |
| Capa de arranque | L5 |

**Estado actual**: implementado `GET /healthz`, `POST /v1/auth/{login,register,refresh}` (register reenvía los consentimientos y propaga el `reason` de identity), `GET /v1/me`, `GET /v1/me/permissions` (devuelve `role`, `enabled_modules`, `permissions`), middleware `RequireAuth`, errores `{"error","reason","request_id"}`, `X-Request-Id` respetado o generado (UUIDv7) y devuelto, propagación de `traceparent` y `x-pp-request-id` a identity, log de acceso JSON por petición, recuperación de pánicos, cuerpo ≤ 1 MiB con campos desconocidos rechazados. 10 pruebas unitarias + E2E con identity (14 comprobaciones).

## 3. Cadena de middleware (orden obligatorio)
1. Recuperación de pánico → 500 `INTERNAL` con `request_id`.
2. `X-Request-Id`: si viene y es UUID válido se respeta, si no se genera UUIDv7; se devuelve en la respuesta.
3. Trazas (W3C `traceparent`) y log de acceso.
4. Límite de cuerpo (1 MiB; 256 KB en webhooks; 10 MiB en importaciones con streaming) y `Content-Type: application/json` en mutaciones.
5. CORS: solo orígenes de `web` configurados (`ALLOWED_ORIGINS`).
6. Rate limit (§6).
7. Autenticación (`Authorization: Bearer`): `identity.ValidateToken` (F09) → validación local EdDSA/JWKS con caché de revocaciones (F28).
8. Autorización por ruta: permiso de la tabla §4 contra `permissions` de la sesión (caché 60 s por usuario, invalidada por `SessionRevoked` y por `session.permissions_changed`).
9. Construcción de metadatos gRPC `x-pp-request-id`, `x-pp-user-id`, `x-pp-tenant-id`, `x-pp-role`, `x-pp-permissions`, `x-pp-branch-scope`, `x-pp-capabilities` (ADR 0018; los dos últimos salen de `ValidateToken`), `x-pp-actor-service=api-gateway`, `traceparent`, `x-pp-step-up` (desde cabecera `X-Step-Up-Token`).
10. Handler: decodificación JSON estricta → request proto → llamada con deadline → respuesta proto → JSON (`protojson`, nombres `snake_case`, enums como string sin prefijo, int64 como **número** si ≤ 2^53, como string si mayor).
11. Traducción de errores gRPC → HTTP según `grpc-conventions.md` §4, cuerpo `{"error": "<mensaje es>", "reason": "<REASON>", "request_id": "..."}`.

## 4. Tabla de rutas (contrato con Flutter; OpenAPI se genera de aquí)
Convenciones: `{id}` = UUIDv7; listas aceptan `?page_size=&page_token=`; mutaciones de dinero/estado exigen `Idempotency-Key` (16–100 chars) que se copia al campo `idempotency_key` del request. 🔒 = requiere step-up según `security-standards.md` §4.

### 4.1 Autenticación y cuenta (F09, F08)
| Método y ruta | RPC | Permiso |
|---|---|---|
| POST `/v1/auth/register` | identity.Register (rol forzado CUSTOMER; consents del cuerpo) | público |
| POST `/v1/auth/login` | identity.Login | público |
| POST `/v1/auth/refresh` | identity.RefreshToken | público |
| POST `/v1/auth/logout` | identity.Logout | autenticado |
| POST `/v1/auth/password/forgot` · `/reset` | RequestPasswordReset · ConfirmPasswordReset | público |
| POST `/v1/auth/passkeys/login/begin` · `/finish` | BeginPasskeyLogin · FinishPasskeyLogin | público (límite de `/v1/auth/*`) |
| GET `/v1/me/passkeys` | ListPasskeys | autenticado |
| POST `/v1/me/passkeys/register/begin` · `/finish` | BeginPasskeyRegistration · FinishPasskeyRegistration | 🔒 `identity.passkey.register` |
| DELETE `/v1/me/passkeys/{passkey_id}` | RevokePasskey | 🔒 `identity.passkey.revoke` |
| GET `/v1/me/step-up-pin` | GetStepUpPinStatus | autenticado |
| PUT `/v1/me/step-up-pin` | SetStepUpPin | 🔒 `identity.pin.set` (nivel 3: contraseña) |
| GET `/v1/me` | identity.ValidateToken (+ perfil) | autenticado |
| GET `/v1/me/permissions` | identity.GetUserPermissions | autenticado |
| POST `/v1/me/password` 🔒 | ChangePassword | autenticado |
| GET `/v1/me/sessions` · DELETE `/v1/me/sessions/{id}` | ListSessions · RevokeSession | autenticado |
| POST `/v1/step-up/challenge` · `/v1/step-up/verify` | IssueStepUpChallenge · VerifyStepUp (el usuario sale del token; un `user_id` del cuerpo se descarta, identity R26) | autenticado |
| POST `/v1/business` | CreateBusiness | autenticado sin tenant |
| GET `/v1/business` | GetTenant | miembro |
| POST `/v1/business/documents/upload-url` | catalog.CreateUploadUrl (propósito `kyb`) | `admin:business:manage` |
| GET `/v1/business/staff` · POST `/v1/business/staff` | ListUsers · InviteStaff (rol, alcance `TENANT`/`BRANCHES`, cargo) | `admin:users:manage` |
| PUT `/v1/business/staff/{user_id}/membership` | UpdateMembership (rol, alcance, cargo; A1–A3; `STEP_UP_REQUIRED` si el rol incluye permisos de dinero 🔒) | `admin:users:manage` |
| POST `/v1/business/staff/{user_id}/suspend` · `/reactivate` | SuspendUser · ReactivateUser | `admin:users:manage` |
| DELETE `/v1/business/staff/{user_id}` | DeactivateUser | `admin:users:manage` |
| GET `/v1/business/invitations` · POST `/v1/business/invitations/{invitation_id}/resend` · DELETE `/v1/business/invitations/{invitation_id}` | ListInvitations · ResendInvitation · RevokeInvitation | `admin:users:manage` |
| POST `/v1/invitations/preview` | PreviewInvitation (S-GEN-17: negocio, rol, alcance y si el correo ya tiene cuenta; el token va en el cuerpo, nunca en la URL) | público con token |
| POST `/v1/invitations/accept` | AcceptInvitation (cuenta nueva: `consents` R18 y `full_name`) | público con token |
| GET `/v1/business/roles` · POST `/v1/business/roles` 🔒 (crear y editar: `role.role_id` vacío = crear) · DELETE `/v1/business/roles/{role_id}` | ListRoles · UpsertRole · ArchiveRole | `admin:roles:manage` |
| POST `/v1/business/roles/{user_id}/assign` 🔒 | AssignRole (compat.; la app usa `membership`) | `admin:roles:manage` |
| GET `/v1/access/catalog` · GET `/v1/verticals` · GET `/v1/role-templates` | GetAccessCatalog · ListVerticals · ListRoleTemplates | autenticado |
| GET `/v1/business/profile` · PUT `/v1/business/profile` | GetBusinessProfile · UpdateBusinessProfile | miembro / `admin:business:manage` |
| PUT `/v1/business/capabilities` | SetCapabilities | `admin:business:manage` |
| GET `/v1/business/branches` · POST `/v1/business/branches` (`branch.branch_id` vacío = crear) · POST `/v1/business/branches/{branch_id}/deactivate` · `/reactivate` | ListBranches · UpsertBranch · DeactivateBranch · ReactivateBranch | miembro / `admin:business:manage` |

### 4.2 Billetera y pagos (F11, F23)
**Implementado (2026-10-20)**: los saldos, extractos, intents, cobros, terminales y políticas de esta tabla, con su `Backend` en `internal/routes/table.go`. Reglas:
- El ledger solo se **lee**, y la cuenta de la billetera siempre es la de la persona del token (`FromCaller`). Lo que mande el cliente en el cuerpo o el query se ignora.
- Las rutas que piden «`wallet:pay` o `payments:charge`» no tienen permiso único en el gateway. La primera barrera es la autenticación y payments-core decide (R23, defensa en profundidad).
- `X-Step-Up-Token` viaja como `x-pp-step-up`.
- Si payments-core o el ledger no responden: `503`.
- `POST /v1/wallet/topups` (F11.7) fija `reference.type=topup` y vacía `terminal_code`: el cliente no convierte un cobro en recarga. `POST /v1/platform/payments/{id}/resolve` exige `platform:reconcile`.
- Las conexiones a payments-core y ledger resuelven el nombre en cada intento (`passthrough`) con reintento ≤ 5 s: si el gateway arranca antes que ellos, se recuperan solas.
- Faltan reembolsos (F11.6) y transferencias P2P: esas rutas no están en la tabla.

| Método y ruta | RPC | Permiso |
|---|---|---|
| GET `/v1/wallet/balance` | ledger.GetBalance (party = user) | `wallet:read` |
| GET `/v1/wallet/statement` | ledger.GetStatement | `wallet:read` |
| POST `/v1/wallet/topups` | payments.CreatePaymentIntent (reference `topup`) | `wallet:topup` |
| POST `/v1/wallet/transfers` 🔒(≥ umbral) | payments.CreatePaymentIntent (WALLET, reference `transfer`) + Confirm | `wallet:transfer` |
| GET `/v1/pay-links/{code}` | payments.ResolveTerminal | autenticado |
| POST `/v1/payments/intents` 🔒(≥ umbral) | CreatePaymentIntent | `wallet:pay` (pagador) o `payments:charge` (comercio) |
| POST `/v1/payments/intents/{id}/confirm` | ConfirmPaymentIntent | ídem |
| POST `/v1/payments/intents/{id}/cancel` | CancelPaymentIntent | ídem |
| GET `/v1/payments/intents/{id}` | GetPaymentIntent | ídem o `payments:read` |
| GET `/v1/payments` · `/v1/payments/{id}` | ListPayments · GetPayment | `payments:read` |
| POST `/v1/payments/{id}/refunds` 🔒 | RefundPayment | `payments:refund` |
| GET `/v1/payments/quote?amount=&rail=` | QuoteFees | `payments:charge` o `wallet:pay` |
| GET/POST `/v1/terminals` · POST `/v1/terminals/{id}/active` | List/Create/SetTerminalActive | `payments:terminal:manage` |
| GET/PUT `/v1/fee-policies` | List/UpsertFeePolicy | `payments:fees:read` / `platform:flags:manage` |
| POST `/v1/platform/payments/{id}/resolve` | ResolveUnknownPayment | `platform:reconcile` |

### 4.3 Finanzas del comercio: liquidación y fiscal (F12, F13)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET `/v1/settlement/summary` | GetPayoutSummary (por liquidar, en proceso y próxima fecha) | `settlement:read` |
| GET/PUT `/v1/settlement/schedule` 🔒(cambio de destino) | Get/SetPayoutSchedule | `settlement:read` / `settlement:schedule:manage` |
| GET `/v1/settlement/batches?status=` · `/{id}` | ListBatches · GetBatch | `settlement:read` |
| POST `/v1/settlement/batches` | CreateBatch («Liquidar ahora») | `settlement:schedule:manage` |
| GET `/v1/platform/settlement/batches?status=` · POST `/{id}/confirm` · `/{id}/fail` | ListBatches (todos los negocios) · ConfirmPayout · FailPayout | `platform:reconcile` |
| GET `/v1/platform/reconciliation/exceptions` · POST `/{id}/resolve` | List/ResolveException | `platform:reconcile` |
| POST `/v1/platform/reconciliation/statements` | ImportRailStatement | `platform:reconcile` |
| GET/PUT `/v1/fiscal/profile` 🔒 | Get/ConfigureFiscalProfile | `fiscal:read` / `fiscal:profile:manage` |
| GET `/v1/fiscal/invoices` · `/{id}` · `/{id}/document?format=pdf\|xml` | List/Get/GetInvoiceDocument | `fiscal:read` |
| POST `/v1/fiscal/invoices` | IssueInvoice | `fiscal:issue` |
| POST `/v1/fiscal/invoices/{id}/credit-notes` · `/debit-notes` | IssueCreditNote · IssueDebitNote | `fiscal:note:issue` |
| GET `/v1/fiscal/taxpayers?q=` · PUT | SearchTaxpayers · UpsertTaxpayer | `fiscal:issue` |
| GET `/v1/fiscal/folios` | GetFolioStatus | `fiscal:read` |
| GET `/v1/fiscal/pac-providers` | ListPacProviders (selector de PAC, ADR 0022) | `fiscal:profile:manage` |

### 4.4 Catálogo, marketplace y pedidos (F15)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET/POST `/v1/catalog/products` · GET/PATCH `/{id}` · POST `/{id}/archive` | List/Create/Get/Update/ArchiveProduct | `catalog:read` / `catalog:write` |
| GET `/v1/catalog/barcode/{code}` | LookupByBarcode | `catalog:read` |
| POST `/v1/catalog/import` (multipart CSV → stream) | BulkImportProducts | `catalog:import` |
| GET/PUT `/v1/catalog/categories` | List/UpsertCategory | `catalog:read` / `catalog:write` |
| POST `/v1/catalog/upload-url` | CreateUploadUrl | `catalog:write` |
| POST `/v1/media/upload` · GET `/media/{clave}` | escritura y lectura en `pp-catalog-media` desde el gateway (ADR 0021: JPEG/PNG/WebP ≤ 5 MB, clave del servidor bajo el tenant) | `catalog:write` · público |
| PUT `/v1/catalog/products/{id}/listing` | SetListing | `catalog:listing:manage` |
| GET/PUT `/v1/storefront` | Get/UpdateStorefront | `catalog:listing:manage` |
| GET `/v1/market/search?q=&category=&near=` | SearchMarketplace | autenticado |
| GET `/v1/market/products/{id}` · `/v1/market/stores/{slug}` | GetMarketplaceProduct · GetStorefront | autenticado |
| GET/PUT/DELETE `/v1/cart` · `/v1/cart/items/{listing_id}` | GetCart · SetCartItem · ClearCart | `orders:create:self` |
| POST `/v1/checkout/quote` · `/v1/checkout` | QuoteCheckout · Checkout | `orders:create:self` |
| GET `/v1/orders/mine` · `/v1/orders/{id}` · POST `/{id}/cancel` | ListMyOrders · GetOrder · CancelOrder | `orders:read:self` |
| GET `/v1/merchant/orders` · POST `/v1/merchant/sub-orders/{id}/{accept\|reject\|ready\|complete}` | ListMerchantOrders · Accept/Reject/MarkReady/MarkCompleted | `orders:read` / `orders:manage` |

### 4.5 Inventario (F16)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET/PUT `/v1/inventory/warehouses` | List/UpsertWarehouse | `inventory:read` / `inventory:adjust` |
| GET `/v1/inventory/stock` · `/v1/inventory/stock/{variant_id}` | ListStock · GetStock | `inventory:read` |
| POST `/v1/inventory/adjustments` · `/v1/inventory/transfers` | AdjustStock · TransferStock | `inventory:adjust` |
| GET `/v1/inventory/movements` | ListMovements | `inventory:read` |
| GET/PUT `/v1/inventory/suppliers` | List/UpsertSupplier | `inventory:purchase:manage` |
| GET/POST `/v1/inventory/purchase-orders` · POST `/{id}/status` · `/{id}/receive` | List/Create/UpdateStatus · ReceiveGoods | `inventory:purchase:manage` / `inventory:receive` |
| GET `/v1/inventory/reorder-suggestions` | GetReorderSuggestions | `inventory:read` |

### 4.6 Punto de venta (F17)
| Método y ruta | RPC | Permiso |
|---|---|---|
| POST `/v1/pos/sessions` · `/v1/pos/sessions/{id}/close` · GET `/{id}` | Open/Close/GetCashSession | `pos:session:manage` |
| POST `/v1/pos/sessions/{id}/cash-movements` | RecordCashMovement | `pos:session:manage` |
| POST `/v1/pos/sales` · PATCH `/{id}` · POST `/{id}/park` · `/{id}/resume` | Create/Update/Park/ResumeSale | `pos:sell` (+ `pos:discount:apply` si hay descuento) |
| POST `/v1/pos/sales/{id}/checkout` | pos.Checkout | `pos:sell` |
| POST `/v1/pos/sales/{id}/void` · `/{id}/refund` 🔒 | VoidSale · RefundSale | `pos:void` · `pos:refund` |
| GET `/v1/pos/sales` · `/{id}` · `/{id}/receipt` | ListSales · GetSale · GetReceipt | `pos:sell` |
| POST `/v1/pos/sync` | SyncOfflineSales | `pos:sell` |
| GET/PUT `/v1/pos/settings` | Get/UpdatePosSettings | `pos:sell` / `pos:settings:manage` |

### 4.7 Logística y geolocalización (F14, F18)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET/PUT `/v1/logistics/carriers` · `/v1/logistics/drivers` | List/UpsertCarrier · List/UpsertDriver | `logistics:read` / `logistics:manage` |
| POST `/v1/logistics/quote` | QuoteDelivery | `logistics:read`, `pos:sell` o `orders:create:self` |
| GET/POST `/v1/logistics/deliveries` · GET `/{id}` · POST `/{id}/assign` · `/{id}/cancel` | List/Create/Get/Assign/CancelDelivery | `logistics:read` / `logistics:manage` |
| POST `/v1/logistics/me/availability` | SetDriverAvailability | `logistics:deliver` |
| GET `/v1/logistics/my-deliveries` · POST `/v1/logistics/deliveries/{id}/checkpoints` | ListMyDeliveries · RecordCheckpoint | `logistics:deliver` |
| GET `/v1/me/deliveries` · GET `/v1/me/deliveries/{id}` | ListCustomerDeliveries · GetCustomerDelivery | `orders:read:self` |
| POST `/v1/geo/pings` (lote ≤ 100) | geolocation.IngestLocations | `logistics:deliver` o `payroll:attendance:record` |
| GET/PUT/DELETE `/v1/geo/geofences` | List/Upsert/DeleteGeofence | `logistics:geofence:manage` |
| GET `/v1/public/tracking/{token}` | logistics.GetPublicTracking | **público** (token opaco ≥ 22 chars, rate limit estricto) |

### 4.8 Nómina (F19)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET/PUT `/v1/payroll/employees` · GET `/{id}` | List/Upsert/GetEmployee | `payroll:employee:read` / `:manage` |
| PUT `/v1/payroll/shifts` · POST `/v1/payroll/schedule` · GET | UpsertShift · AssignSchedule · ListSchedule | `payroll:employee:manage` / `:read` |
| POST `/v1/payroll/clock` | ClockEvent | `payroll:attendance:record` |
| GET `/v1/payroll/attendance` | ListAttendance | `payroll:attendance:read` (o propio) |
| POST `/v1/payroll/biometrics` | EnrollBiometric | `payroll:employee:manage` |
| POST `/v1/payroll/kiosk-sessions` | CreateKioskSession | `payroll:employee:manage` |
| GET/POST `/v1/payroll/runs` · POST `/{id}/approve` 🔒 · `/{id}/pay` 🔒 | List/Create/Approve/PayPayrollRun | `payroll:run:create` / `:approve` / `:pay` |
| GET `/v1/payroll/payslips/{id}` | GetPayslip | `payroll:payslip:read:self` o `payroll:employee:read` |

### 4.9 Notificaciones, analítica, plataforma (F20, F21, F05)
| Método y ruta | RPC | Permiso |
|---|---|---|
| GET `/v1/inbox` · POST `/v1/inbox/{id}/read` | ListInbox · MarkRead | `notifications:read:self` |
| POST/DELETE `/v1/devices` | Register/UnregisterDevice | autenticado |
| GET/PUT `/v1/notification-preferences` | Get/SetPreferences | autenticado |
| GET/PUT `/v1/notification-templates` | List/UpsertTemplate | `notifications:template:manage` |
| GET `/v1/analytics/metrics` · `/v1/analytics/metrics/{id}/query` · `/forecast` · `/segments` · `/abc` | ListMetrics · QueryMetric · GetForecast · ListSegments · GetProductAbc | `analytics:read` |
| GET/PUT `/v1/analytics/dashboards` · `/alerts` · POST `/v1/analytics/exports` | dashboards · alertas · CreateExport | `analytics:dashboard:manage` · `:alert:manage` · `:export` |
| POST `/v1/analytics/ask` (F21.8) | analytics.AskQuestion *(RPC a agregar)* | `analytics:read` |
| GET `/v1/client-config` | infra.GetClientConfig | público (sin datos sensibles) |
| GET/PUT `/v1/platform/flags` · POST `/v1/platform/maintenance` | ListFlags · UpsertFlag · SetMaintenanceMode | `platform:flags:manage` |
| GET `/v1/platform/tenants` · POST `/{id}/review` | ListTenants · ReviewBusiness | `platform:tenants:review` |
| GET `/v1/platform/audit` · `/v1/business/audit` | security.QueryAuditEvents (scoped) | `platform:security:read` / `admin:audit:read` |
| GET `/v1/platform/services` | infra.ListServices | `platform:support` |

### 4.10 Webhooks (sin token de usuario; firma obligatoria)
| Ruta | Destino |
|---|---|
| POST `/v1/webhooks/rails/{rail}` | payments.HandleRailWebhook (bytes crudos + cabeceras) |
| POST `/v1/webhooks/fiscal/{pac}` | fiscal.RefreshInvoiceStatus (tras verificar firma en fiscal) |
| POST `/v1/webhooks/notifications/{provider}` | notifications.HandleInboundWebhook (Jelou/WhatsApp, rebotes de correo) |
El gateway **no** interpreta el cuerpo: lo reenvía; la verificación de firma la hace el servicio dueño (tiene el secreto vía security). Rechazos → 401 sin detalle.

### 4.11 Otros
`GET /healthz` (compatibilidad), `GET /v1/openapi.json` (F09.7), `GET /v1/realtime` (WebSocket, §5).

## 5. WebSocket `/v1/realtime`
- Autenticación: primer mensaje `{"type":"auth","token":"<access>"}` en ≤ 5 s (no en la URL); renovación con otro `auth` antes de expirar.
- Mensajes cliente → servidor: `{"type":"subscribe","id":"<sub_id>","topic":"<topic>","params":{...}}`, `{"type":"unsubscribe","id":...}`, `{"type":"ping"}`.
- Servidor → cliente: `{"type":"event","sub":"<sub_id>","topic":...,"data":{...},"seq":n}`, `{"type":"error","reason":...}`, `{"type":"pong"}`.

| Topic | Fuente | Permiso / filtro |
|---|---|---|
| `inbox` | notifications.StreamInbox | propio usuario |
| `payment.status` (`params.payment_intent_id`) | payments-core (eventos `PaymentCaptured/Failed/Unknown` vía NATS → gateway) | pagador o comercio dueño |
| `delivery` (`params.delivery_id`) | logistics.StreamDelivery | comercio, repartidor asignado o cliente del pedido |
| `customer_display` (`params.register_id`) | pos.StreamCustomerDisplay | dispositivo emparejado del tenant |
| `geo.subject` (`params.subject_id`) | geolocation.WatchSubject | `logistics:read` |
| `session` | identity `SessionRevoked` / cambio de permisos | propio usuario (fuerza cierre o recarga) |

Límites: 1 conexión WebSocket por sesión de dispositivo, 20 suscripciones por conexión, ping cada 25 s, cierre si 2 pings sin respuesta. Reconexión del cliente con backoff y `resume_from_seq` (el gateway reenvía lo perdido de los últimos 60 s si lo tiene; si no, el cliente recarga por REST).

## 6. Rate limits (por defecto; configurables en infra-management)
| Ámbito | Límite |
|---|---|
| `/v1/auth/login`, `/register`, `/password/*` | 10/min por IP y 5/min por correo |
| `/v1/public/tracking/*`, `/v1/pay-links/*` | 60/min por IP |
| Mutaciones de dinero | 30/min por usuario |
| Resto autenticado | 600/min por usuario |
| Webhooks | 1 200/min por proveedor |
Exceso → 429 `RATE_LIMITED` + `Retry-After`. Contadores en NATS KV (ventana deslizante) para que funcionen con varias réplicas.

## 7. Reglas
- **R1** Sin token o token inválido → 401 `TOKEN_INVALID`; identity caída → 503 `IDENTITY_UNAVAILABLE` (nunca 401: no cerrar sesión por una caída).
- **R2** Registro público ignora cualquier rol enviado y fuerza `CUSTOMER`.
- **R2b** `POST /v1/auth/register` acepta `consents: [{purpose, text_version, granted}]` (máx. 10) y los reenvía tal cual a identity; `channel` (`app`) y `device` (User-Agent recortado a 200 caracteres) los fija el gateway y se rechazan si vienen en el cuerpo (N-DAT-02). El `reason` que devuelve identity se propaga sin modificar para que la app lo traduzca.
- **R3** JSON estricto: campos desconocidos → 400 `INVALID_JSON`; cuerpo > límite → 413 `BODY_TOO_LARGE`.
- **R4** Permiso de la ruta ausente → 403 `PERMISSION_DENIED` sin llamar al servicio.
- **R5** El tenant/usuario de los metadatos sale **solo** del token validado; cabeceras `x-pp-*` entrantes del cliente se descartan.
- **R6** Rutas con 🔒 sin `X-Step-Up-Token` → 403 `STEP_UP_REQUIRED` con `{"operation","amount_minor"}` para que la app inicie el desafío (el servicio valida y consume el token).
- **R7** Mutaciones de dinero sin `Idempotency-Key` → 400 `IDEMPOTENCY_KEY_REQUIRED`.
- **R8** Errores del servicio se traducen sin filtrar mensajes internos (`INTERNAL` → mensaje genérico).
- **R9** Webhooks: cuerpo crudo intacto (sin re-serializar) para la verificación de firma.
- **R10** Al recibir `SessionRevoked`, cerrar WebSockets de esas sesiones en ≤ 5 s.
- **R11** Modo mantenimiento (infra-management): mutaciones → 503 `MAINTENANCE_MODE` excepto rutas de plataforma; lecturas siguen.

## 8. Configuración
| Variable | Oblig. | Default |
|---|---|---|
| `PORT` | no | `8080` (implementado) |
| `ADMIN_PORT` | no | `9100` — salud `/healthz/live` y `/healthz/ready` (implementado, F02.1) y `/metrics` (contadores, implementado) |
| `LOG_LEVEL` | no | `info` (`debug`, `info`, `warn`, `error`) |
| `DEPLOY_ENV` | no | `dev` — valor de `deployment.environment.name` |
| `OTEL_TRACES_EXPORTER` | no | vacío (no exporta) o `console` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | colector OTLP gRPC; si se define, tiene prioridad |
| `IDENTITY_SERVICE_URL` | sí | `identity:50060` (implementado) |
| `<SERVICIO>_ADDR` por servicio expuesto | sí al activar su fase | `<servicio>:<puerto>` |
| `ALLOWED_ORIGINS` | sí en prod | — |
| `NATS_URL` | sí (F09.6+) | — |
| `TLS_CERT_FILE`/`TLS_KEY_FILE` | prod sin ingress TLS | — |

## 9. Observabilidad
`pp_http_requests_total{route,status}` (route = plantilla, nunca la URL con ids), `pp_http_duration_seconds{route}`, `pp_ws_connections_current`, `pp_rate_limited_total{route}`, `pp_webhook_forwarded_total{provider,result}`.

## 10. Seguridad
Cabeceras: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` en respuestas autenticadas. Nunca registrar `Authorization`, cuerpos de login ni de webhooks.

## 11. Pruebas de aceptación
1. Login correcto → 200 con tokens; incorrecto → 401 `INVALID_CREDENTIALS`; identity apagado → 503.
2. `GET /v1/me/permissions` de un CUSTOMER devuelve `enabled_modules=["wallet","marketplace"]`.
3. Ruta de reembolso sin permiso → 403 sin tráfico hacia payments-core (verificado con doble de prueba).
4. Cuerpo con campo desconocido → 400 `INVALID_JSON`.
5. Golden tests: cada ruta de §4 tiene un caso de traducción JSON↔proto.
6. WebSocket: sin `auth` en 5 s se cierra; `SessionRevoked` cierra la conexión.

## 12. Plan de implementación
F09.1 núcleo auth (✅) → F09.2 interceptor de metadatos `x-pp-*` (✅) → F09.3 traductor genérico JSON↔proto + tabla de rutas declarativa (✅) → F09.4 errores con `ErrorInfo` (✅) → F09.5 WebSocket con topic `session`/`inbox` (L1 listo, L4 pendiente) → F09.6 rate limits NATS KV → F09.7 OpenAPI generado → cada fase posterior agrega sus rutas (golden tests).

## 13. Riesgos
Crecimiento de la tabla de rutas: mantenerla **declarativa** (un archivo `internal/routes/routes.go` con ruta, método, RPC, permiso, step-up, idempotencia) para que la tabla de este SPEC, OpenAPI y el código no diverjan.
