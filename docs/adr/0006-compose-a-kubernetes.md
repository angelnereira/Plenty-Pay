# ADR 0006 — Docker Compose primero, Kubernetes después

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Se necesita velocidad en el desarrollo inicial sin cerrar la puerta a la escala horizontal.

## Decisión
1. Fases 1–26: `docker-compose.yml` en la raíz es el entorno local y de staging inicial.
2. Fase 27: manifiestos Kubernetes (Kustomize) por contenedor + Argo CD; operadores para datos (CloudNativePG, Scylla Operator, NATS).
3. Las reglas de Compose (`delivery-pipeline.md` §5) están diseñadas para trasladarse 1:1 (healthchecks en `:9100`, sin estado local, config por env, redes por capa).

## Consecuencias
+ Arranque simple; mismo binario en ambos mundos.
− Compose no da alta disponibilidad: no se usa en producción con clientes reales más allá de un piloto controlado.

## Alternativas consideradas
Kubernetes desde el día 1 (lento para iterar); Nomad (menor ecosistema).
