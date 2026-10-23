# Plan de ejecución por olas

Fichas **de ejecución** de cada paso abierto que toca el ciclo de vida del producto o del dinero ([`../lifecycles.md`](../lifecycles.md)). Están escritas para que un agente (o una persona) **ejecute sin volver a investigar**: qué archivos tocar, qué cambia en el contrato y en la base, qué pruebas escribir con qué nombre, qué comandos correr, cómo desplegar, cómo probar en el teléfono y cuándo se da por terminado.

**Precedencia** (AGENTS.md §1): este plan no decide nada nuevo. Si una ficha de aquí y su fuente difieren, manda la fuente en este orden: ADR → `domain-model.md` → `docs/compliance/` → `SPEC.md` del contenedor → `docs/ux/functional-spec/` → la ficha de diseño de [`../commerce-plan.md`](../commerce-plan.md) → esta ficha. Si encuentras una diferencia, corrige esta ficha en el mismo cambio. Los criterios de aceptación y los niveles L0–L5 son los de [`05-HOJA-DE-RUTA-30-FASES.md`](../../../05-HOJA-DE-RUTA-30-FASES.md), copiados literalmente.

_Escrito el 2026-10-23 con el código en `4abc1c1` (v0.13.0). Las rutas y números de migración son los de ese día: verifícalos con `ls` antes de crear un archivo._

## Índice

| Ola | Qué cierra | Archivo |
|---|---|---|
| 1 | Lo que ya se vende queda cerrado (caja, mercado, reembolsos) | [`ola-1-venta-cerrada.md`](ola-1-venta-cerrada.md) |
| 2 | El hecho se documenta y se avisa (notifications, factura, control de inventario) | [`ola-2-documento-y-aviso.md`](ola-2-documento-y-aviso.md) |
| 3 | El dinero sale hacia el comercio (ledger, liquidación, conciliación) | [`ola-3-dinero-al-comercio.md`](ola-3-dinero-al-comercio.md) |
| 4 | El producto completa su vuelta (compras, devoluciones, catálogo) | [`ola-4-vuelta-del-producto.md`](ola-4-vuelta-del-producto.md) |
| 5 | Entrega a domicilio (geolocalización, logística) | [`ola-5-entrega.md`](ola-5-entrega.md) |
| 6 | Fidelización y crédito de la casa | [`ola-6-fidelizacion-y-credito.md`](ola-6-fidelizacion-y-credito.md) |
| 7 | Inteligencia de negocio | [`ola-7-analisis.md`](ola-7-analisis.md) |
| 8 | Dinero real (rieles, PAC, seguridad, lanzamiento) | [`ola-8-dinero-real.md`](ola-8-dinero-real.md) |

Orden dentro de cada ola: el de la tabla de la ola, que respeta los predecesores de [`../phase-matrix.md`](../phase-matrix.md). Las olas 1–4 pueden avanzar en paralelo donde la matriz lo permite (F12, F13 y F14 tras F11; F20 tras F09). **Un paso se toma solo si sus precedentes están ✅ en `status.md`.**

## 1. Formato de cada ficha

```
### F<nn>.<m> · Título
Ficha de diseño · Ciclo · Nivel exigido · Estado (2026-10-23)
- Precedencia / Bloqueos: pasos que deben estar ✅; Q-NN que bloquean y supuesto permitido.
- Leer antes: documentos y archivos exactos.
- Resultado observable: lo que alguien ve funcionar al terminar.
- Contrato: cambios aditivos en network-contracts/proto (campo = número). Si no hay: «sin cambios».
- Datos: migración <contenedor>/migrations/NNNN_<nombre>.(up|down).sql y su contenido.
- Código: archivos a crear (crear) o modificar, por capa (domain, store, service, server, events).
- Gateway / app: rutas de api-gateway y pantallas Flutter (ficha S-…).
- Pruebas: nombres exactos (TestR<n>_…, TestL2_…, test('… S-…')) y qué afirma cada una.
- Verificar: comandos y salida esperada.
- Desplegar: respaldo, migrate, servicios a reconstruir.
- L4: guion en el Pixel 8 Pro o por API contra producción.
- Docs al cerrar: SPEC, README, status, glosario, continuity.
- Trampas conocidas: lo que ya hizo fallar a otro agente.
- Terminado cuando: criterio literal de 05 + condición del paso.
```

## 2. Procedimiento común (vale para todos los pasos)

