# Estándares de seguridad

Aplica a todos los contenedores y a la app Flutter. Es la base mínima: un SPEC puede endurecerla, nunca relajarla. Marco regulatorio de referencia: `03-PAGOS-WALLET-NFC-CUMPLIMIENTO.md` (Superintendencia de Bancos de Panamá, DGI, PCI DSS, Ley 81 de 2019 de protección de datos).

## 1. Modelo de amenazas (resumen operativo)

| Amenaza | Dónde | Control obligatorio | Dónde se implementa |
|---|---|---|---|
| Robo de credenciales / fuerza bruta | login | bcrypt ≥ 12, bloqueo progresivo, mismo mensaje de error, rate limit por IP y por cuenta | identity, api-gateway |
| Robo de token | cliente, red | access 15 min, refresh rotado con detección de reuso, almacenamiento seguro del SO, TLS + pinning | identity, flutter_app |
| Escalada de privilegios | cualquier RPC | permisos por RPC (deny-by-default), tenant de metadatos, RLS | todos |
| Acceso entre comercios (IDOR) | consultas | filtro por tenant + RLS + `NOT_FOUND` para recursos ajenos | todos |
| Doble cobro / doble asiento | pagos, ledger | idempotencia, índice único parcial, máquina de estados | payments-core, ledger |
| Manipulación del libro | ledger | POSTED inmutable (triggers), solo ledger escribe, reversas | ledger, postgres-db |
| Webhook falsificado | rieles | firma HMAC/asimétrica verificada, ventana de tiempo, fail-closed | payments-core |
| Fuga de secretos | repo, imágenes, logs | OpenBao, gitleaks en CI, logs redactados | security, CI |
| Fuga de datos de tarjeta | pagos | nunca PAN/CVV; tokenización del procesador (SAQ A) | payments-core, flutter_app |
| Suplantación entre servicios | red interna | mTLS SPIFFE (Fase 5), red privada antes | todos |
| Denegación de servicio | gateway | rate limits, timeouts, tamaño máximo de cuerpo, circuit breakers | api-gateway |
| Lectura de QR/NFC malicioso | app | solo NDEF, validación de host y formato, nombre del comercio verificado en servidor | flutter_app |
| Pérdida del dispositivo | app | biometría local para abrir sesión y para step-up, revocación remota de sesiones | flutter_app, identity |

## 2. Autenticación de usuarios
1. **Contraseña**: mínimo 12 caracteres, máximo 128; se rechaza si está en la lista de contraseñas comunes (top 100k, embebida en identity). Hash bcrypt costo ≥ 12 (migrable a argon2id sin romper: el hash guarda su algoritmo).
2. **Tokens**: access JWT 15 min; refresh opaco o JWT 30 días con **rotación en cada uso**. Si un refresh ya usado vuelve a presentarse → **reuse detection**: se revocan todas las sesiones de esa familia y se emite evento `identity.session.revoked`.
3. Firma: HS256 con secretos separados para access y refresh (≥ 32 bytes, distintos) mientras exista un solo emisor; **objetivo Fase 28 (F28.1): EdDSA (Ed25519)** con `kid` y JWKS publicado por identity para que el gateway valide localmente. Validación siempre con lista explícita de algoritmos (nunca aceptar `none` ni algoritmo del header).
4. **Bloqueo progresivo** por cuenta: 5 fallos → 1 min; 10 → 15 min; 20 → 24 h + notificación al usuario. El contador se reinicia tras login exitoso. El error es siempre el mismo (`INVALID_CREDENTIALS`) para no revelar si el correo existe.
5. **Registro**: el endpoint público solo crea `CUSTOMER`. Los negocios nacen en `PENDING_REVIEW` (no pueden cobrar hasta aprobación, `domain-model.md` §3).
6. **Passkeys/WebAuthn** (ADR 0020, F28.2) como inicio de sesión opcional sin contraseña y método preferido de confirmación fuerte: verificación de usuario obligatoria, llave residente, atestación `none`, verificación en identity con `go-webauthn/webauthn` (versión fija). La biometría del dispositivo solo libera la llave o desbloquea la app; nunca se envía al servidor ni es prueba. Sin `WEBAUTHN_RP_ID` (Q-39) las passkeys están apagadas (`PASSKEYS_UNAVAILABLE`). Diseño completo: [`docs/security/strong-authentication.md`](../security/strong-authentication.md).
7. **Recuperación de contraseña**: token de un solo uso, 30 min, hash guardado (no el token), invalida todas las sesiones al completarse.
8. **PIN de confirmación**: 6 dígitos, guardado con el esquema de la contraseña (§2.1) y verificado solo por identity; tras `stepup.pin.max_attempts` (3) fallos se bloquea `stepup.pin.lock_minutes` (5) y se reporta a security. Crearlo o cambiarlo exige la contraseña (nivel 3).

