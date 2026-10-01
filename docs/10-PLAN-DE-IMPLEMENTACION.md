# Plan de Implementación por Etapas

Sigue mandato §25. Cada etapa tiene alcance, Definition of Done (§30) y estado. El estado viva en `docs/ESTADO-IMPLEMENTACION.md` (actualizado en cada commit de código).

## Etapa 0 — Diagnóstico y contratos (actual)

- [x] Diagnóstico completo (docs/00)
- [x] Decisiones ADR (docs/20)
- [x] Estructura objetivo (docs/30)
- [x] Contratos proto v1 (contracts/)
- [ ] buf lint + codegen Go/Rust verificado
- [ ] CI básico

## Etapa 1 — Foundation

Servicios: `identity` (Go), `api-gateway` (Go), esqueleto `ledger`/`payments` con dominio Rust testeado. Infra: Postgres, Compose, observabilidad mínima (logs estructurados JSON + health/readiness + correlation IDs W3C), CI (lint+test+build de backend; Flutter en runner x64).

**DoD Etapa 1**:
1. `docker compose up` levanta Postgres + identity + gateway funcionales.
2. identity: registro/autenticación (password argon2id), sesiones, authorization context (identity→tenant→role→permissions→features), RBAC en backend (§7).
3. Flutter: app shell dinámico por permisos + auth + navegación; **status por pantalla** (§22). Build por CI; `output/` con APK cuando runner disponible (limitación arm64 documentada).
4. Tests: unit + integration (identity: auth, sesiones, permisos, límites), contract tests (buf).
5. Sin secretos en Git; `.env` gitignored.

## Etapa 2 — Core financiero

- `ledger` (Rust): doble partida completa con PostgreSQL, idempotencia a nivel fila, reversos, append-only por rol de BD (REVOKE UPDATE/DELETE), `SUM(debit)==SUM(credit)` en transacción + trigger.
- `payments` (Rust): PaymentIntent→Attempt, rail `WALLET_INTERNAL`, idempotencia, nunca escribe BD del ledger (solo contrato).
- `notifications` (Go): canales email/console adaptadores.
- Wallet v1: saldos available/held/pending desde ledger (wallet.proto).
- Tests financieros §20 completos: idempotencia, concurrencia, rollback, duplicación, timeout, retry, límites.

## Etapa 3 — Commerce

catálogo, inventario, POS offline-first, facturación (marcada `BLOCKED-UNVERIFIED` hasta certificar integración DGI real — doc 01 HKA es del sistema de origen), comercios/usuarios empresariales.

## Etapa 4 — Integraciones (gates)

Adaptadores por riel (Yappy, TELERED, PSP/tarjetas, Apple/Google Pay). **Gates duros**: contrato PSP firmado, registro SBP iniciado (doc 03 §9), credenciales sandbox. NFC: según capacidades reales por plataforma (doc 03 §2). Todo `UNVERIFIED` hasta verificación real.

## Etapa 5 — Escalabilidad

cache, colas, réplicas, Kubernetes, autoscaling, CDC/analytics **solo con métricas reales** (doc 02 §2).

## Cadena de transacción trazable (§17)

Flutter → api-gateway → payments → rail-adapter → ledger → Postgres, con `x-correlation-id`/`x-request-id`/`traceparent` (W3C) propagados en metadata gRPC. Convención documentada en ADR-0004.

## Registro UNVERIFIED/BLOQUEOS (viva)

| Ítem | Estado | Desbloqueo |
|---|---|---|
| Flutter local (arm64) | BLOCKED-LOCAL | CI x64 / host x64 |
| APK en `output/` | BLOCKED-LOCAL | runner Android (CI) |
| iOS/Windows/macOS builds | BLOCKED-TOOLCHAIN | runners nativos |
| HKA/DGI reales | BLOCKED-UNVERIFIED | credenciales PAC |
| Yappy/TELERED/PSP | BLOCKED-UNVERIFIED | acuerdos + sandbox |
| Registro SBP | BLOCKED-LEGAL | abogado fintech (doc 03 §9) |
| Web público (tracking) | OPEN (C-6) | decisión dueño |
| WebAuthn en Flutter desktop/mobile | UNVERIFIED | análisis plataformas (§28) |
