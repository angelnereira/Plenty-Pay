# Guía de continuidad

Entrada para retomar el trabajo sin reconstruir el contexto. **No es un diario**: se reescribe al cerrar cada paso. Las reglas viven en [`AGENTS.md`](../../AGENTS.md); el estado con evidencia, en [`status.md`](status.md); las fichas de los pasos comerciales, en [`commerce-plan.md`](commerce-plan.md).

_Última actualización: 2026-10-23, tras F16.10 y F16.12 (cerrados) y F16.11 (escáner; falta la prueba con cámara)._

## 1. Estado verificado
- Versión publicada: ver el último tag (`git ls-remote --tags origin | tail -1`); F17.4 salió en `v0.7.0`.
- En producción (`docker compose ps`): identity, api-gateway, ledger, payments-core, settlement, fiscal-invoicing, catalog, inventory, pos, orders, security, infra-management, web. Rieles de pago externos y PAC en **sandbox/simulador**.
- Sin servidor: logistics, notifications, geolocation, payroll, analytics-bi. Sus módulos abren «Disponible próximamente» (`ModuleDef.live`).
- Punto de partida y discrepancias: [auditoría del 2026-10-21](../audits/2026-10-21-comercio-estado-real.md).

## 2. Último paso cerrado
**F17.4 · Estacionar y retomar ventas** (✅ L1, L2 14/14, L4 de humo en producción y en el Pixel 8 Pro). El L4 destapó que el motivo de anulación no se guardaba: corregido.
- Contrato: `Sale.park_label = 25`, `Sale.parked_at = 26` (`network-contracts/proto/pos.proto`).
- Migraciones aplicadas en producción: `pos/migrations/0002_park` (2026-10-21, respaldo `~/plentypay-backups/pos-before-0002-*.sql.gz`); `inventory/migrations/0003_purchasing` (2026-10-21).
- Regla: `pos/SPEC.md` §5 R13.

## 2.1 También cerrado el 2026-10-21
- **F11.10 · Transferencias entre personas y código personal para recibir** (✅ L2 40/40, L4 en producción y en el Pixel). Migración `payments-core/migrations/0004_receive_codes.sql` aplicada (respaldo `~/plentypay-backups/payments-before-0004-*.sql.gz`). Contrato: `GetMyReceiveCode`, `ReceiveCode`, `PublicTerminalInfo.kind`.
- **Escáner de códigos de barras** (diálogo de caja, catálogo e inventario) que no se dibujaba: reescrito (`flutter_app/lib/core/widgets/barcode_scanner_dialog.dart`), publicado en v0.7.2.
- Fechas largas centralizadas en `flutter_app/lib/core/format/dates.dart` («22 de octubre de 2026»); no uses patrones literales como `'d MMMM y'`.

## 2.2 Cerrado el 2026-10-22
- **F16.4 · Lotes y FEFO** y **F16.8 · Lotes en la recepción** (✅ L1, L2 inventory 22/22 y catalog 16/16, L4 por API y en el Pixel). Migraciones aplicadas: `inventory/migrations/0004_lots`, `catalog/migrations/0003_lots` (respaldo `~/plentypay-backups/inventory-catalog-before-lots-*.sql.gz`). Lógica en `inventory/internal/store/lots.go` (`resolveLots`) y `inventory/internal/domain/lots.go`.
- Fechas de vencimiento: viajan como las 00:00 de ese día en Panamá (`lotDateWire` en la app); `domain.DateOnly` es idempotente.
- **F17.9 · Devoluciones en caja** (efectivo y saldo PlentyPay; L2 pos 17/17, L4 de humo en efectivo). Migración `pos/migrations/0003_refunds` aplicada (respaldo `~/plentypay-backups/pos-before-0003-*.sql.gz`). ADR 0023: pos consume la confirmación fuerte en identity. Lógica en `pos/internal/domain/refund.go` (R9), `pos/internal/store/refunds.go` y `pos/internal/service/refunds.go`; app en `flutter_app/lib/features/pos/pos_refund_screen.dart` (S-POS-08). Probado en el Pixel. Pendiente: reintegro al saldo en vivo, nota de crédito (F13.5) y Q-47.

## 2.3 Cerrado el 2026-10-23
- **F16.10 · Existencia bloqueada y aviso de vencimiento** (✅ L1, L2 inventory 24/24, L4 en el Pixel). Migración `inventory/migrations/0005_blocked` aplicada (respaldo `~/plentypay-backups/inventory-before-0005-*.sql.gz`). Regla R9 en `inventory/SPEC.md`; lógica en `inventory/internal/domain/stock.go` (`Level.Apply`, `MovementType.Physical`), `inventory/internal/store/lots.go` (`resolveBlock`, `Settings`) y `inventory/internal/service/inventory.go` (`FromBlocked`). App: `flutter_app/lib/features/inventory/stock_block_dialog.dart` y `expiry_alert_dialog.dart`.
- **Incidente del 2026-10-23**: la máquina se reinició y Docker Desktop no arrancó solo (`docker-desktop.service` está *disabled*), así que producción estuvo caída hasta que el agente lo inició (`systemctl --user start docker-desktop`). El túnel cambió de URL y el temporizador la publicó. Recomendación al dueño: `systemctl --user enable docker-desktop`.

## 2.4 F16.11 · Escáner en inventario (2026-10-23, 📝)
Hecho y probado con lector simulado en el Pixel: regla C-27 (`docs/ux/functional-spec/README.md` §3), `flutter_app/lib/core/format/barcode.dart`, `flutter_app/lib/core/widgets/hid_scanner_listener.dart`, escaneo en S-INV-03/04/06 y en la caja. **Para cerrarlo**: alguien apunta la cámara del Pixel a un código impreso desde Inventario → Ajustar → icono de escaneo (y, si hay, un lector Bluetooth). Simular un lector: `adb shell input keyevent <códigos de tecla> 66` (no `input text`).