## 3. Autorización
1. **Deny-by-default**: cada RPC declara en su SPEC el permiso exigido. Sin declaración = no se expone.
2. El gateway hace una primera verificación (ruta → permiso); **cada servicio vuelve a verificar** con `x-pp-permissions` (defensa en profundidad).
3. Permisos con formato `<módulo>:<acción>[:<calificador>]`.

### 3.1 Catálogo de permisos y mapeo a capacidades (fuente de verdad)

Un permiso de negocio está activo si **al menos una** de sus capacidades asociadas está encendida en el negocio. Cuando la columna lista varias capacidades, basta cualquiera (p. ej. una barbería sin `catalog.products` gestiona su catálogo de servicios con `catalog:write` gracias a `catalog.services`). Los permisos marcados como `(núcleo)` no dependen de capacidades y están siempre activos si el rol los contiene. Los permisos de `(plataforma)` aplican exclusivamente a `PLATFORM_ADMIN`.

| Módulo | Permiso | Capacidad asociada |
|---|---|---|
| wallet | `wallet:read` | `(núcleo)` |
| wallet | `wallet:topup` | `(núcleo)` |
| wallet | `wallet:transfer` | `(núcleo)` |
| wallet | `wallet:pay` | `(núcleo)` |
| payments | `payments:charge` | `finance.payments` |
| payments | `payments:read` | `finance.payments` |
| payments | `payments:refund` | `finance.payments` |
| payments | `payments:terminal:manage` | `finance.terminals` |
| payments | `payments:fees:read` | `finance.payments` |
| payments | `payments:fees:manage` | `finance.payments` |
| settlement | `settlement:read` | `finance.settlement` |
| settlement | `settlement:schedule:manage` | `finance.settlement` |
| settlement | `settlement:reconcile` | `finance.settlement` |
| fiscal | `fiscal:read` | `finance.fiscal` |
| fiscal | `fiscal:issue` | `finance.fiscal` |
| fiscal | `fiscal:note:issue` | `finance.fiscal` |
| fiscal | `fiscal:profile:manage` | `finance.fiscal` |
| catalog | `catalog:read` | `(núcleo)` |
| catalog | `catalog:write` | `catalog.products`, `catalog.services` |
| catalog | `catalog:import` | `catalog.products`, `catalog.services` |
| catalog | `catalog:listing:manage` | `catalog.listing` |
| catalog | `catalog:pricelist:manage` | `catalog.price_lists` |
| inventory | `inventory:read` | `inventory.stock` |
| inventory | `inventory:adjust` | `inventory.stock` |
| inventory | `inventory:purchase:manage` | `inventory.purchasing` |
| inventory | `inventory:receive` | `inventory.purchasing` |
| inventory | `inventory:recipe:manage` | `inventory.recipes` |
| pos | `pos:read` | `pos.counter` |
| pos | `pos:sell` | `pos.counter` |
| pos | `pos:void` | `pos.counter` |
| pos | `pos:refund` | `pos.counter` |
| pos | `pos:session:manage` | `pos.counter` |
| pos | `pos:settings:manage` | `pos.counter` |
| pos | `pos:discount:apply` | `pos.counter` |
| pos | `pos:table:manage` | `pos.tables` |
| pos | `pos:kitchen:update` | `pos.kitchen_display` |
| pos | `pos:credit:approve` | `pos.house_credit` |
| orders | `orders:read:self` | `(núcleo)` |
| orders | `orders:create:self` | `(núcleo)` |
| orders | `orders:read` | `orders.marketplace` |
| orders | `orders:manage` | `orders.marketplace` |
| orders | `orders:quote:manage` | `orders.quotes` |
| appointments | `appointments:read` | `appointments.calendar` |
| appointments | `appointments:read:self` | `appointments.calendar` |
| appointments | `appointments:book` | `appointments.calendar` |
| appointments | `appointments:checkin` | `appointments.queue` |
| appointments | `appointments:manage` | `appointments.calendar` |
| appointments | `appointments:settings:manage` | `appointments.calendar` |
| logistics | `logistics:read` | `logistics.own_fleet` |
| logistics | `logistics:deliver` | `logistics.own_fleet` |
| logistics | `logistics:manage` | `logistics.own_fleet` |
| logistics | `logistics:geofence:manage` | `logistics.geofences` |
| logistics | `logistics:fleet:manage` | `logistics.fleet` |
| logistics | `logistics:route:plan` | `logistics.routes` |
| payroll | `payroll:employee:read` | `payroll.runs` |
| payroll | `payroll:employee:manage` | `payroll.runs` |
| payroll | `payroll:attendance:record` | `payroll.attendance` |
| payroll | `payroll:attendance:read` | `payroll.attendance` |
| payroll | `payroll:run:create` | `payroll.runs` |
| payroll | `payroll:run:approve` | `payroll.runs` |
| payroll | `payroll:run:pay` | `payroll.runs` |
| payroll | `payroll:payslip:read:self` | `payroll.runs` |
| payroll | `payroll:commission:read:self` | `payroll.commissions` |
| payroll | `payroll:commission:manage` | `payroll.commissions` |
| analytics | `analytics:read` | `analytics.dashboards` |
| analytics | `analytics:dashboard:manage` | `analytics.dashboards` |
| analytics | `analytics:alert:manage` | `analytics.dashboards` |
| analytics | `analytics:export` | `analytics.export` |
| admin | `admin:users:manage` | `(núcleo)` |
| admin | `admin:roles:manage` | `(núcleo)` |
| admin | `admin:business:manage` | `(núcleo)` |
| admin | `admin:integrations:manage` | `(núcleo)` |
| admin | `admin:audit:read` | `(núcleo)` |
| notifications | `notifications:read:self` | `(núcleo)` |
| notifications | `notifications:template:manage` | `(núcleo)` |
| platform | `platform:tenants:review` | `(plataforma)` |
| platform | `platform:users:manage` | `(plataforma)` |
| platform | `platform:flags:manage` | `(plataforma)` |
| platform | `platform:security:read` | `(plataforma)` |
| platform | `platform:reconcile` | `(plataforma)` |
| platform | `platform:support` | `(plataforma)` |

