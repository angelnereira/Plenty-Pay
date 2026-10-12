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
6. **Passkeys/WebAuthn** (Fase 28) como factor primario opcional; biometría del dispositivo desbloquea credenciales locales, nunca se envía al servidor.
7. **Recuperación de contraseña**: token de un solo uso, 30 min, hash guardado (no el token), invalida todas las sesiones al completarse.

## 3. Autorización
1. **Deny-by-default**: cada RPC declara en su SPEC el permiso exigido. Sin declaración = no se expone.
2. El gateway hace una primera verificación (ruta → permiso); **cada servicio vuelve a verificar** con `x-pp-permissions` (defensa en profundidad).
3. Permisos con formato `<módulo>:<acción>[:<calificador>]`.

### 3.1 Catálogo de permisos (fuente de verdad)

| Módulo | Permisos |
|---|---|
| wallet | `wallet:read`, `wallet:topup`, `wallet:transfer`, `wallet:pay` |
| payments | `payments:charge`, `payments:read`, `payments:refund`, `payments:terminal:manage`, `payments:fees:read`, `payments:fees:manage` |
| settlement | `settlement:read`, `settlement:schedule:manage`, `settlement:reconcile` |
| catalog | `catalog:read`, `catalog:write`, `catalog:import`, `catalog:listing:manage` |
| inventory | `inventory:read`, `inventory:adjust`, `inventory:purchase:manage`, `inventory:receive` |
| pos | `pos:sell`, `pos:void`, `pos:refund`, `pos:session:manage`, `pos:settings:manage`, `pos:discount:apply` |
| fiscal | `fiscal:read`, `fiscal:issue`, `fiscal:note:issue`, `fiscal:profile:manage` |
| orders | `orders:read`, `orders:manage`, `orders:read:self`, `orders:create:self` |
| logistics | `logistics:read`, `logistics:manage`, `logistics:deliver`, `logistics:geofence:manage` |
| payroll | `payroll:employee:read`, `payroll:employee:manage`, `payroll:attendance:record`, `payroll:attendance:read`, `payroll:run:create`, `payroll:run:approve`, `payroll:run:pay`, `payroll:payslip:read:self` |
| analytics | `analytics:read`, `analytics:dashboard:manage`, `analytics:alert:manage`, `analytics:export` |
| admin (del comercio) | `admin:users:manage`, `admin:roles:manage`, `admin:business:manage`, `admin:integrations:manage`, `admin:audit:read` |
| notifications | `notifications:read:self`, `notifications:template:manage` |
| platform | `platform:tenants:review`, `platform:users:manage`, `platform:flags:manage`, `platform:security:read`, `platform:reconcile`, `platform:support` |

### 3.2 Roles predefinidos (presets; el dueño puede crear roles propios con subconjuntos)

| Rol | Ámbito | Permisos |
|---|---|---|
| `PLATFORM_ADMIN` | plataforma | todos los `platform:*` + lectura de cualquier módulo para soporte (auditada) |
| `BUSINESS_OWNER` | tenant | todos los permisos de módulos del tenant excepto `platform:*` |
| Gerente (`manager`) | tenant | `catalog:*`, `inventory:*`, `pos:*`, `orders:*` (no self), `logistics:*`, `payments:charge/read/refund`, `settlement:read`, `fiscal:read/issue/note:issue`, `analytics:read`, `payroll:attendance:read`, `payroll:employee:read` |
| Cajero (`cashier`) | tenant | `pos:sell`, `pos:session:manage`, `payments:charge`, `payments:read`, `catalog:read`, `inventory:read`, `fiscal:issue`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| Almacenista (`stock_keeper`) | tenant | `inventory:*`, `catalog:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| Repartidor (`courier`) | tenant | `logistics:deliver`, `logistics:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| Contador (`accountant`) | tenant | `fiscal:*` excepto `fiscal:profile:manage`, `settlement:read`, `settlement:reconcile`, `payments:read`, `analytics:read`, `analytics:export`, `payroll:run:create` |
| `CUSTOMER` | propio | `wallet:*`, `catalog:read`, `orders:read:self`, `orders:create:self`, `notifications:read:self` |

**Todo usuario recibe además los permisos de `CUSTOMER`** (cualquier persona tiene billetera propia y puede comprar). Los **módulos visibles** en la app se derivan de los permisos (tabla en `identity/SPEC.md` R10; código en `identity/internal/auth/permissions.go`) (`identity.GetUserPermissions → modules`), regla en `flutter-standards.md` §6 y `docs/ux/screen-catalog.md`.

## 4. Confirmación fuerte (step-up)
Operaciones que exigen `x-pp-step-up` válido (token de un solo uso, 5 min, ligado a usuario + operación + monto):
- Pagos o transferencias ≥ **100.00 USD** (umbral configurable por tenant hacia abajo, nunca hacia arriba sin aprobación de plataforma).
- Reembolsos de cualquier monto.
- Aprobar y pagar nómina.
- Cambiar destino de liquidación (cuenta bancaria del comercio).
- Configurar credenciales fiscales o de rieles.
- Cambiar contraseña, correo o teléfono.
- Asignar roles con permisos de dinero (`payments:refund`, `payroll:run:pay`, `admin:roles:manage`).

Flujo: `identity.IssueStepUpChallenge` → el cliente resuelve (biometría local + PIN/passkey) → `VerifyStepUp` devuelve token → el servicio llama `ConsumeStepUp` (atómico; un token se consume una sola vez).

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
- La verificación biométrica ocurre **en el dispositivo** (`local_auth`). El servidor recibe solo el resultado firmado por la credencial local (passkey) o el token de step-up.
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
