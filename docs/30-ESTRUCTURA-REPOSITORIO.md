# Estructura del Repositorio (objetivo mandato §5, evolución real)

Regla §5: no copiar ciegamente; refactor progresivo. Estado actual del árbol vs objetivo:

```
plenty-pay/                        (repo existente; renombrar remoto es decisión del dueño)
├── README.md                      ✅ creado
├── docs/                          ✅ creado — documentación viva
│   ├── 00..04 (docs producto/origen)   ✅ movidos de la raíz
│   ├── MASTER-ENGINEERING-INSTRUCTIONS.md   ✅ codificado del mandato
│   ├── 00-DIAGNOSTICO-INGENIERIA.md        ✅
│   ├── 10-PLAN-DE-IMPLEMENTACION.md        ✅
│   ├── 20-DECISIONES-ARQUITECTURA.md       ✅ (ADRs)
│   └── 30-ESTRUCTURA-REPOSITORIO.md        ✅ (este doc)
├── contracts/
│   ├── buf.yaml, buf.gen.*.yaml   ✅ lint offline (ADR-0005)
│   └── proto/plentypay/{common,identity,ledger,payments,wallet,notifications}/v1/*.proto  ✅
├── services/
│   ├── identity/     Go   — README ✅, código Etapa 1
│   ├── api-gateway/  Go   — README ✅, código Etapa 1
│   ├── ledger/       Rust — README ✅, dominio + tests ✅, DB/gRPC Etapa 2
│   ├── payments/     Rust — README ✅, código Etapa 2
│   ├── notifications/ Go  — README ✅, código Etapa 2
│   └── settlement/   Go   — README ✅, Etapa 3+ (marketplace)
├── apps/
│   └── plentypay/    Flutter — README ✅ (pantallas etapa 1), código tras toolchain/CI
├── infrastructure/   README ✅ (terraform/k8s Etapa 5; Compose hoy)
├── deployment/compose/ ✅ docker-compose.yml (Postgres Etapa 1) + .env.example
├── scripts/          ✅ helper dev (fmt/test/lint backend hoy)
├── tests/            ✅ README (integración/contract; sin código muerto)
├── output/           ✅ README + .gitkeep (artefactos; APK via CI — limitación arm64)
└── .gitignore        ✅
```

Servicios futuros (NO crear dirs vacíos hasta su etapa — §23): `catalog`, `inventory`, `invoicing`, `pos`, `logistics`, `geolocation`, `security` (revisar si transversal lib), rail adapters (`payments` crea `services/rails/<rail>` en Etapa 4).

Propiedad de datos: 1 Postgres, **esquema por servicio** (`identity.*`, `ledger.*`, `payments.*`); acceso cruzado prohibido (§18) — solo contratos.

Convenciones de servicio (§4): cada servicio incluye `README.md`, `Dockerfile`, migraciones, tests, config; eliminable sin arrastrar dependencias ocultas.
