# observability

Métricas, logs, trazas, alertas y dashboards como código. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | OSS (OTel, Prometheus, Loki, Tempo, Grafana) |
| Puerto | 4317/9090/3000 (admin `:9100` en servicios propios) |
| Fase del roadmap | F04 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 F04.1: `otel-collector.yaml` (OTLP 4317/4318, *tail sampling* 100 % errores/lentas + 10 % resto, exportadores a Tempo/Loki/Prometheusítica), `prometheus.yml` (scrape de `identity:9100`, `api-gateway:9100`, `web:9100` + plantilla para las fases siguientes) y 7 reglas de alerta en `alerts/services.yml` con `runbook_url` | YAML validado; verificado contra los `/metrics` reales: las series que citan las alertas existen (E2E 35/35) |
| Pruebas | Las comprobaciones del E2E `scripts/e2e-identity-gateway.sh` (35) incluyen ahora la existencia de `pp_logins_total`, `pp_rpc_server_requests_total` y el histograma `pp_rpc_server_duration_seconds`, y que ninguna métrica use etiquetas prohibidas | 2026-10-13 |
| Imagen Docker | 📋 `otel-collector` y `prometheus` en `docker-compose.yml` con `image: ...:latest` — **la versión exacta se fija al cerrar F04** (SPEC §2) y las imágenes no se construyeron ni se levantaron | — |

## Arranque local
```bash
docker compose up --build otel-collector prometheus   # scrape en :9090
```
El E2E sigue siendo la referencia de qué métricas debe haber: `./scripts/e2e-identity-gateway.sh`.

## Limitaciones conocidas
No ejecutado con el stack arriba (sin daemon de Docker en el entorno donde se escribió):
- **F04.1**: "métricas de identity visibles" en Prometheus no se comprobó.
- Pendiente de F04.2–F04.5: Loki + recolector de logs, Tempo, Grafana con los 7 dashboards y
  Alertmanager con las rutas (el pipeline de métricas ya está listo para ellos).
- `amtool` y la prueba sintética por alerta (SPEC R4) no ejecutadas.
- Las versiones de las imágenes quedan en `latest` a propósito: fijarlas es parte del cierre.
