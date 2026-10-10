# ADR 0017 — Contenedor `orders` para el marketplace multi-comercio

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
El checkout del marketplace cruza catálogo, inventario, pagos con splits, logística y fiscal para **varios comercios** en una compra. Ponerlo en `pos` (orientado a caja de un comercio) o en `catalog` mezclaba responsabilidades.

## Decisión
1. Nuevo contenedor `orders` (Go, puerto 50075): Cart, Order, SubOrder (uno por comercio), SLA de aceptación de 15 min, reembolsos parciales automáticos ante rechazo.
2. Orquesta por gRPC (catalog, inventory, payments-core, logistics, fiscal-invoicing, identity); dueño de los eventos `OrderPaid` y `SubOrderStatusChanged`.
3. Aparece en Fase 15 junto con el marketplace.

## Consecuencias
+ POS se mantiene simple; el marketplace escala por separado.
− Un contenedor más (23 en total).

## Alternativas consideradas
Saga en payments-core (lo convertiría en orquestador de negocio); checkout en catalog.