### 3.2 Roles predefinidos y plantillas universales

| Rol / Plantilla | Ámbito | Responsabilidad y permisos |
|---|---|---|
| `PLATFORM_ADMIN` | plataforma | Todos los `platform:*` + lectura de soporte auditada + base `CUSTOMER`. |
| `BUSINESS_OWNER` | tenant | Todos los permisos de módulos del tenant excepto `platform:*`. |
| Gerente (`manager`) | tenant | Operar y gestionar el día a día: `catalog:write`, `catalog:import`, `catalog:listing:manage`, `inventory:adjust`, `inventory:purchase:manage`, `inventory:receive`, `pos:sell`, `pos:void`, `pos:refund`, `pos:session:manage`, `pos:settings:manage`, `pos:discount:apply`, `orders:read`, `orders:manage`, `logistics:read`, `logistics:manage`, `logistics:deliver`, `logistics:geofence:manage`, `payments:charge`, `payments:read`, `payments:refund`, `settlement:read`, `fiscal:read`, `fiscal:issue`, `fiscal:note:issue`, `analytics:read`, `payroll:attendance:read`, `payroll:employee:read`, `payroll:attendance:record`, `payroll:payslip:read:self`. |
| Supervisor (`supervisor`) | tenant | Autorizaciones y excepciones de caja: `pos:void`, `pos:refund`, `pos:discount:apply`, `pos:session:manage`, `payroll:attendance:read`, `payroll:attendance:record`, `payroll:payslip:read:self`. **No incluye `pos:sell` para evitar conflicto SoD.** |
| Cajero (`cashier`) | tenant | Operación de ventas y cobros: `pos:sell`, `pos:session:manage`, `payments:charge`, `payments:read`, `catalog:read`, `inventory:read`, `fiscal:issue`, `payroll:attendance:record`, `payroll:payslip:read:self`. |
| Almacenista (`stock_keeper`) | tenant | Gestión de almacén: `inventory:read`, `inventory:adjust`, `inventory:purchase:manage`, `inventory:receive`, `catalog:read`, `payroll:attendance:record`, `payroll:payslip:read:self`. |
| Repartidor (`courier`) | tenant | Entregas y logística: `logistics:deliver`, `logistics:read`, `payroll:attendance:record`, `payroll:payslip:read:self`. |
| Contador (`accountant`) | tenant | Facturación y finanzas: `fiscal:read`, `fiscal:issue`, `fiscal:note:issue`, `settlement:read`, `settlement:reconcile`, `payments:read`, `analytics:read`, `analytics:export`, `payroll:run:create`, `payroll:attendance:record`, `payroll:payslip:read:self`. |
| Solo lectura (`viewer`) | tenant | Auditoría y consulta sin mutaciones: `catalog:read`, `inventory:read`, `orders:read`, `logistics:read`, `payments:read`, `settlement:read`, `fiscal:read`, `payroll:attendance:read`, `analytics:read`. |
| `CUSTOMER` | propio | Billetera y marketplace propio: `wallet:*`, `catalog:read`, `orders:read:self`, `orders:create:self`, `notifications:read:self`. |