## 2.5 Cerrado el 2026-10-23: F16.12 · Incidencias de recepción
R10 en `inventory/SPEC.md` y §8.12 en `domain-model.md` (estado `CLOSED_SHORT`). Migración `inventory/migrations/0006_receipt_issues` aplicada (respaldo `~/plentypay-backups/inventory-before-0006-*.sql.gz`). Lógica en `inventory/internal/domain/purchasing.go` (`Receive`, `CloseReason`), `inventory/internal/store/purchasing.go` (`ReceiptHook`, `UpdatePurchaseOrderStatus` con `StatusChange`, `insertIssue`) y `inventory/internal/service/purchasing.go` (BLOCK `OnArrival`). App: `purchase_receive_screen.dart` (Dañado) y `purchase_orders_screen.dart` (`_CloseShortDialog`).

## 3. Siguiente paso recomendado
**F16.13 · Historial de compras y costo de adquisición** ([ficha](commerce-plan.md#f1613--historial-de-compras-y-costo-de-adquisición)). Ojo: el costo de lo vendido está ⛔ por Q-52; implementa solo lo que la ficha permite sin esa respuesta y deja el resto citado. Si prefieres otra rama, en caja quedan F17.11 (configuración de caja) y F17.12 (sucursal en cajas y ventas), sin bloqueos.

## 4. Comandos
| Para | Comando |
|---|---|
| Ver el entorno | `git status && git log --oneline -5 && docker compose ps --format '{{.Service}} {{.Status}}'` |
| Checks transversales | `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check` |
| Contrato tras editar un `.proto` | `./scripts/sync-protos.sh` |
| Go (L1) | `cd <c> && go vet ./... && go test -race ./...` |
| L2 en base efímera | `./<c>/test/test_l2.sh` (inventory 26, pos 17, fiscal 12, settlement 4) |
| Flutter | `cd flutter_app && flutter analyze && flutter test` (590 al 2026-10-23; el analizador tiene 18 notas previas, ninguna de inventario) |
| Respaldo antes de migrar | `docker compose exec -T postgres-db pg_dump -U postgres -d plentypay -n <esquema> \| gzip > ~/plentypay-backups/<esquema>-before-<migr>-$(date +%Y%m%d-%H%M%S).sql.gz` |
| Desplegar un servicio | `docker compose build <c> && docker compose run --rm --no-deps <c> migrate && docker compose up -d --no-deps <c>` |
| Publicar la app | `./scripts/publish-release.sh <patch\|minor> <notas.md>` (después de cada push a `main`) |

## 5. Bloqueos abiertos que tocan comercio
Q-02/Q-03 (rieles y tarjetas), Q-11 (PAC en producción), Q-21 (propinas → F17.19), Q-45 (lealtad → activar F17.15–F17.17), Q-47 (devoluciones cruzadas), Q-48 (cupones → F17.18), Q-49 (mapa → F18.5), Q-52 (costo de lo vendido → F16.13). Supuestos sin bloqueo: Q-46, Q-50, Q-51. Detalle en [`open-questions.md`](../open-questions.md).

## 6. Decisiones tomadas en esta etapa
- Una venta de caja **no reserva** existencias al estacionarse: se descuentan al pagarse (`stock_tasks`), por eso no hay doble reserva (ficha F17.4 campo 6).
- Estacionar/retomar son transiciones por estado, sin clave de idempotencia (repetir = mismo resultado).
- El alcance por sucursal (ADR 0018) se aplicará en comercio con F16.9 y F17.12; hoy ningún servicio de comercio lo aplica.
- Lealtad usa el ledger (T8) como libro de movimientos; no hay contenedor nuevo.

## 7. Riesgos conocidos
- **Pruebas de humo en producción**: no hagas acciones que cierren o cobren si un paso previo falló. El 2026-10-21 un guion sin producto activo cerró dos sesiones de caja de la cuenta demo (ver `status.md` F17.4). Usa guiones con `set -e` y comprueba el estado antes de cada acción irreversible.
- El catálogo de la cuenta demo no tiene productos activos: crea uno de prueba y archívalo al terminar.
- Pixel 8 Pro (`41191FDJG002UT`): la app de producción tiene abierta la cuenta personal del dueño; para pruebas usa la app de depuración `app.plentypay.pay.debug` (`flutter build apk --debug`, `adb reverse tcp:8080 tcp:8080`), con su propia sesión. Escribe credenciales con `adb shell input text` sin volcar la pantalla mientras el campo de contraseña tenga foco; si una notificación del sistema aparece en el volcado, ciérrala (`adb shell cmd statusbar collapse`) y no registres su contenido.
- No reiniciar el contenedor `tunnel` sin necesidad (AGENTS §3.1). El 2026-10-22 el túnel quedó en «Tunnel not found» y el agente no tuvo permiso para reiniciarlo: lo hace el dueño (`docker compose restart tunnel` y `./scripts/publish-server-url.sh`).
- La app de depuración usa la URL publicada en `server.json`; con el túnel caído, compílala con `--dart-define=PP_DISCOVERY_URL=http://127.0.0.1:9/none --dart-define=API_BASE_URL=http://localhost:8080`, borra sus datos (`adb shell pm clear app.plentypay.pay.debug`) y usa `adb reverse tcp:8080 tcp:8080`.
