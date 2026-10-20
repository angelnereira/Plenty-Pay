# orders

Carrito y pedidos del marketplace multi-comercio: un cobro con un split por comercio y un sub-pedido por comercio. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go 1.26 |
| Puerto | gRPC `50075`, administración `9100` (`/healthz`, `/readyz`, `/metrics`) |
| Fase del roadmap | F15 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio: estados §8.10, transiciones, estado del pedido derivado de los sub-pedidos (R8), límites del carrito | ✅ L1 | `internal/domain` |
| Carrito con instantánea de precio y nombre; cotización con totales del servidor (F15.7) | ✅ L2 | `TestSPEC4_CartLimitOfTenMerchants` (`CART_LIMIT`) |
| Checkout saga (R3): recotiza → pedido y sub-pedidos en una transacción → reserva por comercio → UN cobro con splits; reanudable con la misma clave | ✅ L2 | `TestSPEC11_1_TwoMerchantsOnePaymentWithSplits`, `TestSPEC11_4_SameKeyIsOneOrder`, `TestR3_PriceChangeBlocksCheckoutWithoutSideEffects`, `TestR3_OutOfStockCancelsAndReleasesEarlierReservations`, `TestR5_StepUpRetryResumesTheSameOrder` |
| Consumidor `orders-payments` (ack tras el efecto, `processed_events`): cobro → PAID, plazo de aceptación, confirmación de reservas y carrito vaciado en la misma transacción; fallo → cancelación y liberación | ✅ L2 | `TestSPEC11_3_FailedPaymentReleasesReservations`, `TestR3_CapturedPaymentEmptiesPurchasedCartItems`, `TestIntegrity_LatePaymentOnCancelledOrderIsRefunded` |
| Aceptación con plazo (`ACCEPT_SLA`, 5–60 min), rechazo y vencimiento con reembolso solo de ese split y devolución de existencias (R4, R5), código de retiro (R6), cancelación del comprador (R9) | ✅ L2 | `TestSPEC11_2_TimeoutRejectsAndRefundsOnlyThatSplit`, `TestR9_BuyerCancelsBeforeAcceptanceOnly`, `TestSagaTasks_RefundRetriesUntilMerchantHasBalance` |
| RLS por comprador y por comercio; rol del servicio sin DELETE | ✅ L2 | `TestRLS_BuyersAndMerchantsSeeOnlyTheirs`, `TestPrivileges_ServiceRoleCannotDeleteOrders` |
| Pruebas L2 | ✅ 14/14 | `./orders/test/test_l2.sh` contra base efímera, 2026-10-20 |
| Entrega a domicilio (R6 con logistics), factura (R7), consumidores de logistics y fiscal (R10) | 📋 | sin servicio de logistics (F18) ni fiscal-invoicing (F13): `fulfillment = DELIVERY` responde `DELIVERY_UNAVAILABLE` |
| Observabilidad | ◐ | interceptor con request_id, pánico y defecto sin fuga; `pp_rpc_*`, `pp_outbox_*`, `pp_orders_saga_tasks_*`, `pp_orders_payment_events_total`, `pp_sub_orders_auto_rejected_total`. **Faltan** `pp_orders_total{status}`, `pp_checkout_duration_seconds` y `pp_checkout_failures_total{reason}` del SPEC §9 |
| Imagen Docker | ✅ | distroless `static-debian12:nonroot` |
| Despliegue en producción | ⏳ | requiere quitar las tablas de esbozo vacías: `bash ~/plentypay-backups/stubs-reset.sh` (respalda antes, migra y levanta) |

## Pruebas
```bash
cd orders && go vet ./... && go test -race ./...   # L1
./orders/test/test_l2.sh                           # desde la raíz: L2 en una base efímera que se borra al terminar
```

## Arranque
```bash
docker compose build orders
docker compose run --rm --no-deps orders migrate   # migrator_orders, conexión directa
docker compose up -d --no-deps orders              # nunca reinicia tunnel
```

## Limitaciones conocidas
- Solo retiro en tienda y saldo PlentyPay: la entrega a domicilio llega con logistics (F18) y los demás rieles con sus adaptadores.
- El estado del pedido le llega a la app por sondeo (cada 4 s el comprador, cada 15 s el comercio); el aviso en vivo por WebSocket llega con notifications (F20).
- El plazo de aceptación es uno para todo el servicio (`ACCEPT_SLA`); por comercio llega con su configuración en infra-management.
- Falta la prueba L4 de compra multi-comercio con la app (F15.10).