**Reglas de asignación**:
1. Todo usuario recibe siempre los permisos base de `CUSTOMER`.
2. Un empleado (`BUSINESS_STAFF`) sin rol personalizado asignado recibe **únicamente** la base de `CUSTOMER` (principio deny-by-default).
3. Los módulos visibles en la app se derivan dinámicamente de los permisos efectivos y las capacidades activas del comercio (`identity.GetUserPermissions → modules`, `flutter-standards.md` §6 y `docs/ux/screen-catalog.md`).

## 4. Confirmación fuerte (step-up)
Operaciones que exigen `x-pp-step-up` válido (token de un solo uso, 5 min, ligado a usuario + operación + monto):
- Pagos o transferencias ≥ **100.00 USD** (umbral configurable por tenant hacia abajo, nunca hacia arriba sin aprobación de plataforma).
- Reembolsos de cualquier monto.
- Aprobar y pagar nómina.
- Cambiar destino de liquidación (cuenta bancaria del comercio).
- Configurar credenciales fiscales o de rieles.
- Cambiar contraseña, correo o teléfono.
- Asignar roles con permisos de dinero (`payments:refund`, `payroll:run:pay`, `admin:roles:manage`).

Flujo: `identity.IssueStepUpChallenge` (usuario del token; devuelve la operación, el monto y los métodos disponibles) → el cliente resuelve con una passkey (huella, rostro o bloqueo del sistema) o con el PIN → `VerifyStepUp` verifica la aserción o el PIN **en identity** y devuelve el token → el servicio llama `ConsumeStepUp` (atómico; un token se consume una sola vez). Ninguna comprobación en la app autoriza nada (ADR 0020).

### 4.1 Catálogo de operaciones de confirmación fuerte (fuente de verdad)

Niveles: **1** presencia en el dispositivo (solo cliente: biometría, bloqueo del sistema); **2** confirmación fuerte (`PASSKEY` o `PIN`); **3** reautenticación (`PASSWORD`). identity aplica esta tabla (R27): un método no listado responde `STEP_UP_METHOD_NOT_ALLOWED`. El nombre de la operación es el que el servicio consume en `ConsumeStepUp`.

