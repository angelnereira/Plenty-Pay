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
| Código | 📝 F04.1–F04.3: `otel-collector.yaml` (OTLP 4317/4318, *tail sampling* 100 % errores/lentas + 10 % resto, exportadores a Tempo/Loki/Prometheus), `prometheus.yml` (scrape de `identity:9100`, `api-gateway:9100`, `web:9100` + plantilla para las fases siguientes), `loki.yaml`, `tempo.yaml`, `alloy.alloy` y 7 reglas de alerta en `alerts/services.yml` con `runbook_url` | YAML validado; las series que citan las alertas existen en los `/metrics` reales (E2E 35/35) |
| Pruebas | Las comprobaciones del E2E `scripts/e2e-identity-gateway.sh` (35) incluyen la existencia de `pp_logins_total`, `pp_rpc_server_requests_total` y el histograma `pp_rpc_server_duration_seconds`, y que ninguna métrica use etiquetas prohibidas | 2026-10-13 |
| Imagen Docker | 📋 `otel-collector`, `prometheus`, `loki`, `tempo` y `alloy` en `docker-compose.yml` con `image: ...:latest` — **la versión exacta se fija al cerrar F04** (SPEC §2); ninguna imagen se construyó ni se levantó | — |

## Arranque local
```bash
docker compose up --build otel-collector prometheus loki tempo alloy   # métricas en :9090
```
El E2E sigue siendo la referencia de qué métricas debe haber: `./scripts/e2e-identity-gateway.sh`.

## Limitaciones conocidas
No ejecutado con el stack arriba (sin daemon de Docker en el entorno donde se escribió):
- **F04.1**: "métricas de identity visibles" en Prometheus no se comprobó.
- **F04.2**: la búsqueda por `request_id` en Loki y la prueba de que Alloy recoge los registros de
  gateway e identity no se ejecutaron.
- **F04.3**: la traza con 2 span por login no se vio en la UI de Tempo; la propagación
  `traceparent` sí está verificada (mismo `trace_id` y `request_id` en ambos servicios).
- Pendiente de F04.4/F04.5: Grafana con los 7 dashboards y Alertmanager con sus rutas
  (crítico → página, advertencia → ticket).
- `amtool` y la prueba sintética por alerta (SPEC R4) no ejecutadas.
- Las versiones de las imágenes quedan en `latest` a propósito: fijarlas es parte del cierre de F04.
