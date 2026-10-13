# SPEC — observability

## 1. Responsabilidad
Pila OSS de métricas, logs, trazas, alertas y dashboards para todos los contenedores. Implementa `docs/standards/observability-standards.md`. No contiene código propio salvo configuración como código.

## 2. Ficha
| Proceso | Imagen fija (digest) | Versión | Puerto (solo red interna) |
|---|---|---|---|
| OpenTelemetry Collector (contrib) | `otel/opentelemetry-collector-contrib@sha256:39923a8e431bd1f57be82411999d389fcfe40857492e4365456d97a4c1f74be6` | 0.162.0 | 4317 OTLP gRPC, 4318 OTLP HTTP, 8889 Prometheus |
| Prometheus | `prom/prometheus@sha256:efd719c99d83b060d9daefdcf00360461adf279f45ef5391f8d111892118753e` | 3.15.0 | 9090 |
| Alertmanager | `prom/alertmanager@sha256:d5155cfac40a6d9250ffc97c19db2c5e190c7bc57c6b67125c94903358f8c7d8` | 0.28.0 | 9093 |
| Loki | `grafana/loki@sha256:1107dd5274e0ada47e42472b7a7e71f3b2a2fe878878108f3e2f9e51528f0193` | 3.7.8 | 3100 |
| Alloy (recolector de logs Docker) | `grafana/alloy@sha256:2aa2099af76c0098d4af7a4d6e48f86cb66dc1a000222ad927a1c67c6542d13f` | 1.20.1 | — |
| Tempo | `grafana/tempo@sha256:1ce31d6d7ffab62189685e8c47881d4a561c5d38bd0dbd66e40ca83cef07923d` | 3.0.0 | 3200 |
| Grafana | `grafana/grafana-oss@sha256:163be84f32fdf9d204c6b8b2f2cccb04628baa365cf973eb1c32d1faaa8fbfc3` | 11.5.2 | 3000 (publicado en `127.0.0.1:3000`) |
Fase F04 · Capa L0 · Licencias: Apache 2.0 / AGPLv3 (Grafana, Loki, Tempo — uso interno sin modificación; aceptado en ADR 0001 como plataforma OSS).

## 3. Estructura de la carpeta
```
observability/
├── SPEC.md · README.md · .env.example
├── otel-collector.yaml        # receptores OTLP, tail sampling (100 % errores/lentas, 10 % resto), exportadores
├── prometheus.yml             # scrape de <servicio>:9100 de la lista de service-dependencies.md
├── alerts/*.yml               # reglas de observability-standards.md §6, con runbook_url
├── alertmanager.yml           # rutas: crítico → página (webhook a notifications o canal on-call), warning → ticket
├── loki.yaml · tempo.yaml
└── grafana/provisioning/{datasources,dashboards}/ + dashboards/*.json   # 7 dashboards de §7
```

## 4. Reglas
- **R1** Todo dashboard y alerta es archivo versionado; nada creado a mano en la UI de producción.
- **R2** Retención: Prometheus 15 días local (+ remote write opcional), Loki 30 días, Tempo 7 días.
- **R3** Grafana con SSO/OIDC de identity en F28; hasta entonces usuario admin con contraseña de `.env` y solo localhost.
- **R4** Alertas críticas probadas con `amtool` y una prueba sintética por alerta (inyección) antes de cerrar F04/F30.

## 5. Plan
F04.1 collector + Prometheus → F04.2 Loki + recolector → F04.3 Tempo → F04.4 Grafana + dashboards → F04.5 Alertmanager + reglas → F04.6 instrumentación de identity y gateway como referencia.
