# Estándares Flutter (cliente único — ADR 0009)

Una sola app, `flutter_app/`, para **Android, iOS, Linux, Windows, macOS y Web**. Muestra módulos según los permisos del usuario. Habla **solo** con `api-gateway` (HTTPS/JSON + WebSocket `/v1/realtime`, ADR 0015). Los binarios compilados se copian a `output/` (ver `output/README.md`).

> **Regla de diseño estricta (`gravital-experience-ui`)**: Todas las interfaces Flutter previas y futuras se diseñan y construyen siguiendo obligatoriamente el plano [`docs/gravital-experience-ui.md`](../gravital-experience-ui.md) (**gravital-experience-ui** — M3 Expressive) junto con [`docs/design-system.md`](../design-system.md). Ninguna pantalla se da por terminada sin cumplir su checklist de revisión (`docs/gravital-experience-ui.md` §15.3).

## 1. Plataformas y versiones
| Plataforma | Mínimo | Notas |
|---|---|---|
| Android | minSdk 24 (7.0), target = último estable | NFC (HCE no requerido), cámara, biometría |
| iOS | 15.0 | Core NFC (lectura NDEF), Face ID/Touch ID; entitlements NFC |
| Linux | Ubuntu 22.04 x64 (GTK 3) | quiosco/POS de escritorio; sin NFC |
| Windows | 10 21H2 x64 | POS de escritorio; impresión |
| macOS | 12 | mismo código; firma/notarización en Fase 30 |
| Web | Chrome/Edge/Firefox/Safari últimas 2 | servida por contenedor `web`; sin NFC/biometría nativa (passkeys sí) |

Flutter estable fijado en `flutter_app/.fvmrc` (o `README`) — **3.47+**; Dart ≥ 3.6.

## 2. Paquetes aprobados
| Uso | Paquete |
|---|---|
| Estado / DI | `flutter_riverpod` (+ `riverpod_annotation`, `riverpod_generator`) |
| Navegación | `go_router` |
| HTTP | `dio` (interceptores: auth, idempotencia, request-id, reintentos) — el esqueleto actual usa `http`; migrar en F22.2 |
| Modelos inmutables | `freezed` + `json_serializable` |
| BD local / outbox offline | `drift` (SQLite; SQLCipher en móvil) |
| Almacenamiento seguro | `flutter_secure_storage` |
| Biometría | `local_auth` |
| Passkeys | `passkeys` (o plugin equivalente OSS) — F28 |
| QR generar / leer | `qr_flutter` / `mobile_scanner` |
| NFC | `nfc_manager` 4.x + `ndef_record` |
| i18n | `flutter_localizations` + `intl` con ARB (`es_PA` por defecto, `en`) |
| Tiempo real | `web_socket_channel` |
| Mapas | `flutter_map` (tiles OSM/servidor propio; nada propietario) + `latlong2` |
| Gráficos | `fl_chart` |
| Impresión / PDF | `printing` + `pdf` |
| Ubicación | `geolocator` |
| Pruebas | `flutter_test`, `integration_test`, `mocktail` |
Todos con licencia OSI. Otro paquete → justificar en `flutter_app/README.md` §Dependencias.

## 3. Arquitectura (feature-first, 4 capas)
```
flutter_app/lib/
├── main.dart                     # bootstrap: flavor, ProviderScope, router
├── core/
│   ├── config/                   # flavors dev/staging/prod (dart-define)
│   ├── api/                      # ApiClient (dio), errores tipados, idempotencia
│   ├── realtime/                 # cliente WebSocket multiplexado
│   ├── session/                  # tokens, permisos, módulos visibles
│   ├── storage/                  # drift, secure storage
│   ├── money/                    # Money (int minor), formateo es_PA
│   ├── theme/                    # tokens y tema gravital-experience-ui (docs/gravital-experience-ui.md, docs/design-system.md)
│   ├── widgets/                  # componentes del design system (PPButton, MoneyText...)
│   └── l10n/                     # ARB
└── features/<modulo>/
    ├── data/                     # DTOs + repositorios (habla con ApiClient)
    ├── domain/                   # entidades y reglas puras del cliente
    ├── application/              # providers / controladores (Riverpod)
    └── presentation/             # pantallas y widgets
```
`presentation` no importa `data` directamente; pasa por `application`. Una feature no importa otra feature (salvo `core`); la composición la hace el router/shell.

