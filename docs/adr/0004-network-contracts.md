# ADR 0004 — network-contracts como única fuente de contratos

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Los contratos deben ser compartidos sin compartir código.

## Decisión
1. `network-contracts/proto/*.proto` es la fuente de verdad (paquetes `plentypay.<dominio>.v1`).
2. `consumers.txt` declara qué contenedor consume qué `.proto`; `sync-protos.sh` genera Go en `internal/pb` y copia `.proto` a `proto/` para Rust (compilados por `build.rs` local).
3. Lo generado **se versiona** dentro de cada contenedor (build reproducible sin acceso a `network-contracts`).
4. Cambios solo aditivos; incompatible = paquete `v2` (ver `grpc-conventions.md` §1, §6).

## Consecuencias
+ Cada contenedor compila solo.
− Hay que correr `sync-protos.sh` tras cada cambio (CI lo verifica).

## Alternativas consideradas
Paquete de contratos publicado en un registro (buf.build, crates privados): dependencia externa adicional; posible en el futuro.
