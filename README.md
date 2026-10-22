# PlentyPay

Una sola plataforma para que un negocio venda, cobre en cualquier forma de pago, controle inventario, entregue, pague a su equipo, facture ante la DGI y entienda sus números — y para que cualquier persona pague, reciba dinero y compre en un marketplace compartido. Descripción de producto sin tecnicismos: [`00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md`](00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md).

> **Estado (2026-10-21, v0.6.0)**: en producción corren identity, api-gateway, ledger (Rust), payments-core (Rust), settlement (Rust), fiscal-invoicing, catalog, inventory, pos y orders, con la app Flutter conectada a ellos (billetera, catálogo, inventario y compras, caja, pedidos, facturación y liquidaciones). Los rieles de pago externos y el PAC están en sandbox: **nada mueve dinero real**. logistics, notifications, geolocation, payroll y analytics-bi aún no tienen servidor. Detalle: [`docs/roadmap/status.md`](docs/roadmap/status.md) · auditoría: [`docs/audits/2026-10-21-comercio-estado-real.md`](docs/audits/2026-10-21-comercio-estado-real.md) · continuidad: [`docs/roadmap/continuity.md`](docs/roadmap/continuity.md).

## Stack (ADR 0001)
| Capa | Tecnología |
|---|---|
| Núcleo de dinero (ledger, payments-core, settlement) | **Rust** (tokio, tonic, sqlx) |
| Resto de servicios | **Go** (gRPC, pgx) |
| Todas las interfaces (Android, iOS, Linux, Windows, macOS, Web) | **Flutter** — una sola app |
| Entre contenedores | gRPC (`network-contracts/`) + eventos NATS JetStream con outbox |
| App ↔ backend | HTTPS/JSON + WebSocket vía `api-gateway` |
| Datos | PostgreSQL 16 (+PostGIS), ScyllaDB, NATS, Garage (S3) |
| Plataforma | OpenBao, OpenTelemetry, Prometheus, Loki, Tempo, Grafana, Docker Compose → Kubernetes, OpenTofu |
Todo de código abierto; sin dependencia de un proveedor de nube.

## Cómo se gobierna este repositorio
**La documentación manda sobre el código** (ADR 0010). Antes de escribir una línea, lee [`AGENTS.md`](AGENTS.md) — es el contrato de trabajo para personas y agentes de código.

| Documento | Para qué |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Orden de lectura, reglas inviolables, ciclo de trabajo por paso |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Vista de conjunto, estado de cada contenedor, flujos |
| [`ENGINEERING.md`](ENGINEERING.md) | Cómo se construye, verifica y entrega |
| [`05-HOJA-DE-RUTA-30-FASES.md`](05-HOJA-DE-RUTA-30-FASES.md) | 30 fases, 224 pasos con criterio de aceptación |
| [`docs/roadmap/status.md`](docs/roadmap/status.md) | Qué está hecho, con evidencia |
| [`docs/roadmap/continuity.md`](docs/roadmap/continuity.md) | Entrada para retomar el trabajo: siguiente paso, archivos y comandos |
| [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) | Fichas ejecutables de los pasos comerciales abiertos |
| [`docs/adr/`](docs/adr/README.md) | 17 decisiones de arquitectura |
| [`docs/glossary.md`](docs/glossary.md) | Glosario universal: todos los nombres (tipos, enums, permisos, `reason`, eventos, variables) y su fuente de verdad |
| [`docs/domain/domain-model.md`](docs/domain/domain-model.md) | Reglas de dinero, ledger, estados (con vectores de prueba) |
| [`docs/standards/`](docs/standards) | gRPC, datos, eventos, seguridad, observabilidad, pruebas, Go, Rust, Flutter, entrega |
| [`docs/architecture/service-dependencies.md`](docs/architecture/service-dependencies.md) | 23 contenedores, puertos, quién llama a quién, degradación |
| [`docs/architecture/rpc-coverage.md`](docs/architecture/rpc-coverage.md) | Cobertura de los 231 RPC contra cada SPEC §4 y los hallazgos de contrato (F03.1) |
| [`docs/architecture/event-chains.md`](docs/architecture/event-chains.md) | Cadenas de reacción entre servicios: qué está construido y desplegado, huecos de diseño y orden de cierre (2026-10-20) |
| [`docs/ux/screen-catalog.md`](docs/ux/screen-catalog.md) · [`docs/design-system.md`](docs/design-system.md) · [`docs/gravital-experience-ui.md`](docs/gravital-experience-ui.md) | Pantallas por módulo/rol, tokens base y regla estricta de diseño Flutter (`gravital-experience-ui`) |
| [`docs/ux/functional-spec/`](docs/ux/functional-spec/README.md) | Requisitos funcionales y ficha de cada pantalla: elementos, textos, validaciones, flujos y conexiones entre módulos |
| [`docs/compliance/regulatory-framework.md`](docs/compliance/regulatory-framework.md) | Normas de Panamá y estándares internacionales convertidos en reglas de negocio `N-…`, con fuentes y nivel de verificación |
| [`docs/compliance/international-standards.md`](docs/compliance/international-standards.md) | Estándares internacionales (ISO 4217, ISO 8601, GS1, PCI DSS, EMV QR, WCAG, NIST, RFC 9457) convertidos en reglas `N-STD-…` |
| [`docs/open-questions.md`](docs/open-questions.md) | Lo que requiere decisión de negocio/legal/proveedor |
| `<contenedor>/SPEC.md` | Especificación ejecutable de cada contenedor |

## Estructura
```
<contenedor>/          23 unidades de despliegue — una carpeta = un contenedor (ADR 0002/0016)
network-contracts/     contratos .proto (única carpeta compartida)
flutter_app/           cliente único Flutter → binarios en output/
output/                binarios de release (vacío hasta F02.7)
infra/                 OpenTofu (F26) y Kubernetes (F27)
docs/                  documentación que gobierna
scripts/               verificaciones y utilidades de desarrollo
_legacy-typescript-reference/   sistema de origen, solo consulta (no se despliega)
00–05-*.md             serie de documentos de producto, contexto y hoja de ruta
```

## Arranque rápido (lo que hoy funciona)
```bash
cp identity/.env.example identity/.env          # poner dos secretos distintos de ≥ 32 caracteres
cp api-gateway/.env.example api-gateway/.env
docker compose up --build                        # identity + api-gateway en http://localhost:8080

# N-DAT-02: el registro exige las aceptaciones de S-GEN-03 (una por finalidad, con la versión del texto)
curl -s -X POST localhost:8080/v1/auth/register -H 'Content-Type: application/json' -d '{
  "full_name":"Ana","email":"ana@example.com","password":"una-clave-muy-larga",
  "consents":[
    {"purpose":"AGE_CONFIRMATION","text_version":"2026-10-12","granted":true},
    {"purpose":"TERMS","text_version":"2026-10-12","granted":true},
    {"purpose":"PRIVACY_DATA_PROCESSING","text_version":"2026-10-12","granted":true},
    {"purpose":"MARKETING","text_version":"2026-10-12","granted":false}]}'
```
Verificaciones (CI las corre en cada PR):
```bash
./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check
(cd identity && go test -race ./...) && (cd api-gateway && go test -race ./...)
./scripts/e2e-identity-gateway.sh
(cd scripts/ledger-tests && npm install && npm test)   # especificación ejecutable del ledger
```
App: ver [`flutter_app/README.md`](flutter_app/README.md).