## 4. Estados de pantalla (obligatorio en cada pantalla con datos)
1. **Cargando** (esqueleto, no spinner a pantalla completa si hay estructura).
2. **Vacío** (mensaje + acción primaria).
3. **Error** (icono + texto de `reason` traducido + "Reintentar"; nunca texto técnico).
4. **Datos**.
Usar `AsyncValue` de Riverpod con un widget común `AsyncView`.

## 5. Red y errores
1. Base URL por flavor (`--dart-define=API_BASE_URL=...`). **prod rechaza `http://`** al arrancar.
2. Cabeceras: `Authorization: Bearer`, `X-Request-Id` (UUIDv7 por acción), `Idempotency-Key` en toda mutación de dinero/estado (se genera al **iniciar la acción del usuario** y se reutiliza en reintentos de esa misma acción), `Accept-Language`.
3. 401 → un solo intento de refresh (con candado para evitar refresh concurrentes) → si falla, cerrar sesión y llevar a login.
4. Errores del gateway `{"error","reason"}` → `ApiException(reason)`; la UI traduce `reason` con ARB (`error_INSUFFICIENT_FUNDS`). Reason desconocido → mensaje genérico + request_id visible para soporte.
   Captura global de errores, `AppLogger`, migas y envío de telemetría: `observability-standards.md` §13 (obligatorio en toda pantalla y repositorio).
5. Timeouts: conexión 10 s, recepción 30 s; pagos esperan resultado por WebSocket o sondeo, no por una petición larga.

## 6. Sesión, permisos y navegación dinámica
1. Tras login: `GET /v1/me` + `GET /v1/me/permissions` → `modules` (ids) + `permissions`.
2. `ModuleRegistry` (en `features/modules/`) define cada módulo: id, etiqueta ARB, icono, ruta raíz, fase. **Visibles = registrados ∩ modules del servidor**; ids desconocidos se ignoran (servidor más nuevo que la app).
3. `go_router` con `redirect` global: sin sesión → `/login`; ruta de un módulo no visible → `/` (nunca mostrar 403 de navegación).
4. Dentro de un módulo, cada acción se habilita por permiso (`can('payments:refund')`); el servidor vuelve a validar siempre.
5. Cambio de permisos en servidor → evento `session.permissions_changed` por WebSocket → recargar.
6. El catálogo de pantallas por módulo y rol está en `docs/ux/screen-catalog.md`.

## 7. Diseño adaptable
| Ancho | Navegación | Layout |
|---|---|---|
| < 600 dp | barra inferior (≤ 5 destinos) o drawer si hay más | una columna |
| 600–1024 dp | `NavigationRail` | lista + detalle opcional |
| > 1024 dp | `NavigationRail` extendido | lista + detalle lado a lado; POS en dos paneles |
Modo **quiosco** (marcaje / POS fijo) y **pantalla de cliente** (customer display) como rutas a pantalla completa sin navegación.

## 8. Enlaces profundos
Dominio `pay.plentypay.app` (configurable): `/t/<code>` (cobro), `/track/<token>` (seguimiento público), `/invite/<token>` (invitación de staff), `/reset/<token>` (recuperar contraseña). Android App Links + iOS Universal Links (archivos `assetlinks.json` / `apple-app-site-association` servidos por `web`). Todo parámetro se valida con el regex del §10 antes de usarse.

