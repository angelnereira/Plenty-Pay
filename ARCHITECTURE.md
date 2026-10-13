# Arquitectura de PlentyPay

Vista de conjunto. El detalle normativo vive en los documentos enlazados; si algo aquí contradice a un ADR, SPEC o estándar, prevalecen ellos (ADR 0010).

## 1. Forma del sistema
```
 ┌──────────────────────── Cliente único Flutter (ADR 0009) ────────────────────────┐
 │  Android · iOS · Linux · Windows · macOS · Web — módulos según permisos (R10)   │
 └───────────────┬──────────────────────────────────────────────────┬───────────────┘
                 │ HTTPS/JSON + WebSocket /v1/realtime (ADR 0015)   │ páginas públicas, deep links
        ┌────────▼────────┐  webhooks de rieles / PAC / Jelou   ┌────▼────┐
        │   api-gateway   │◄────────────────────────────────────│   web   │
        └────────┬────────┘                                     └─────────┘
                 │ gRPC + mTLS SPIFFE, metadatos x-pp-* (ADR 0003, 0011)
 ┌───────────────┼──────────────────────────────────────────────────────────────────┐
 │ identity · catalog ⇄ inventory · orders · pos · logistics · geolocation · payroll │  Go
 │ fiscal-invoicing · notifications · analytics-bi · security · infra-management     │
 │ ───────────────────────────────────────────────────────────────────────────────── │
 │ payments-core ─► ledger ◄─ settlement                                             │  Rust (dinero)
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ outbox → eventos (ADR 0012)          observability ← métricas/logs/trazas de todos
 ┌───────────────▼──────────────────────────────────────────────────────────────────┐
 │ postgres-db (esquema por contenedor, RLS) · nosql-db (Scylla) · event-bus (NATS)  │
 │ object-storage (Garage S3)                                                        │
 └───────────────────────────────────────────────────────────────────────────────────┘
```
Matriz exacta de llamadas, puertos, capas de arranque y degradación: [`docs/architecture/service-dependencies.md`](docs/architecture/service-dependencies.md).

## 2. Inventario y estado real
✅ implementado y verificado · 📝 parcial · 📋 solo especificado. Evidencia en [`docs/roadmap/status.md`](docs/roadmap/status.md).

| Contenedor | Tecnología | Puerto | Estado | Fase |
|---|---|---|---|---|
| [identity](identity/SPEC.md) | Go | 50060 | 📝 núcleo de autenticación, permisos y consentimientos (memoria) | F08 |
| [api-gateway](api-gateway/SPEC.md) | Go | 8080 | 📝 rutas de autenticación (con consentimientos y `reason` estable) | F09 |
| [ledger](ledger/SPEC.md) | Rust | 50061 | 📋 (invariantes SQL de referencia verificadas: 27/27) | F10 |
| [payments-core](payments-core/SPEC.md) | Rust | 50062 | 📋 | F11 |
| [settlement](settlement/SPEC.md) | Rust | 50063 | 📋 | F12 |
| [fiscal-invoicing](fiscal-invoicing/SPEC.md) | Go | 50064 | 📋 | F13 |
| [catalog](catalog/SPEC.md) | Go | 50065 | 📋 | F15 |
| [inventory](inventory/SPEC.md) | Go | 50066 | 📋 | F16 |
| [pos](pos/SPEC.md) | Go | 50067 | 📋 | F17 |
| [logistics](logistics/SPEC.md) | Go | 50068 | 📋 | F18 |
| [geolocation](geolocation/SPEC.md) | Go | 50069 | 📋 | F14 |
| [payroll](payroll/SPEC.md) | Go | 50070 | 📋 | F19 |
| [notifications](notifications/SPEC.md) | Go | 50071 | 📋 | F20 |
| [analytics-bi](analytics-bi/SPEC.md) | Go | 50072 | 📋 | F21 |
| [security](security/SPEC.md) | Go + OpenBao | 50073 | ✅ secretos con ACL, transit, auditoría encadenada, bloqueos y OpenBao 2.2.0 operando en Docker Compose | F05 |
| [infra-management](infra-management/SPEC.md) | Go | 50074 | 📋 | F05 |
| [orders](orders/SPEC.md) | Go | 50075 | 📋 | F15 |
| [observability](observability/SPEC.md) | OSS | 4317/9090/3000 | ✅ pila completa operando en Docker (OTel, Prometheus, Loki, Tempo, Alloy, Alertmanager, Grafana con 7 dashboards) | F04 |
| [postgres-db](postgres-db/SPEC.md) | PostgreSQL 16 + PostGIS | 5432/6432 | 📋 | F06 |
| [nosql-db](nosql-db/SPEC.md) | ScyllaDB | 9042 | 📋 | F07 |
| [event-bus](event-bus/SPEC.md) | NATS JetStream | 4222 | 📋 | F07 |
| [object-storage](object-storage/SPEC.md) | Garage | 3900 | 📋 | F07 |
| [web](web/SPEC.md) | Go | 8081 | ✅ servidor estático del bundle Flutter Web verificado en Docker Compose | F02 |
| [flutter_app](flutter_app/README.md) (cliente) | Flutter | — | 📝 base multiplataforma con flavors e i18n, login y registro (compila web y Android) | F02 |
| [network-contracts](network-contracts/README.md) | Protobuf | — | ✅ 18 contratos compilan juntos | F03 |

