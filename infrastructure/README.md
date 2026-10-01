# infrastructure/

Infraestructura como código. Estado: **Etapa 5** (hoy el entorno vive en `deployment/compose`).

| Pieza | Estado |
|---|---|
| `deployment/compose` (entorno local/dev) | ACTIVO — Postgres + identity |
| `terraform/` (HCL, binario OpenTofu — ADR-0009) | TODO — módulos: network, compute, database, storage, security, observability, secrets, messaging |
| `kubernetes/` (manifiestos; Compose→K8s mapping doc 04 §5) | TODO |
| Registros/observabilidad self-hosted | TODO — Prometheus/Grafana/Loki/Tempo/GlitchTip (100% OSS) |

Reglas: portabilidad GCP/Azure/AWS/Railway/self-hosted; dependencia de proveedor ⇒ capa aislada identificada; cero secretos en Git.
