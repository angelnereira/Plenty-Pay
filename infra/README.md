# infra — infraestructura como código (no es un contenedor)

| Carpeta | Qué contiene | Fase | Estándar |
|---|---|---|---|
| `opentofu/` | Módulos `cluster-*` por proveedor con contrato común + módulo `platform` + entornos | F26 | `docs/standards/delivery-pipeline.md` §7, ADR 0007 |
| `kubernetes/` | Kustomize base por contenedor + overlays `staging`/`prod` consumidos por Argo CD | F27 | `delivery-pipeline.md` §6, ADR 0006 |

Estado: 📋 vacío a propósito. Los manifiestos y módulos de la versión anterior (monolito + servicios Node) están en `_legacy-typescript-reference/infra/` solo como referencia; **no** reflejan los 23 contenedores actuales.