## 9. Offline (POS y marcaje)
1. Ventas y marcajes se escriben primero en **drift** (outbox local) con `client_txn_id` (UUIDv7) que el servidor usa como idempotency key.
2. Sincronización en orden, al recuperar red, con backoff; conflicto → la venta queda "requiere revisión" visible para el gerente.
3. Límite offline por defecto: 200 ventas o 24 h (configurable por tenant); pagos electrónicos **no** se aceptan offline (solo efectivo y crédito de la casa).
4. Catálogo y precios cacheados con versión; nunca se vende un SKU con precio más viejo que la última versión sincronizada + 24 h.

## 10. QR y NFC
1. **QR de cobro**: contenido = URL `https://<host>/t/<code>`; `code` cumple `^[A-Za-z0-9_-]{8,64}$`. La app valida que el host esté en la lista permitida del flavor; si no → advertencia y no abre.
2. **NFC**: solo lectura/escritura **NDEF** con un registro URI del mismo formato. No se emula tarjeta (HCE) ni se lee tarjeta EMV (`security-standards.md` §9).
3. Antes de pagar, la app llama `GET /v1/pay-links/<code>` y muestra el **nombre del comercio verificado por el servidor**, el monto y la moneda; el contenido del tag nunca se muestra como verdad.
4. Confirmación con biometría local siempre; step-up si supera umbral (`security-standards.md` §4).
5. Resultado del pago por WebSocket (`payment.status`); si llega `UNKNOWN` → pantalla "Estamos confirmando tu pago" (nunca "falló"), con sondeo y notificación final.

## 11. Seguridad en el cliente
- Tokens en `flutter_secure_storage` (Keychain/Keystore; en desktop, libsecret/DPAPI). Nunca en `SharedPreferences`.
- Pinning en prod (`security-standards.md` §6). Android: `FLAG_SECURE` en pantallas de saldo/pago; iOS: ocultar contenido en el app switcher.
- Bloqueo por inactividad: 5 min en móvil con biometría para reabrir; POS: configurable.
- Detección de root/jailbreak: advertencia y restricción de pagos (no bloqueo total) — F28.
- Sin logs de datos sensibles; `debugPrint` deshabilitado en release.

## 12. Dinero en la UI
- `Money` con `amountMinor:int` y `currency`; formateo con `intl` `es_PA` (`B/.` y `USD` se muestran como `$`; ver `docs/design-system.md` §5).
- Entrada de montos con teclado numérico que construye centavos (sin decimales flotantes).
- Widget `MoneyText` con dígitos tabulares; negativos en color de error con signo, nunca solo color.

## 13. Accesibilidad e i18n
- Contraste WCAG AA; objetivos táctiles ≥ 48 dp; `Semantics` en iconos-acción; soporta escala de texto hasta 200 % sin cortar.
- Todo texto en ARB; fechas y números por locale; zona horaria de negocio `America/Panama`.

## 14. Rendimiento
- Arranque en frío < 2.5 s en gama media; listas virtualizadas (`ListView.builder`); imágenes con caché y tamaños del servidor.
- APK por ABI ≤ 40 MB (split-per-abi); web inicial ≤ 3 MB comprimido (deferred loading por módulo).

## 15. Flavors y builds
| Flavor | API | Pinning | Logs |
|---|---|---|---|
| dev | `http://localhost:8080` permitido | no | verbose |
| staging | https staging | sí | info |
| prod | https prod | sí | error |
Comandos y destino de binarios en `output/README.md`. Firma de releases (keystore, certificados Apple, Authenticode) fuera del repo, en CI con secretos.

## 16. Pruebas
- Unidad: dominio y providers. Widget: 4 estados de cada pantalla. Golden: componentes del design system en claro/oscuro.
- `integration_test` contra Compose local en Fase 22+ (login, navegación dinámica por rol, pago QR en sandbox).
- `flutter analyze` sin warnings; `flutter test` verde.
