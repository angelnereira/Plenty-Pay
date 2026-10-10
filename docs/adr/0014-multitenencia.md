# ADR 0014 — Multitenencia: esquema por contenedor, tenant_id + RLS

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Miles de comercios comparten la plataforma; una fuga entre comercios es inaceptable.

## Decisión
1. Una BD lógica compartida con **un esquema y un rol por contenedor** (un contenedor no puede leer el esquema de otro).
2. Toda tabla de negocio tiene `tenant_id` (o `party_id`) y **RLS forzado** con `current_setting('app.tenant_id', true)`.
3. Recursos de otro tenant responden `NOT_FOUND`.
4. El modelo de party (user / tenant / PLATFORM) del ledger permite cuentas de personas sin tenant.

## Consecuencias
+ Doble barrera (código + RLS).
− Consultas de plataforma (cross-tenant) requieren rol especial auditado.

## Alternativas consideradas
BD por tenant (inmanejable a miles de comercios); solo filtro en código (una omisión = fuga).
