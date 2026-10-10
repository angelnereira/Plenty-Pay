# Ingeniería: cómo se construye, verifica y entrega PlentyPay

Complementa a [`AGENTS.md`](AGENTS.md) (el *qué* y el *cuándo*) con el *cómo*. Normas completas en [`docs/standards/`](docs/standards).

## 1. Agregar o cambiar algo
| Quiero… | Pasos |
|---|---|
| Implementar un paso del roadmap | `AGENTS.md` §3 (ciclo completo, DoD en `testing-strategy.md` §7) |
| Cambiar un contrato | Editar `.proto` (solo aditivo) → `./scripts/sync-protos.sh` → actualizar SPEC del dueño y de consumidores → commitear lo generado |
| Agregar un evento | Mensaje en el `.proto` del dueño + fila en `events-and-messaging.md` §7 + outbox en el productor + consumidor idempotente |
| Agregar una ruta para la app | Fila en `api-gateway/SPEC.md` §4 + tabla declarativa del gateway + golden test + pantalla en `docs/ux/screen-catalog.md` |
| Agregar un permiso | `security-standards.md` §3.1 → `identity/internal/auth/permissions.go` → prueba `TestR10_*`/`TestR12_*` → presets si aplica |
| Agregar un módulo de la app | Fila en `screen-catalog.md` §1 + regla de visibilidad en identity R10 + `ModuleDef` en `flutter_app` (mismo orden) |
| Agregar un contenedor | `AGENTS.md` §4 + ADR |
| Tomar una decisión nueva de arquitectura | ADR con la plantilla; actualizar documentos afectados en el mismo cambio |

## 2. Convenciones
- Documentación y textos de UI en **español** (`es_PA`), identificadores/commits/métricas/`reason` en **inglés**.
- Commits: Conventional Commits con scope = contenedor y referencia al paso: `feat(pos): multi-tender checkout (F17.5, R4)`.
- Se trabaja **directamente sobre `main`**, sin ramas adicionales ni PR; cada commit corresponde a un paso del roadmap y lleva en el mensaje la verificación ejecutada. La plantilla `.github/pull_request_template.md` queda como checklist de Definición de Hecho.
- Pruebas nombradas con el id de regla (`TestR4_...`, `r4_...`, `test('R4 ...')`).
- Dinero: enteros en centavos, `half_up` entero, vectores del dominio como pruebas literales.

## 3. Verificación
| Nivel | Comando típico |
|---|---|
| L0 | `go vet ./...`, `golangci-lint run`, `cargo clippy --all-targets -- -D warnings`, `flutter analyze`, `./scripts/check-docs.sh` |
| L1 | `go test -race ./...`, `cargo test`, `flutter test` |
| L2 | pruebas con testcontainers (PostgreSQL 16, NATS, Scylla) |
| L3 | pruebas de contrato gRPC y golden JSON del gateway |
| L4 | `docker compose up --build` + `scripts/e2e-*.sh`, `flutter test integration_test` |
| L5 | k6, chaos, pentest (F28–F29) |

### Lo verificado en el entorno donde se generó este repositorio (2026-10-10)
| Verificación | Resultado |
|---|---|
| `./scripts/check-isolation.sh` | OK |
| `./scripts/check-docs.sh` | OK |
| `./scripts/sync-protos.sh --check` + compilación conjunta de los 18 `.proto` (protoc 29.3) | OK |
| `identity`: `go test -race ./...` (servidor + catálogo de permisos) | OK |
| `api-gateway`: `go test -race ./...` (10 pruebas) | OK |
| `./scripts/e2e-identity-gateway.sh` (binarios reales, 14 comprobaciones) | 14/14 |
| `scripts/ledger-tests` (27 invariantes sobre PostgreSQL embebido) | 27/27 |
| Vectores de comisiones A–E, R1–R3 | recalculados con aritmética entera |

Lo verificado después, al ensamblar el repositorio en la máquina de desarrollo (incluye Docker y Flutter), está en [`docs/roadmap/status.md`](docs/roadmap/status.md).

**No verificable allí** (decirlo es parte de la regla 11 de AGENTS.md): el proxy de módulos Go no era alcanzable (las dependencias se compilaron desde clones de GitHub con `replace` temporales que **no** se entregan; los `go.mod` versionados están limpios); Docker Hub no accesible (imágenes no construidas); sin SDK de Flutter (código Dart no compilado ni probado); sin OpenTofu. Rust 1.97 sí estaba disponible, pero aún no hay código Rust (F10).

## 4. Entornos y entrega
Local (Compose) → CI (Compose efímero) → staging (Kubernetes) → producción (Kubernetes híbrido). Misma imagen por digest en todos; feature flags para lo incompleto; migraciones expand/contract. Detalle: [`docs/standards/delivery-pipeline.md`](docs/standards/delivery-pipeline.md).

## 5. Seguridad en el día a día
Nunca commitear `.env` ni llaves (gitleaks bloquea); credenciales de terceros solo en `security`/OpenBao; nada de PAN/CVV jamás; logs sin PII; cada RPC con permiso declarado y prueba de `PERMISSION_DENIED` y de acceso entre tenants (`NOT_FOUND`). Checklist: `security-standards.md` §14.

## 6. Cuándo parar y preguntar
`docs/open-questions.md` lista lo que bloquea (BLOQUEANTE) y el supuesto con que se avanza mientras tanto. Ambigüedad entre documentos → señalarla, aplicar el orden de autoridad del ADR 0010 y registrarla ahí.
