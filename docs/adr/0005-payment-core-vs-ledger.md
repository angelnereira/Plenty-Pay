# ADR 0005 — Separar Payment Core del Ledger

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Mezclar la orquestación con rieles (inestable, lenta, con estados ambiguos) con el libro contable (estricto, inmutable) produce asientos a medias y dobles cobros.

## Decisión
1. `payments-core` modela PaymentIntent → Payment → PaymentAttempt, habla con rieles, calcula comisiones y maneja UNKNOWN.
2. `ledger` solo sabe de cuentas, asientos de doble entrada (DEBIT/CREDIT, montos positivos), holds y saldos; no conoce rieles.
3. La captura se asienta por gRPC con clave idempotente determinista `pay:<payment_id>` (exactly-once por índice único).
4. `settlement` es un tercer contexto: liquidación y conciliación no son estados de un pago.

## Consecuencias
+ El ledger puede probarse exhaustivamente (invariantes I1–I7).
+ Un riel nuevo no toca el ledger.
− Existe la ventana CAPTURED-sin-asiento: cubierta por worker + alerta (`domain-model.md` §6.2).

## Alternativas consideradas
Ledger dentro de payments (acoplamiento); asientos por eventos asíncronos (se pierde la confirmación síncrona).
