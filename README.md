# PlentyPay

Plataforma financiera modular: POS + pagos/wallet + cumplimiento fiscal, de grado bancario. Documentación de producto en `docs/`.

## Estado

**Etapa 1 — Foundation en progreso**. Detalle vivo en `docs/40-ESTADO-IMPLEMENTACION.md` y estados por servicio en cada `services/*/README.md` (convención §22: `IMPLEMENTED / PARTIAL / MOCK / STUB / TODO / BLOCKED`).

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

```bash
# Backend: entorno completo
cd deployment/compose && cp .env.example .env && docker compose up --build -d

# Verificar todo (format/lint/test/contratos/compose)
./scripts/dev.sh all

# Núcleo contable (dominio puro, 15 tests)
cd services/ledger && cargo test
```

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
| `docs/40-ESTADO-IMPLEMENTACION.md` | Estado vivo por componente |
