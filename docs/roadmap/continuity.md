# Guía de continuidad

Entrada para retomar el trabajo sin reconstruir el contexto. **No es un diario**: se reescribe al cerrar cada paso. Las reglas viven en [`AGENTS.md`](../../AGENTS.md); el estado con evidencia, en [`status.md`](status.md); las fichas de los pasos comerciales, en [`commerce-plan.md`](commerce-plan.md).

_Última actualización: 2026-10-22, al cerrar F16.4 (lotes y FEFO) y F16.8 (lotes en la recepción)._

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

## 3. Siguiente paso recomendado
**F17.9 · Devoluciones** ([ficha](commerce-plan.md#f179--devoluciones)) en su parte desbloqueada (efectivo y saldo PlentyPay; depende de F11.6), o **F16.10 · Existencias bloqueadas y alertas de vencimiento** ([ficha](commerce-plan.md#f1610--existencias-no-vendibles-y-alertas-de-vencimiento)), que ya tiene sus predecesores (F16.4 ✅).

Leer, en este orden:
1. Ficha del paso en `commerce-plan.md` (25 campos).
2. `inventory/SPEC.md` §3–§5 (R5) · `docs/domain/domain-model.md` §8 · `docs/glossary.md` §5 (reasons de inventory: `LOT_REQUIRED`, `LOT_EXPIRED` ya existen).
3. Código: `inventory/internal/domain/stock.go`, `inventory/internal/store/store.go` (movimientos y `Batch.Hook`), `inventory/internal/store/purchasing.go` (recepción, para F16.8), `inventory/migrations/0001–0003`.
4. Pantallas: fichas S-INV-02 y S-INV-03 en `docs/ux/functional-spec/04-catalog-inventory.md`; código en `flutter_app/lib/features/inventory/`.
5. Normas: N-LOG-07; pregunta abierta Q-50 (supuesto: vencido se bloquea).

Condición de terminado: criterios de aceptación 21 de la ficha + AGENTS §3 pasos 5–10 (pruebas con el id de la regla, instrumentación, docs, checks, commit por contenedor, release).

## 4. Comandos
| Para | Comando |
|---|---|
| Ver el entorno | `git status && git log --oneline -5 && docker compose ps --format '{{.Service}} {{.Status}}'` |
| Checks transversales | `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check` |
| Contrato tras editar un `.proto` | `./scripts/sync-protos.sh` |
| Go (L1) | `cd <c> && go vet ./... && go test -race ./...` |
| L2 en base efímera | `./<c>/test/test_l2.sh` (inventory 19, pos 14, fiscal 12, settlement 4) |
| Flutter | `cd flutter_app && flutter analyze && flutter test` (527 al 2026-10-21; el analizador tiene 18 notas previas) |
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
