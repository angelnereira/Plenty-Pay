# ADR 0002 — Una carpeta raíz = una unidad de despliegue aislada

- **Estado**: Aceptada (enmendada por ADR 0016)
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Se exige poder quitar o reemplazar cualquier módulo borrando su carpeta, sin romper la compilación de los demás, y escalar cada uno por separado.

## Decisión
1. Cada carpeta de la raíz que no esté en la lista de no-contenedores es una unidad de despliegue con su propio `Dockerfile`, manifiesto de dependencias (`go.mod`/`Cargo.toml`), `.env.example`, `README.md` y `SPEC.md`.
2. **Ninguna** importa código de otra. Lo único compartido es `network-contracts/` (contratos `.proto`), que se **copia/genera** dentro de cada contenedor con `scripts/sync-protos.sh` (no se referencia en build).
3. Carpetas que **no** son contenedores: `docs/`, `scripts/`, `network-contracts/`, `infra/` (IaC), `flutter_app/` (cliente; sus builds van a `output/`), `output/`, `_legacy-typescript-reference/`.
4. `scripts/check-isolation.sh` lo hace cumplir en CI.

## Consecuencias
+ Quitar un módulo = borrar su carpeta + su bloque en compose + su fila en `consumers.txt`; los demás degradan según `service-dependencies.md` §6.
+ Cada equipo/agente trabaja en una carpeta sin conflictos.
− Código repetido (logger, interceptores) en cada contenedor: aceptado; se mantiene una plantilla en `docs/standards`.

## Alternativas consideradas
Monorepo con librerías compartidas (`pkg/`): acopla versiones y rompe el "borrar carpeta = quitar módulo".
