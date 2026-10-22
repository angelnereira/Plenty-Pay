# Matriz fase × contenedor

● = la fase construye o cambia el contenedor. Una fase solo puede empezar cuando sus dependencias (05 §Resumen) están cerradas en `status.md`.

| Fase | idp | gw | ledger | pay | settle | fiscal | catalog | inv | orders | pos | logi | geo | payroll | notif | bi | security | infra | obs | pg | nosql | bus | s3 | web | app | proto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● |
| F02 | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |
| F03 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |
| F04 | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| F05 | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  | ● |  |
| F06 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  |
| F07 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  | ● | ● | ● |  |  |  |
| F08 | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F09 |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F10 |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| F11 |  | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F12 |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  | ● |  |
| F13 |  |  |  |  |  | ● |  |  | ● | ● |  |  |  |  |  | ● |  |  |  |  |  |  |  | ● |  |
| F14 |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F15 |  |  |  |  |  |  | ● |  | ● |  |  |  |  | ● |  |  |  |  |  |  |  |  |  | ● |  |
| F16 |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F17 |  | ● |  | ● |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F18 |  | ● |  |  |  |  |  |  | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |
| F19 |  |  |  | ● |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  | ● |  |
| F20 |  | ● |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  | ● |  |
| F21 |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  |  |  | ● |  |
| F22 |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |
| F23 | ● |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● | ● |  |
| F24 |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F25 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| F26 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F27 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● |
| F28 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| F29 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● |
| F30 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● |
| F31 |  | ● |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  | ● |  | ● |  |  | ● | ● |

Leyenda de columnas: `idp`=identity, `gw`=api-gateway, `ledger`=ledger, `pay`=payments-core, `settle`=settlement, `fiscal`=fiscal-invoicing, `catalog`=catalog, `inv`=inventory, `orders`=orders, `pos`=pos, `logi`=logistics, `geo`=geolocation, `payroll`=payroll, `notif`=notifications, `bi`=analytics-bi, `security`=security, `infra`=infra-management, `obs`=observability, `pg`=postgres-db, `nosql`=nosql-db, `bus`=event-bus, `s3`=object-storage, `web`=web, `app`=flutter_app, `proto`=network-contracts.

Cambios del 2026-10-21 ([plan de comercio](commerce-plan.md)): F13 toca pos y orders (factura pedida al vender, cierre de F13.5); F15 toca notifications (F15.13, aviso de pedido); F16 toca catalog (bandera de lote del producto, F16.4). F17 ya incluía payments-core (lealtad T8, F17.16–F17.17).

## Camino crítico
F01 → F02 → F04 → F05 → F06 → F07 → F08 → F09 → F10 → F11 → F13 → F15 → F16 → F17 → F22 → F23/F24 → F25; en paralelo desde F07: F26 → F27 → F28/F29 → F30.

## Paralelización segura
- F03 puede correr en paralelo a F02.
- F12, F13 y F14 pueden avanzar en paralelo tras F11 (F13 y F14 solo necesitan F05–F07).
- F18 y F19 en paralelo tras F14/F15.
- F20 puede empezar tras F09 (reglas de suscripción se agregan cuando existan los productores).
- F26 puede empezar en cuanto F07 esté cerrada.
