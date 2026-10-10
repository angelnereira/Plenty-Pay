# ADR 0008 — PostgreSQL como fuente de verdad + ScyllaDB para volumen y atributos variables

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Se pidió una BD SQL y una NoSQL. El dinero necesita transacciones ACID; algunos datos (atributos variables de catálogo, series de ubicación, eventos analíticos) crecen mucho y no requieren transacciones cruzadas.

## Decisión
1. **PostgreSQL 16** (`postgres-db`): esquema y rol por contenedor, RLS, fuente de verdad de todo lo transaccional.
2. **ScyllaDB** (`nosql-db`, compatible Cassandra, licencia OSS): atributos variables de producto, series de ubicación, eventos crudos de analítica.
3. No MongoDB: su licencia SSPL no es OSI.
4. Regla de decisión en `data-standards.md` §9; ninguna entidad con dos fuentes de verdad.

## Consecuencias
+ Escala horizontal para series y eventos sin presionar a PostgreSQL.
− Dos motores que operar; ScyllaDB se introduce en Fase 7 solo para quienes lo necesiten.

## Alternativas consideradas
Solo PostgreSQL (posible al inicio; particionado + réplicas); MongoDB (licencia); Cassandra (más pesado que Scylla).