| Operación | Acción | Nivel | Métodos | Servicio que la consume |
|---|---|---|---|---|
| `payments.intent.create` | Pagar desde el umbral (`stepup.threshold_minor`) | 2 | `PASSKEY`, `PIN` | payments-core |
| `payments.intent.confirm` | Confirmar un cobro creado por el comercio, desde el umbral | 2 | `PASSKEY`, `PIN` | payments-core |
| `payments.refund` | Reembolsar (cualquier monto) | 2 | `PASSKEY`, `PIN` | payments-core |
| `wallet.transfer` | Transferir entre personas desde el umbral (T4) | 2 | `PASSKEY`, `PIN` | payments-core (F11, P2P) |
| `pos.sale.void` | Anular o devolver una venta de caja | 2 | `PASSKEY`, `PIN` | pos (F17.9) |
| `payroll.run.approve` · `payroll.run.pay` | Aprobar o pagar nómina | 2 | `PASSKEY`, `PIN` | payroll (F19) |
| `settlement.destination.update` | Cambiar la cuenta de liquidación (se avisa a todos los dueños) | 2 | `PASSKEY`, `PIN` (Q-43) | settlement (F12) |
| `security.credentials.update` | Configurar credenciales fiscales o de rieles | 2 | `PASSKEY`, `PIN` | security |
| `identity.role.upsert` · `identity.staff.invite` · `identity.membership.update` | Crear o asignar roles con permisos de dinero | 2 | `PASSKEY`, `PIN` | identity (R14) |
| `identity.capabilities.set` | Apagar `finance.*` o `payroll.*` | 2 | `PASSKEY`, `PIN` | identity (R14) |
| `identity.password.change` | Cambiar la contraseña | 2 | `PASSKEY`, `PIN` | identity (R14, R26) |
| `identity.email.change` · `identity.phone.change` | Cambiar correo o teléfono | 2 | `PASSKEY`, `PIN` | identity |
| `identity.data.export` | Exportar datos personales | 2 | `PASSKEY`, `PIN` | identity |
| `identity.passkey.register` | Agregar una passkey | 3 si es la primera, 2 si ya tiene otra | `PASSWORD`; con otra passkey también `PASSKEY`, `PIN` | identity |
| `identity.passkey.revoke` | Eliminar una passkey | 2 | `PASSKEY`, `PIN` | identity |
| `identity.pin.set` | Crear, cambiar o restablecer el PIN | 3 | `PASSWORD` | identity |

## 5. Secretos
1. Viven en **OpenBao** (contenedor `security`); los servicios reciben credenciales por variables de entorno inyectadas en el arranque (Compose: archivo `.env` local no versionado; K8s: External Secrets/CSI desde OpenBao).
2. Credenciales de terceros por comercio (DGI/PAC, rieles) **solo** en `security`; los demás contenedores piden operaciones (firmar, obtener token efímero), nunca el secreto en bruto cuando puede evitarse.
3. Rotación: claves de firma JWT cada 90 días (con solapamiento por `kid`); credenciales de BD por servicio cada 90 días; inmediata ante sospecha.
4. CI ejecuta **gitleaks** sobre cada commit; un hallazgo bloquea el merge. `.env` está en `.gitignore`; solo se versiona `.env.example` con valores vacíos o falsos evidentes.
5. Logs: nunca tokens, contraseñas, secretos, PAN, CVV, números de cuenta completos (máscara: últimos 4), documentos de identidad completos.

## 6. Transporte
1. Externo: TLS 1.2+ (preferente 1.3), HSTS, certificados por cert-manager/ACME. La app hace **certificate pinning** (SPKI de la CA intermedia + respaldo) en flavor `prod`.
2. Interno: red privada (Compose: redes `services`/`data` sin puertos publicados). Fase 5: **mTLS con identidades SPIFFE** emitidas por `security` (`IssueServiceCertificate`); cada servidor valida el SAN del llamador contra la matriz de `service-dependencies.md` §3.
3. Solo `api-gateway` (8080) y `web` (8081) se publican.

## 7. Webhooks entrantes (rieles, PAC)
1. Endpoint en api-gateway `/v1/webhooks/<proveedor>`, reenvía a payments-core/fiscal por gRPC.
2. Verificación de firma obligatoria; ventana de tiempo ≤ 5 min; deduplicación por id del evento del proveedor.
3. **Fail-closed**: firma inválida o faltante → 401 y métrica `pp_webhook_rejected_total`; jamás se procesa "para no perder el pago" (el pago se reconcilia por consulta activa).
4. Cuerpo ≤ 256 KB; responder 2xx solo tras persistir.
5. Un webhook **nunca** decide el estado final por sí solo si contradice la consulta activa: se marca discrepancia para conciliación.

## 8. Validación de entrada
- Validar en el borde (gateway: JSON estricto, `DisallowUnknownFields`, 1 MiB máx.) **y** en el servicio (reglas de dominio).
- Strings: longitud máxima declarada en el SPEC; normalizar Unicode NFC; correos en minúsculas.
- SQL siempre parametrizado (sqlx/pgx); nunca concatenar.
- Archivos subidos: tipo por contenido (magic bytes), tamaño máximo, escaneo antivirus (ClamAV) antes de exponer, nombres generados por el servidor.