### 2.1 Antes de empezar
1. `git status && git log --oneline -5 && docker compose ps --format '{{.Service}} {{.Status}}'`.
2. Si `docker info` falla: Docker Desktop no arrancó tras un reinicio de la máquina (`systemctl --user start docker-desktop`; espera a que `docker info` responda). Producción depende de esto: avísale al dueño que puede dejarlo activado con `systemctl --user enable docker-desktop`. Tras levantar, los servicios Go pueden reiniciar unas veces hasta que pgbouncer acepte conexiones: espera a que ninguno diga `Restarting`.
3. El túnel cambia de URL al reiniciarse. El temporizador `plentypay-server-url.timer` la publica en `server.json` (gh-pages) cada 2 min; puedes forzarlo con `./scripts/publish-server-url.sh`. No reinicies el contenedor `tunnel` sin necesidad (AGENTS §3.1).
4. Lee la ficha de diseño (si existe), el SPEC del contenedor (§3–§5 y §11) y el glosario.

### 2.2 Implementar
- **Documentos primero** (ADR 0010): si el paso cambia contrato, estados o reglas, actualiza `.proto`, `SPEC.md`, `domain-model.md` y la ficha `S-…` **antes** del código, en el mismo cambio.
- Contrato: edita `network-contracts/proto/<x>.proto` (solo aditivo, ADR 0004) y corre `./scripts/sync-protos.sh`. Commitea el contrato y **todos** los `internal/pb` regenerados juntos.
- Migración: siguiente número del contenedor, `up` y `down`; tablas nuevas con RLS (`ENABLE` + `FORCE` + política por `app.tenant_id`, `SYSTEM` para jobs) y `GRANT` mínimo al rol `<c>_svc`. Lo financiero, fiscal o de inventario es inmutable: sin `UPDATE`/`DELETE` en el `GRANT`.
- Go: capas `internal/domain` (reglas puras, errores `Err…`), `internal/store` (SQL, transacciones, `inTenant`), `internal/service` (orquesta, idempotencia), `internal/server` (gRPC, `authorize`, `toStatus` con `reason` del glosario). Rust (ledger, payments-core, settlement): `src/domain`, `src/store`, `src/grpc`, `src/events`.
- Cada camino de error tiene su `reason` en `toStatus` y una prueba en `internal/server/server_test.go`.
- Flutter: `lib/features/<módulo>/`; textos en `lib/core/l10n/app_es.arb` (con `@clave` para marcadores) y `app_en.arb`; `flutter gen-l10n`. **No corras `dart format` sobre carpetas enteras**: reformatea archivos ajenos. Formatea solo los archivos que tocaste.

### 2.3 Verificar
| Nivel | Comando |
|---|---|
| L1 Go | `cd <c> && go vet ./... && go vet -tags l2 ./... && go test -race ./...` |
| L1 Rust | `cd <c> && cargo clippy -- -D warnings && cargo test` |
| L2 | `./<c>/test/test_l2.sh` (base efímera; nunca la base `plentypay`) |
| Gateway | `cd api-gateway && go test -race ./...` |
| Flutter | `cd flutter_app && flutter analyze && flutter test` (18 notas previas del analizador, ninguna de inventario, caja ni compras) |
| Transversal | `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check` |
| Consumidores del contrato | `for c in <consumidores>; do (cd $c && go build ./... && go vet ./...); done` (lista en `network-contracts/consumers.txt`) |

### 2.4 Desplegar (esta máquina es producción)
1. Respaldo del esquema: `docker compose exec -T postgres-db pg_dump -U postgres -d plentypay -n <esquema> | gzip > ~/plentypay-backups/<esquema>-before-<migr>-$(date +%Y%m%d-%H%M%S).sql.gz`.
2. `docker compose build <c> [api-gateway]`.
3. `docker compose run --rm --no-deps <c> migrate` → debe decir `"applied":true` con la versión nueva.
4. `docker compose up -d --no-deps <c> [api-gateway]` y espera `healthy`.
5. Si cambió el contrato, **reconstruye también api-gateway**: el traductor JSON↔proto del gateway rechaza enums y campos que no conoce.

