# ADR 0015 — Flutter ↔ api-gateway por HTTPS/JSON y WebSocket

- **Estado**: Aceptada (enmienda ADR 0003)
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
gRPC directo desde Flutter Web exige gRPC-Web y proxys; webhooks de terceros llegan por HTTP; se necesita tiempo real.

## Decisión
1. El cliente habla solo con `api-gateway` por **HTTPS/JSON** (rutas `/v1/...`) y un **WebSocket** multiplexado `/v1/realtime`.
2. El gateway traduce a gRPC y publica su contrato en **OpenAPI** (`/v1/openapi.json`), generado desde la tabla de rutas del SPEC.
3. Errores JSON `{"error","reason"}` con `reason` estable (`grpc-conventions.md` §4).
4. Webhooks entrantes también terminan en el gateway.

## Consecuencias
+ Funciona igual en todas las plataformas Flutter, incluida Web; fácil de depurar.
− Doble modelo (JSON y proto): el gateway mantiene el mapeo y sus pruebas golden.

## Alternativas consideradas
gRPC-Web con Envoy (complejo en web y móvil); GraphQL (otra tecnología).
