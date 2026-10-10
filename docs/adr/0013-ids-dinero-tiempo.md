# ADR 0013 — UUIDv7, dinero entero, tiempo UTC y PostgreSQL ≥ 16

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Decisiones de datos transversales que no deben re-discutirse por contenedor.

## Decisión
1. IDs **UUIDv7** (ordenables por tiempo, buenos para índices) generados por el servicio dueño.
2. Dinero en **enteros de unidades menores** (`int64`), tasas en **bps**, redondeo **half-up** entero; nunca flotantes.
3. Timestamps en UTC (`timestamptz`); fechas de negocio en `America/Panama`.
4. PostgreSQL ≥ 16.

## Consecuencias
+ Sin errores de redondeo; orden temporal natural de ids.
− Conversión a decimal solo en presentación.

## Alternativas consideradas
`numeric` en BD con decimales en código (riesgo de flotantes en Dart/Go); ULID (menos soporte nativo).