## 3. Principios que no se negocian
1. **Una carpeta = un contenedor**, aislado; solo los contratos son compartidos (ADR 0002, 0004, 0016).
2. **El dinero es entero y de doble entrada**: solo `ledger` escribe asientos; solo `payments-core` habla con rieles; `UNKNOWN` nunca se trata como fallo ni como éxito (ADR 0005, 0013; dominio §5–§6).
3. **Tenant y actor salen del token validado**, nunca del cuerpo; RLS como segunda barrera (ADR 0011, 0014).
4. **Eventos por outbox**, consumidores idempotentes; el dinero nunca se mueve por eventos (ADR 0012).
5. **Una sola app** que se adapta a los permisos (ADR 0009).
6. **Agnóstico de proveedor**: todo OSS; nube intercambiable por módulo OpenTofu (ADR 0007).

## 4. Flujos clave (trazados por contenedor)
| Flujo | Recorrido |
|---|---|
| Login | app → gateway `/v1/auth/login` → identity.Login → tokens → `/v1/me/permissions` → módulos |
| Pago QR con wallet | app escanea `/t/<code>` → gateway → payments.ResolveTerminal → CreatePaymentIntent (step-up si ≥ umbral) → Confirm → ledger.CreateHold → CaptureHold (T3) → outbox `PaymentCaptured` → gateway WS `payment.status` → app; notifications envía recibo; settlement lo incluye en el próximo lote |
| Venta POS mixta | app POS → pos.CreateSale (precios de catalog) → pos.Checkout → por cada tender electrónico payments-core → `SalePaid` → inventory SALE → fiscal.IssueInvoice → recibo + customer display |
| Compra marketplace | app → orders.Checkout → inventory.ReserveStock ×N → payments.CreatePaymentIntent (splits) → `PaymentCaptured` → sub-pedidos por comercio → aceptación (15 min) → logistics → entrega → COMPLETED |
| Liquidación | settlement (cron) → ledger.GetBalance(MERCHANT_PAYABLE) → lote → banco → ConfirmPayout → ledger T6 → `BatchPaid` → notifications |
| Nómina | payroll marcajes (geolocation.IsInside) → corrida → aprobación con step-up → payments-core T10 por empleado → comprobantes |

## 5. Despliegue
- **Local / piloto**: Docker Compose en la raíz (redes edge/services/data; solo 8080 y 8081 publicados).
- **Producción**: Kubernetes híbrido — primario en servidores propios (k3s HA) y DR en una nube, ambos creados con los mismos módulos OpenTofu; GitOps con Argo CD; PostgreSQL con CloudNativePG (PITR, RPO ≤ 5 min, RTO ≤ 1 h). Detalle: [`docs/standards/delivery-pipeline.md`](docs/standards/delivery-pipeline.md) y documento 02.
- **Escala objetivo**: 500 000 usuarios diarios, picos de 2 000 pagos/s (F29): servicios sin estado con HPA, ledger particionado y con bloqueos por cuenta ordenados, lecturas pesadas en analytics-bi (proyecciones), series en Scylla.

## 6. Mapa de documentación
Ver la tabla de [`README.md`](README.md). Contexto histórico y regulatorio: documentos `01`–`04` (subordinados a los ADR).
