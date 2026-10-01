# Diagnóstico de Ingeniería — 2026-10-01

Fuente: mandato `docs/MASTER-ENGINEERING-INSTRUCTIONS.md` §31. Estado del repo auditado con evidencia ejecutada (comandos reales, no estimaciones).

## 1. Estado del repositorio

| Hecho | Evidencia |
|---|---|
| Solo documentación; 0 archivos de código | 5 `.md`, 861 líneas, commit único `6b182d3` |
| Los docs afirman código existente que NO está en el repo | Verificado por filesystem: `MIGRATION_STATUS.md`, `docker-compose.yml`, `infra/k8s/`, `package.json`, `web/`, `lib/constants/plans.ts`, `pubspec.yaml` → **NO EXISTEN** |
| Cero TypeScript/JS/Python en el repo | Grep sobre el árbol: solo menciones contextuales en texto, sin un solo archivo de código |
| Remoto GitHub con 1 commit | `origin https://github.com/angelnereira/Plenty-Pay.git` |

**Interpretación**: los docs 01/04 describen un sistema de origen que vive FUERA de este repo. Este repo es la hoja de ruta; el sistema no se migró aquí. Por regla §1.6, las afirmaciones "✅ Construido en este repo" se corrigen (ver §3) y el plan parte de cero, en el stack destino (Rust/Go), sin el monolito TS de transición.

## 2. Contradicciones detectadas y resolución (§1.6)

| # | Contradicción | Decisión más reciente (obliga) | Resolución aplicada |
|---|---|---|---|
| C-1 | Docs 00/02/04 incluyen **macOS** como target; mandato §2 declara Android/iOS/Windows/Linux | Mandato (posterior) | Mandato gana. macOS: diferido (misma base compila; se activa cuando exista host/toolchain). Registrado en ADR-0001 |
| C-2 | Doc 04 §2/§6 marca `payments-orchestrator`, `ledger-service`, `commerce-core (web/)`, `mcp-server` como "✅ Construido" **en TypeScript, en este repo** | Mandato §2 (prohíbe TS) + filesystem (no existe) | No hay nada que migrar: se construye directo en Rust/Go según doc 04 §7 (que ya declara Rust como destino). Registrado en ADR-0001 |
| C-3 | Doc 04 §5 dice que Compose→K8s "ya está construida en este repo (`infra/k8s/`, `docker-compose.yml`)" | Filesystem (no existe) | Se construye en Etapa 1. Banner de corrección añadido al doc |
| C-4 | Doc 01 §12 referencia `MIGRATION_STATUS.md` inexistente | Filesystem | Referencia marcada como externa/no disponible en diagnóstico; se creará `docs/ESTADO-IMPLEMENTACION.md` como sucesor |
| C-5 | Doc 03 §10.5: default de moneda `PAB` cuestionado (economía real opera en USD) | Mandato §12 (precisión explícita) | ADR-0002: moneda SIEMPRE explícita en contrato y storage; sin default implícito. USD/PAB par 1:1 soportados |
| C-6 | Doc 00 §3.6 exige tracking público vía enlace web, pero mandato §2 prohíbe frontend web | Ratificación del dueño (2026-10-01) | **RESUELTA — ADR-0007**: contenedor `web-public` (Go, SSR/servido estático, sin TS/React) solo para superficies públicas sin login: tracking QR, landing, marketplace público. App nativa sigue siendo la única UI con sesión |
| C-7 | Instrucción inicial del dueño pide contenedor NoSQL | Ratificación del dueño (2026-10-01) | **RESUELTA — ADR-0008**: NoSQL diferido hasta caso real medido (§18) |
| C-8 | Instrucción del dueño dice "Terraform"; doctrina previa decía OpenTofu por licencia BSL | Ratificación del dueño (2026-10-01) | **RESUELTA — ADR-0009**: módulos HCL compatibles Terraform/OpenTofu; binario OpenTofu por defecto (100% OSS) |

## 3. Toolchain local (verificado hoy)

| Herramienta | Estado | Impacto |
|---|---|---|
| Go 1.27.1 (linux/arm64) | ✅ | Backend Go local verificable |
| Rust 1.98.1 + rustfmt + cargo (crates.io OK) | ✅ | Ledger/payments local verificable |
| Docker 29.8.1 | ✅ | Compose/Postgres local OK |
| Flutter SDK | ❌ **BLOCKED-LOCAL**: solo releases Linux x64; host arm64 sin qemu | `output/` APK/destktop requiere CI x64 o install vía emulación (no viable de forma productiva). Código Dart se escribe y compila en CI |
| buf / protoc | Se instalan vía `go install` (sin root) | Lint de contratos |
| Android SDK | ❌ no definido | Requerido para APK; vía CI x64 |

## 4. Inventario funcional: qué existe / incompleto / a migrar / faltante

- **Existe (código)**: nada.
- **Existe (diseño de verdad)**: blueprint funcional completo (doc 00); modelo Payment Core (doc 04 §2), diseño ledger doble-partida (docs 01 §6 + 03 §10), contratos de riel y topología (docs 02/03).
- **Incompleto**: todo — repo en Etapa 0.
- **A migrar**: nada dentro del repo (C-2). El sistema de origen queda como referencia, no como código.
- **Faltante (crítico Etapa 1)**: estructura, contratos gRPC, identity, ledger, payments, gateway, compose, CI, observabilidad mínima, tests.

## 5. Riesgos que condicionan implementación

1. **Límite de plataforma**: iOS/macOS builds requieren hosts Apple; Windows build requiere host Windows → matriz de builds vía CI con runners nativos (artefactos a `output/`).
2. **Moneda default**: resuelto por ADR-0002 (explícito).
3. **Web público (tracking/marketplace web)**: C-6 abierto.
4. **Regulatorio SBP** (doc 03 §9): gate legal ANTES de rieles reales; Etapa 4 solo con contrato/abogado — marcado `BLOCKED-LEGAL` para dinero real; Wallet interna (doc 00 §3.2) sí procede.
5. **Integraciones externas** (HKA/Yappy/TELERED/PSP): `UNVERIFIED` hasta tener credenciales/sandbox; se construyen por adaptador con contrato, sin implementación ficticia (§28).
