# ADR 0011 — Identidad de servicios, contexto de petición y step-up

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Un servicio interno comprometido o mal configurado no debe poder actuar como cualquier usuario ni cualquier tenant.

## Decisión
1. El gateway valida el token del usuario y establece metadatos `x-pp-*` (`grpc-conventions.md` §2). Los servicios toman tenant/actor **solo** de ahí.
2. Fase 5: mTLS con identidades SPIFFE (`spiffe://plentypay/<contenedor>`) emitidas por `security`; cada servidor acepta solo los llamadores de la matriz de `service-dependencies.md` §3 y solo acepta metadatos de usuario del gateway o de un servicio que los propaga.
3. Tokens de usuario: HS256 hoy, **EdDSA con JWKS** como objetivo (gateway valida localmente).
4. Step-up: token de un solo uso ligado a usuario+operación+monto, consumido atómicamente por el servicio que ejecuta (`ConsumeStepUp`).
5. Fail-closed: sin identidad válida → `UNAUTHENTICATED`.

## Consecuencias
+ Defensa en profundidad; auditoría precisa del actor.
− Gestión de certificados (rotación automática, TTL 24 h).

## Alternativas consideradas
Tokens de servicio estáticos (rotación difícil, robo fácil); service mesh completo (Istio) desde el inicio (complejidad; posible en Fase 27).
