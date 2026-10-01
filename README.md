# PlentyPay

Plataforma financiera modular: POS + pagos/wallet + cumplimiento fiscal, de grado bancario. Documentación de producto en `docs/`.

## Estado

**Etapa 1 — Foundation en progreso**. Detalle vivo en `docs/40-ESTADO-IMPLEMENTACION.md`, estados por servicio en cada `services/*/README.md` (convención §22: `IMPLEMENTED / PARTIAL / MOCK / STUB / TODO / BLOCKED`), y el camino completo por fases e hitos en `docs/50-HOJA-DE-RUTA.md`.

## Arquitectura

Una transacción, de extremo a extremo, con trazabilidad W3C propagada en metadata gRPC (`traceparent` / `x-correlation-id` / `x-request-id`, ADR-0004):

```
Flutter → api-gateway → payments → rail-adapter → ledger → PostgreSQL
```

| Servicio | Lenguaje | Responsabilidad única | Estado |
|---|---|---|---|
| `identity` | Go | auth, sesiones, roles/permisos/features, auditoría append-only | IMPLEMENTADO (memoria + PostgreSQL sqlc/pgx, migraciones fail-secure); mTLS TODO |
| `api-gateway` | Go | BFF hacia Flutter; validación de sesión por llamada | TODO (Etapa 1) |
| `ledger` | Rust | doble partida, holds, reversos, inmutabilidad, dinero exacto | dominio IMPLEMENTADO (15 tests, clippy limpio); PostgreSQL+gRPC Etapa 2 |
| `payments` | Rust | orquestador Intent/Payment/Attempt + wallet (ADR-0006) | TODO (Etapa 2) |
| `notifications` | Go | salida única de notificaciones | TODO (Etapa 2) |
| `settlement` | Go | liquidación marketplace | TODO (Etapa 3) |

Contratos: 6 servicios v1 en `contracts/proto/` (`buf lint` OK, stubs Go generados y compilando). Comunicación SOLO por contratos gRPC; acceso cruzado a BD prohibido.

## Estructura

```
apps/plentypay/      Cliente Flutter único (Android/iOS/Windows/Linux) — BLOCKED-LOCAL: builds via CI x64
services/            Microservicios autocontenidos: 1 carpeta = 1 contenedor (mandato §4)
  identity/          Go — auth, sesiones, roles/permisos/features
  ledger/            Rust — doble partida, idempotencia, reversos
  payments/          Rust — orquestador de pagos + wallet (Etapa 2)
  api-gateway/       Go — BFF hacia Flutter (Etapa 1)
  notifications/     Go — salida única de notificaciones (Etapa 2)
  settlement/        Go — liquidación marketplace (Etapa 3)
contracts/           gRPC + proto (fuente de verdad de interfaces entre servicios)
deployment/compose/  Entorno local: docker compose up --build
infrastructure/      IaC HCL (OpenTofu binario; ADR-0009) — Etapa 5
output/              Artefactos compilados por plataforma (mandato §19)
scripts/             dev.sh: fmt/lint/test/contracts/compose (mandato §26)
docs/                Documentación viva + ADRs
tests/               Integración y contrato a nivel repo
```

## Quickstart

Requisitos: Go, Rust (stable), `buf`, Docker.

```bash
# Backend: postgres:17 + identity (gRPC :50051, healthcheck incluido)
cd deployment/compose && cp .env.example .env && docker compose up --build -d

# Verificar todo (fmt / lint / test + integración PG real / contratos / compose)
./scripts/dev.sh all

# Núcleo contable (dominio puro, 15 tests)
cd services/ledger && cargo test
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) sobre runner self-hosted arm64: `buf` (lint + codegen sin diff), `go` (vet + unit + integración contra PostgreSQL real en BD desechable), `rust` (fmt/clippy/test). Estado: en estabilización (ver `docs/40-ESTADO-IMPLEMENTACION.md`).

## Reglas de oro (doctrina completa: `docs/MASTER-ENGINEERING-INSTRUCTIONS.md`)

1. Dinero = entero + moneda explícita; NUNCA float. `SUM(debit)==SUM(credit)` antes de confirmar.
2. Solo Dart/Flutter + Rust + Go. Sin TypeScript/JS/Python/etc. (ADR-0001).
3. Servicios se comunican SOLO por contratos gRPC (`contracts/`); cero acceso cruzado a BD.
4. La autorización vive en backend; la app pinta según el contexto de autorización.
5. Cero secretos en Git; fail secure; idempotencia en todo lo que mueve dinero.

## Documentación

| Doc | Contenido |
|---|---|
| `docs/00..04-*` | Producto, sistema base, infraestructura, pagos/regulación, contenedores (origen) |
| `docs/00-DIAGNOSTICO-INGENIERIA.md` | Auditoría, contradicciones C-1..C-8 y resoluciones |
| `docs/10-PLAN-DE-IMPLEMENTACION.md` | Etapas 1-5, DoD, registro UNVERIFIED/BLOCKED |
| `docs/20-DECISIONES-ARQUITECTURA.md` | ADRs (decisiones con contexto y consecuencias) |
| `docs/30-ESTRUCTURA-REPOSITORIO.md` | Árbol objetivo vs. actual; servicios futuros por etapa |
| `docs/40-ESTADO-IMPLEMENTACION.md` | Estado vivo por componente (actualizar en cada commit) |
| `docs/50-HOJA-DE-RUTA.md` | Fases 0-6, hitos con aceptación verificable, gates duros, matriz de dependencias |

## Hoja de ruta (ejecutivo)

- **Fase 0 ✅**: diagnóstico, ADRs 0001-0010, contratos v1, dominio ledger (15 tests), CI en curso.
- **Fase 1 — Foundation** (en progreso): identity→PostgreSQL ✅; sigue api-gateway, Flutter vía CI x64, compose completo.
- **Fase 2 — Core financiero**: ledger persistente (sqlx, append-only por rol de BD), payments core Rust con `UNDETERMINED`, wallet, ≥500 TPS sostenidos.
- **Fases 3-6**: commerce, integraciones con **gates duros** (`GATE-LEGAL` registro SBP, `GATE-EXT` rieles Yappy/TELERED/PSP, `GATE-TOOLCHAIN`), escala solo con métricas reales.

Detalle hito por hito, con criterios de aceptación ejecutables: `docs/50-HOJA-DE-RUTA.md`.
