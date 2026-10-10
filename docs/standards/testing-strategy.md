# Estrategia de pruebas y Definición de Hecho

## 1. Niveles de verificación
Cada paso del roadmap declara el nivel mínimo que debe alcanzar. El PR pega la salida real del comando. **Un nivel no ejecutado no se declara** (AGENTS.md regla 11).

| Nivel | Qué prueba | Herramientas | Cuándo |
|---|---|---|---|
| **L0** | Compila, formatea, lint | `go vet`, `golangci-lint`, `cargo clippy -D warnings`, `cargo fmt --check`, `flutter analyze`, `buf lint`/`protoc` | todo PR |
| **L1** | Unidad: dominio puro, sin red ni BD | `go test -race`, `cargo test`, `flutter test` | todo PR |
| **L2** | Integración con dependencias reales en contenedor (PostgreSQL, NATS, Scylla) | testcontainers-go / testcontainers-rs, `docker compose -f docker-compose.test.yml` | todo PR que toque store/events |
| **L3** | Contrato: el servidor cumple el `.proto` y el SPEC; el cliente tolera campos nuevos | pruebas gRPC contra servidor real en proceso; golden files de JSON del gateway | PR que toque RPC |
| **L4** | Extremo a extremo: varios contenedores por Compose, flujo de usuario | `scripts/e2e-*.sh`, Flutter `integration_test` contra gateway | cierre de fase |
| **L5** | Carga, caos, seguridad | k6, toxiproxy/chaos-mesh, OWASP ZAP, Trivy, pentest | Fases 28–30 |

## 2. Qué se prueba siempre
1. **Una prueba por regla del SPEC** (`R<n>`), con el id en el nombre: Go `TestR4_RefundExceedsCaptured`, Rust `r4_refund_exceeds_captured`, Dart `test('R4 ...')`.
2. **Permisos**: por cada RPC, una prueba de llamada sin permiso → `PERMISSION_DENIED` y sin identidad → `UNAUTHENTICATED`.
3. **Aislamiento de tenant**: recurso de otro tenant → `NOT_FOUND` (nunca `PERMISSION_DENIED`, que revelaría existencia).
4. **Idempotencia**: misma key+mismo request → misma respuesta y sin efecto doble; misma key+otro request → `ALREADY_EXISTS`.
5. **Máquinas de estado**: todas las transiciones válidas y **todas** las inválidas de `domain-model.md` §8 (tabla generada).
6. **Dinero**: vectores de `domain-model.md` §4 (A–E) literalmente; propiedad "suma de partes = total" con pruebas de propiedades.
7. **Concurrencia** en ledger, inventario y reservas: N goroutines/tareas sobre la misma cuenta/SKU → saldo final exacto, ninguno negativo si la regla lo prohíbe.
8. **Eventos**: la mutación escribe el outbox en la misma transacción (L2); el consumidor procesa dos veces el mismo `event_id` sin efecto doble.
9. **Errores de dependencias**: dependencia caída → `UNAVAILABLE` con `reason`, sin estado a medias.
10. **Migraciones**: `up` sobre BD vacía y sobre la versión anterior con datos (L2).
11. **UI** (Flutter): los 4 estados de cada pantalla (cargando, vacío, error, datos) con widget tests; golden tests de componentes del design system en tema claro y oscuro.

## 3. Pruebas de propiedades (obligatorias en dinero)
- Rust: `proptest`; Go: `testing/quick` o `rapid`.
- Propiedades mínimas: `fee + net == gross`; reparto de splits suma exacto; ningún asiento con monto ≤ 0; toda transacción balancea por moneda; aplicar y revertir deja saldo original; redondeo half-up de `domain-model.md` §4.2 coincide con implementación de referencia en enteros.

## 4. Datos de prueba
- Fábricas/builders por entidad dentro del contenedor (`internal/testutil` en Go, `tests/common` en Rust).
- Reloj inyectable (`Clock`) y generador de ids inyectable: **prohibido** `time.Now()`/`Utc::now()` directo en dominio (lint).
- Nada de datos reales de personas; correos `@example.com`, teléfonos `+507 6000-00xx`.

## 5. Cobertura
- Global por contenedor ≥ **80 %** de líneas en `domain`/`service`.
- ≥ **95 %** en ledger, motor de comisiones (fee engine) y máquinas de estado de pagos.
- La cobertura no reemplaza §2: un PR con 100 % pero sin prueba de permisos se rechaza.

## 6. Pruebas en CI
Orden y paralelismo en `delivery-pipeline.md` §2. Pruebas inestables (flaky) se ponen en cuarentena con issue y fecha; máximo 7 días.

## 7. Definición de Hecho (DoD) de un paso del roadmap
- [ ] Criterio de aceptación del paso cumplido y demostrado con el nivel exigido (salida pegada).
- [ ] Una prueba por cada regla `R<n>` tocada; pruebas de permisos, tenant e idempotencia si aplica.
- [ ] L0 y L1 en verde; L2/L3/L4 según el paso.
- [ ] `SPEC.md` actualizado si cambió comportamiento; `.proto` sincronizado (`sync-protos.sh --check`).
- [ ] `README.md` del contenedor (sección Estado) y `docs/roadmap/status.md` actualizados con nivel y evidencia.
- [ ] Métricas, logs y trazas según `observability-standards.md` para lo nuevo.
- [ ] Checklist de seguridad (`security-standards.md` §14).
- [ ] `check-isolation.sh` y `check-docs.sh` en verde.
- [ ] Sin TODO sin issue; sin código muerto; sin secretos.

## 8. Definición de Hecho de una FASE
Todos los pasos cerrados + prueba L4 del flujo de la fase en Compose + dashboards/alertas del contenedor activos + documentación operativa mínima (cómo arrancar, cómo diagnosticar) + la fase es **desplegable en producción por sí sola** sin romper fases anteriores (feature flags para lo incompleto).
