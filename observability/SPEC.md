# SPEC — observability

## 1. Responsabilidad
Pila OSS de métricas, logs, trazas, alertas y dashboards para todos los contenedores. Implementa `docs/standards/observability-standards.md`. No contiene código propio salvo configuración como código.

## 2. Ficha
| Proceso | Imagen (fijar versión exacta en F04) | Puerto (solo red interna) |
|---|---|---|
| OpenTelemetry Collector (contrib) | `otel/opentelemetry-collector-contrib` | 4317 OTLP gRPC, 4318 OTLP HTTP |
| Prometheus | `prom/prometheus` | 9090 |
| Alertmanager | `prom/alertmanager` | 9093 |
| Loki | `grafana/loki` | 3100 |
| Promtail o Alloy (recolector de logs Docker) | `grafana/alloy` | — |
| Tempo | `grafana/tempo` | 3200 |
| Grafana | `grafana/grafana-oss` | 3000 (publicado solo en `127.0.0.1` y perfil `observability`) |
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
