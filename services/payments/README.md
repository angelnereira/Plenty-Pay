# payments-service (orquestador de pagos)

Payment Intent → Payment → Attempt; idempotencia; rieles por adaptador (mandato §11, doc 03 §4). Contratos: `plentypay.payments.v1.PaymentOrchestratorService` + `plentypay.wallet.v1.WalletService` (ADR-0006).

**Estado: PLANNED (Etapa 2)**

| Pieza | Estado |
|---|---|
| Máquina de estados Charge (REQUIRES_ACTION/PROCESSING/SUCCEEDED/FAILED/**UNDETERMINED**/REVERSED) | TODO — el estado UNDETERMINED es obligatorio (doc 00 §3.2: nunca asumir el peor ni el mejor caso) |
| Rail `WALLET_INTERNAL` (transferencias internas) | TODO (Etapa 2) — primer riel sin regulatorio |
| Escritura al ledger SOLO vía contrato `ledger.v1` | TODO — prohibido tocar la BD del ledger (§3) |
| Adaptadores de riel (yappy/telered/cardnetwork) | TODO (Etapa 4) — gates `BLOCKED-UNVERIFIED` |
| Refunds | TODO (Etapa 3+; contrato ya publicado) |

Tecnología: **Rust + sqlx** (ADR-0010; doc 04 §7: camino crítico del dinero). Imagen base `distroless/scratch`.
