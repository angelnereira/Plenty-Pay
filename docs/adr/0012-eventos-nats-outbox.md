# ADR 0012 — Eventos con NATS JetStream y outbox transaccional

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Varios contenedores reaccionan a hechos de otros (pago capturado → POS, pedidos, notificaciones, analítica). Publicar fuera de la transacción pierde o duplica eventos.

## Decisión
1. **NATS JetStream** (`event-bus`) como bus; streams `PP_<DOMINIO>`; subjects `pp.<dominio>.<entidad>.<hecho>.v<N>`.
2. Publicación **solo** por outbox en la misma transacción que el cambio; un relay publica y marca.
3. Consumidores idempotentes (`processed_events`).
4. **El dinero nunca se mueve por eventos**: asientos y cobros son gRPC síncronos con idempotencia; los eventos informan.
5. NATS KV para feature flags y contadores de rate limit (infra-management).

## Consecuencias
+ Desacople y entrega al menos una vez sin pérdidas.
− Consistencia eventual en proyecciones (analytics, notificaciones).

## Alternativas consideradas
Kafka/Redpanda (más pesado de operar; Redpanda BSL); RabbitMQ (menos adecuado para replay).
