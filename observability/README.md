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
| Configuración | ✅ F04.1–F04.5: `otel-collector.yaml` (OTLP 4317/4318, *tail sampling* 100 % errores/lentas + 10 % resto, exportadores a Tempo/Prometheus), `prometheus.yml` (scrape de `otel-collector:8889`, `identity:9100`, `api-gateway:9100`, `web:9100`), `loki.yaml`, `alloy.alloy`, `tempo.yaml`, `alertmanager.yml`, `alerts/services.yml` y 7 dashboards provisionados en `grafana/` | Verificado en Docker Compose (2026-10-13): todos los servicios `healthy`/`Up` |
| Pruebas L4 | ✅ F04.1–F04.5 verificados en caliente: Prometheus (4/4 targets `up`), Loki (búsqueda de `request_id` devuelve gateway e identity juntos), Tempo (traza distribuida W3C de 3 spans por login), Grafana (7 dashboards aprovisionados por código), Alertmanager (`amtool check-config` SUCCESS e inyección de alerta sintética recibida) | Verificado en local (2026-10-13) |
| Imágenes Docker | ✅ Imágenes fijadas por digest criptográfico en `SPEC.md` §2 y `docker-compose.yml` (OTel Collector 0.162.0, Prometheus 3.15.0, Loki 3.7.8, Tempo 3.0.0, Alloy 1.20.1, Alertmanager 0.28.0, Grafana 11.5.2) | `docker ps` todos arriba |

## Arranque local
```bash
docker compose up -d    # levanta los servicios propios y la pila de observabilidad
```

Puertos accesibles en desarrollo:
- `http://localhost:8080`: api-gateway
- `http://localhost:8081`: web (Flutter Web)
- `http://localhost:3000`: Grafana (usuario `admin`, contraseña `admin`), con los 7 dashboards aprovisionados
- Puertos internos de observabilidad en la red `services`: Prometheus (`:9090`), Alertmanager (`:9093`), Loki (`:3100`), Tempo (`:3200`), OTel Collector (`:4317`, `:4318`, `:8889`, `:13133`).

El E2E de contratos y telemetría se ejecuta con:
```bash
./scripts/e2e-identity-gateway.sh
```