### 2.5 L4 en el Pixel 8 Pro (`41191FDJG002UT`)
- App de depuración (`app.plentypay.pay.debug`, cuenta demo con su propia sesión): `cd flutter_app && flutter build apk --debug && adb install -r build/app/outputs/flutter-apk/app-debug.apk && adb reverse tcp:8080 tcp:8080`. La app de producción del teléfono tiene la cuenta personal del dueño: **no la uses**.
- Ayudante: `scripts/dev/pixel.sh` (`tap "<texto>"`, `type "<texto>"`, `hidekb`, `scan <dígitos>`, `shot <archivo>`, `ui`). Ejemplos y trampas en la cabecera del script.
- Trampas aprendidas:
  - `adb shell input text` no sirve para simular un lector de códigos (no llega como teclas seguidas): usa `pixel.sh scan` (envía `keyevent`).
  - Cierra el teclado **solo si está visible** (`pixel.sh hidekb`); «atrás» sin teclado saca de la pantalla y descarta lo no guardado.
  - Los campos de texto de Flutter no pierden el foco al tocar una zona vacía: escribe, cierra el teclado y recién entonces toca el siguiente campo.
  - Si aparece un diálogo del sistema (p. ej. «Allow wireless debugging on this network?»), **cancélalo**: es decisión del dueño.
  - Si una notificación aparece en el volcado, ciérrala (`adb shell cmd statusbar collapse`) y no registres su contenido. No vuelques la pantalla mientras un campo de contraseña tenga el foco.
- Datos de prueba: crea un producto o proveedor de prueba con un nombre que diga `prueba <paso>`, y al terminar **archívalo o desactívalo**. Nunca cierres una caja ni cobres en un guion si un paso previo falló (incidentes de F17.4 y F17.9 en `status.md`).
- Evidencia: verifica en la base de datos (solo lectura) lo que la pantalla muestra: `docker compose exec -T postgres-db psql -U postgres -d plentypay -At -c "<SELECT>"`.

### 2.6 Cerrar el paso
1. Actualiza en el mismo cambio: `SPEC.md` (reglas), `README.md` del contenedor (estado y fila de observabilidad), `docs/roadmap/status.md` (estado, nivel, evidencia con fecha y nombres de pruebas), `docs/glossary.md` (nombres, `reason`, enums nuevos), `ARCHITECTURE.md` §2 si cambió el estado del contenedor, `docs/roadmap/continuity.md` §2–§3.
2. Commits por contenedor, Conventional Commits, con `Co-Authored-By` si participó Claude (AGENTS §2.20). Orden recomendado: `network-contracts` (contrato + pb) → contenedor → `api-gateway` → `flutter_app` (+ fichas) → `docs(roadmap)`.
3. `git push origin main` y publica la app: `./scripts/publish-release.sh <patch|minor> <notas.md>` (notas en español, para el usuario, sin jerga). Si el script falla después de subir la versión (p. ej. red), reanuda con `./scripts/publish-release.sh none <notas.md>`: **no** vuelvas a subir el número. La compilación tarda más de 10 minutos: córrela en segundo plano.

## 3. Crear un contenedor nuevo con servidor (notifications, logistics, analytics-bi, geolocation)
Hoy esos cuatro tienen solo `internal/domain`, `internal/pb`, `migrations/0001_initial.sql`, `SPEC.md` y `README.md`, y **no están** en `docker-compose.yml`. Para darles servidor (AGENTS §4, ADR 0002: se copia, no se importa):
1. Copia y adapta desde `inventory/`: `main.go`, `Dockerfile`, `internal/config`, `internal/observability` (logger, `Reporter`, interceptor, métricas), `internal/tenancy`, `internal/migrate`, `internal/events` (relay de outbox y consumidor durable con `processed_events`), `internal/server` (patrón `authorize`/`toStatus`), `test/test_l2.sh` (cambia `SVC`).
2. Convierte `migrations/0001_initial.sql` al formato del contenedor de referencia (`0001_initial.up.sql` + `.down.sql`) **solo si nunca se aplicó en producción** (no lo está: no hay servicio).
3. Rol de base y esquema en `postgres-db/init/00-roles-and-schemas.sql` (verifica si ya existen), usuario NATS en `event-bus/nats.conf` (publica en `pp.<dominio>.>` y suscribe lo que consume), llaves de bucket si guarda archivos (`scripts/init-buckets.sh`).
4. Servicio en `docker-compose.yml` (red `data`, `healthcheck`, variables sin secretos en el archivo), backend en api-gateway (`internal/routes`), fila en `docs/architecture/service-dependencies.md` y en `ARCHITECTURE.md` §2.
5. Pruebas obligatorias desde el primer RPC: pánico, propagación de traza y fuga de datos sensibles (`observability-standards.md` §15), copiadas de inventory.
