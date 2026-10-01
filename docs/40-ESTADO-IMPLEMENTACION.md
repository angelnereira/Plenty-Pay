# Estado de Implementación (viva)

Sucesor de `MIGRATION_STATUS.md` referenciado por doc 01 (C-4). Actualizar en CADA commit de código. Convención §22.

## Etapa 1 — Foundation

| Componente | Estado | Evidencia |
|---|---|---|
| Estructura repo + docs vivos + ADRs | IMPLEMENTADO | docs/, README |
| Contratos proto v1 (6 servicios) + buf lint | IMPLEMENTADO | `buf lint` OK; `buf generate` OK; stubs Go compilando |
| Stub Go generados (contrato compartido) | IMPLEMENTADO | contracts/gen (go build OK) |
| identity: dominio (hash/sesiones/authz/store) | IMPLEMENTADO (store memoria) | go vet/test OK — 5 suites |
| identity: servidor gRPC + correlación | IMPLEMENTADO | bufconn tests: flujo completo, salud, anti-enumeración |
| identity: PostgreSQL + migraciones | TODO | Etapa 1 completion |
| identity: TLS/mTLS | TODO | plaintext solo red interna |
| api-gateway | TODO | README con alcance |
| ledger: dominio contable | IMPLEMENTADO | cargo test 15/15, clippy -D warnings |
| ledger: sqlx/PostgreSQL + gRPC tonic | TODO | Etapa 2 |
| payments / notifications / settlement | TODO | READMEs con alcance |
| Compose postgres+identity | IMPLEMENTADO | docker compose config OK |
| Flutter app | BLOCKED-LOCAL | arm64 sin Flutter x64; CI x64 plan |
| CI (GitHub Actions) | TODO | siguiente paso Etapa 1 |
| output/ artefactos | BLOCKED-LOCAL | backend binarios al construir; APK vía CI |

## Bloqueos activos

| Bloqueo | Desbloqueo |
|---|---|
| Flutter/APK local | runner CI x64 o host x64 |
| Rieles de pago reales (Yappy/TELERED/PSP) | acuerdos + sandbox + SBP (doc 03 §9) — BLOCKED-UNVERIFIED/LEGAL |
| Facturación DGI real | credenciales PAC (sistema origen) — BLOCKED-UNVERIFIED |