## 9. Datos de tarjeta (PCI DSS)
1. **PlentyPay nunca ve el PAN ni el CVV.** La captura de tarjeta ocurre en componentes del procesador (SDK/hosted fields, Apple Pay/Google Pay con token de red). Objetivo de alcance: **SAQ A** (o SAQ A-EP si se hospeda la página de pago).
2. Se guarda solo: token del procesador, marca, últimos 4, vencimiento mes/año, país emisor.
3. **No se implementa kernel EMV** ni lectura de tarjeta física con NFC del teléfono en el MVP: "Tap to Pay" requiere un PSP certificado (pregunta abierta Q-03).
4. NFC de PlentyPay = intercambio NDEF de un enlace de pago firmado (`flutter-standards.md` §10), no emulación de tarjeta.

## 10. Biometría
- La verificación biométrica ocurre **en el dispositivo** (`local_auth`, o el sistema operativo al usar la passkey). El servidor recibe solo la aserción firmada por la passkey o el PIN, y lo verifica identity; ni la plantilla, ni la imagen, ni el resultado «sí/no» viajan (N-DAT-04). Con passkeys PlentyPay no trata datos biométricos (criterio legal pendiente, Q-40).
- Las llaves ligadas a la biometría del sistema dejan de servir si cambian las huellas o rostros registrados: el desbloqueo local pide entonces la contraseña.
- Siempre hay alternativa a la biometría (bloqueo del sistema, PIN o contraseña; WCAG 3.3.8, N-STD-41).
- Marcaje de asistencia con rostro (payroll): el embedding se calcula en el dispositivo; el servidor guarda solo el embedding cifrado con consentimiento explícito, nunca la foto (salvo evidencia de disputa con retención de 30 días, `data-standards.md` §9).

## 11. Contenedores e imágenes
- Imágenes base **distroless** (`gcr.io/distroless/static` para Go, `distroless/cc` para Rust), usuario `nonroot`, sin shell.
- Sistema de archivos de solo lectura; `/tmp` como emptyDir si hace falta.
- Sin capacidades Linux (`cap_drop: ALL`), `no-new-privileges`.
- Escaneo de vulnerabilidades (Trivy/Grype) en CI: CRITICAL bloquea; HIGH requiere excepción documentada con fecha.
- Imágenes firmadas (cosign) y desplegadas por digest; SBOM (Syft) adjunto.

## 12. Auditoría
- Toda acción administrativa, de dinero, de permisos o de configuración escribe en su outbox, **en la misma transacción** que la acción, un `security.AuditRecorded` (subject `pp.audit.<contenedor>.recorded.v1`) con actor, tenant, acción (`<módulo>.<entidad>.<verbo>`), recurso, resultado, IP, user-agent, request_id. `security` lo consume y lo encadena con hash (`VerifyAuditChain` detecta manipulación). El gateway, que no tiene BD, usa `security.AppendAuditEvent` por gRPC.
- El registro de auditoría es append-only (no hay RPC de borrado), retención 5 años.
- Accesos de soporte de plataforma a datos de un tenant quedan auditados y visibles para el dueño del comercio.

## 13. Respuesta a incidentes (mínimos)
1. Runbook por escenario (`docs/runbooks/`, Fase 30): fuga de secreto, compromiso de cuenta admin, discrepancia de ledger, caída de riel, PII expuesta.
2. Capacidad de **revocar todas las sesiones** de un usuario/tenant y de **pausar cobros** por tenant o por riel (feature flag en infra-management) en < 5 min.
3. Notificación a la Superintendencia/afectados según plazos legales (Q-08 en `docs/open-questions.md` para confirmar plazos exactos).
4. Post-mortem sin culpables en ≤ 5 días hábiles.

## 14. Checklist de seguridad por PR (además del DoD de `testing-strategy.md`)
- [ ] Cada RPC nuevo tiene permiso declarado en el SPEC y prueba de `PERMISSION_DENIED`.
- [ ] Consultas filtran por tenant; existe prueba de acceso cruzado → `NOT_FOUND`.
- [ ] Ningún secreto/PII nuevo en logs (revisar campos agregados).
- [ ] Entradas nuevas con límites de longitud/rango.
- [ ] Operaciones de dinero nuevas: idempotencia + step-up si aplica §4.
