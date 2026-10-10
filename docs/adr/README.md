# Registro de decisiones de arquitectura (ADR)

Una decisión = un archivo `NNNN-titulo.md` (plantilla: `docs/templates/ADR-TEMPLATE.md`). Un ADR aceptado no se edita: se **reemplaza o enmienda** con uno nuevo que lo referencia. El ADR más reciente prevalece (ADR 0010).

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-tres-tecnologias.md) | Solo tres tecnologías: Rust, Go y Flutter | Aceptada |
| [0002](0002-una-carpeta-un-contenedor.md) | Una carpeta raíz = una unidad de despliegue aislada | Aceptada (enmendada por ADR 0016) |
| [0003](0003-grpc-entre-contenedores.md) | Comunicación entre contenedores solo por gRPC | Aceptada (enmendada por ADR 0015 para el cliente) |
| [0004](0004-network-contracts.md) | network-contracts como única fuente de contratos | Aceptada |
| [0005](0005-payment-core-vs-ledger.md) | Separar Payment Core del Ledger | Aceptada |
| [0006](0006-compose-a-kubernetes.md) | Docker Compose primero, Kubernetes después | Aceptada |
| [0007](0007-opentofu-multiproveedor.md) | OpenTofu con módulos intercambiables por proveedor | Aceptada |
| [0008](0008-sql-y-nosql.md) | PostgreSQL como fuente de verdad + ScyllaDB para volumen y atributos variables | Aceptada |
| [0009](0009-flutter-cliente-unico.md) | Una sola app Flutter con navegación dinámica por permisos | Aceptada |
| [0010](0010-documentacion-gobierna.md) | La documentación gobierna el código | Aceptada |
| [0011](0011-autenticacion-entre-servicios.md) | Identidad de servicios, contexto de petición y step-up | Aceptada |
| [0012](0012-eventos-nats-outbox.md) | Eventos con NATS JetStream y outbox transaccional | Aceptada |
| [0013](0013-ids-dinero-tiempo.md) | UUIDv7, dinero entero, tiempo UTC y PostgreSQL ≥ 16 | Aceptada |
| [0014](0014-multitenencia.md) | Multitenencia: esquema por contenedor, tenant_id + RLS | Aceptada |
| [0015](0015-cliente-https-json-websocket.md) | Flutter ↔ api-gateway por HTTPS/JSON y WebSocket | Aceptada (enmienda ADR 0003) |
| [0016](0016-unidades-de-despliegue.md) | Unidades de despliegue con procesos de respaldo y carpetas no-contenedor | Aceptada (enmienda ADR 0002) |
| [0017](0017-contenedor-orders.md) | Contenedor `orders` para el marketplace multi-comercio | Aceptada |
