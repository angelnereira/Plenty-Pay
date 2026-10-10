# ADR 0010 — La documentación gobierna el código

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
El proyecto será construido en gran parte por agentes de código; sin una fuente de verdad escrita, cada agente re-decide arquitectura.

## Decisión
1. Orden de autoridad: ADR más reciente > `docs/domain/domain-model.md` > `docs/standards/*` > `SPEC.md` del contenedor > `README.md` del contenedor > documentos de la serie 00–04 > código.
2. Ningún cambio de comportamiento sin actualizar primero (o en el mismo cambio) el documento que lo define.
3. `AGENTS.md` define el ciclo de trabajo; `docs/roadmap/status.md` el estado real con evidencia.
4. `scripts/check-docs.sh` verifica en CI la estructura mínima (SPEC/README por contenedor, índice de ADR, enlaces internos).

## Consecuencias
+ Cualquier agente puede tomar un paso del roadmap sin contexto oral.
− Escribir documentación toma tiempo: es parte del DoD.

## Alternativas consideradas
Documentación generada desde el código (describe lo que hay, no lo que debe haber).
