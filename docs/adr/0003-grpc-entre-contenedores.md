# ADR 0003 — Comunicación entre contenedores solo por gRPC

- **Estado**: Aceptada (enmendada por ADR 0015 para el cliente)
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Se necesitan contratos tipados, rápidos, con streaming y generación de código para Go y Rust.

## Decisión
1. Toda llamada síncrona entre contenedores es gRPC sobre HTTP/2 contra un `.proto` de `network-contracts/`.
2. Lo asíncrono va por eventos (ADR 0012), también definidos en `.proto`.
3. Nada de REST interno, ni acceso a la base de datos de otro contenedor.
4. El cliente Flutter **no** usa gRPC directo (ver ADR 0015).

## Consecuencias
+ Contratos versionados y verificables (`sync-protos.sh --check`).
− Depuración requiere herramientas (grpcurl, reflexión habilitada solo en local).

## Alternativas consideradas
REST/JSON interno (sin tipos fuertes, más lento); GraphQL federado (complejidad innecesaria).
