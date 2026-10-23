# Ola 6 · Fidelización y crédito de la casa

**Qué cierra**: el comercio vende a crédito a clientes conocidos y lleva un programa de puntos, todo como memo-asientos del ledger (nunca saldos editables). Además, el pago de nómina (T10) completa la salida del dinero del comercio hacia su gente. Etapa M2 ([`../lifecycles.md`](../lifecycles.md)). Procedimiento común: [`README.md`](README.md) §2.

**Corrección previa obligatoria (contrato)**: en `network-contracts/proto/payments.proto`, el comentario de `PostMemoEntryRequest.kind` dice `"HOUSE_CREDIT" (T8) | "POINTS" (T9)`, pero `docs/domain/domain-model.md` §5.2 define **T8 = puntos de lealtad** y **T9 = venta a crédito** (T9b = abono). Manda `domain-model.md` (AGENTS §1): corrige el comentario (solo el comentario; los valores `HOUSE_CREDIT`/`POINTS` no cambian) en el primer cambio de esta ola. Además el mensaje lleva `tenant_id` en el cuerpo: según ADR 0011 el tenant sale de los metadatos; el pendiente ya está anotado en `status.md` («derivar de metadatos los `tenant_id` … F05/F08»). Implementa `PostMemoEntry` tomando el tenant de `x-pp-tenant-id` y rechazando un cuerpo que lo contradiga.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F17.6](#f176--crédito-de-la-casa-y-puntos-postmemoentry) Crédito de la casa y puntos (`PostMemoEntry`) | payments-core, ledger, pos | L4 | F17.11 | — |
| 2 | [F17.15](#f1715--programa-de-lealtad-reglas) Programa de lealtad: reglas | pos, identity | L2 | F17.11 | activación ⛔ Q-45 |
| 3 | [F17.16](#f1716--acumulación-y-reversión-de-puntos) Acumulación y reversión | pos, payments-core | L4 | F17.6, F17.15 | Q-45 |
| 4 | [F17.17](#f1717--canje-de-puntos-en-el-cobro) Canje en el cobro | pos, payments-core, app | L4 | F17.16 | Q-45 (ITBMS del canje) |
| 5 | [F19.6](#f196--pago-de-nómina-t10) Pago de nómina (T10) | payroll, payments-core | L4 | F19.1–F19.5 | valores legales Q-13 |
| — | F17.18 Cupones y tarjetas de regalo · F17.19 Propinas | — | — | — | ⛔ Q-48 · Q-21: no se implementan |

---

### F17.6 · Crédito de la casa y puntos (`PostMemoEntry`)
Nivel L4 · Estado 📋 (reabierto: esbozo de dominio sin servicio).
- **Leer antes**: `domain-model.md` §5.1 (cuentas `LOYALTY_POINTS`, `CUSTOMER_CREDIT`: memo, el emisor/acreedor puede ser negativo) y §5.2 (T8, T9, T9b); `payments-core/src/grpc/service.rs` (`post_memo_entry` hoy sin implementar); `ledger` (plantillas permitidas).
- **Resultado observable**: pos registra una venta a crédito de 20.00 a un cliente identificado (T9) y un abono de 5.00 (T9b); el saldo de crédito del cliente con ese comercio es 15.00 y el extracto muestra los dos asientos. Puntos (T8) se acreditan igual (los usa F17.16).
- **Contrato**: el comentario corregido (arriba). Si hace falta el abono como operación distinta, `kind` admite `HOUSE_CREDIT_PAYMENT` (T9b): agregar el valor al comentario y al glosario.
- **Código**: payments-core valida `kind`, monto > 0, moneda ISO 4217 para crédito (puntos en `PTS`), tenant de metadatos; arma el asiento con la plantilla correcta y clave `credit:<sale>` / `creditpay:<id>` / `loyalty:<sale>`; ledger ya acepta las plantillas (verificar T8/T9/T9b en `ledger/src/domain`). pos: medio de pago «Crédito de la casa» en el cobro (S-POS-03, actualizar ficha) con límite por cliente (configuración de F17.11, valor del comercio, no legal).
- **Pruebas**: Rust `f17_6_t9_credit_sale_is_balanced`, `f17_6_t9b_payment_reduces_credit`, `f17_6_same_key_same_entry`, `f17_6_tenant_from_metadata_wins`; L2 pos `TestL2_F17_6_CreditTenderPostsT9Once`.
- **Terminado cuando**: «T8/T9 balanceados» (05) con L4 de una venta a crédito y su abono.

### F17.15 · Programa de lealtad: reglas
Ficha de diseño: [commerce-plan F17.15](../commerce-plan.md#f1715--programa-de-lealtad-reglas) · Nivel L2 · Estado 📋.
- **Bloqueo**: la **activación** espera Q-45 (caducidad, valor contable, ITBMS del canje). El mecanismo se construye desactivado por defecto; ninguna pantalla lo ofrece como activo hasta resolver Q-45.
- **Datos**: pos `loyalty_programs(tenant_id, version, rules jsonb, active, created_by, created_at)` con versión nueva por cambio.
- **Permisos nuevos**: `loyalty:read`, `loyalty:manage` (🔒) en `identity/internal/auth/permissions.go` y el glosario, en el mismo cambio.
- **Pruebas**: L2 `TestF17_15_ProgramOffByDefault`, `TestF17_15_ChangeCreatesNewVersion`.
- **Terminado cuando**: «Programa desactivado por defecto; versión en cada asiento» (05).

### F17.16 · Acumulación y reversión de puntos
Ficha de diseño: [commerce-plan F17.16](../commerce-plan.md#f1716--acumulación-y-reversión-de-puntos) · Nivel L4 · Estado 📋.
- **Código**: `loyalty_tasks` en pos (nace con el pago o la devolución en la misma transacción) → `PostMemoEntry` T8 `loyalty:<sale>`; reversión proporcional `loyalty-rev:<refund>`; base = total pagado sin impuestos ni líneas excluidas, `floor`.
- **Pruebas**: L2 `TestL2_F17_16_PointsBalanceEqualsSumOfEntries`, `TestL2_F17_16_RefundRevertsProportionally`.
- **Terminado cuando**: «Saldo de puntos = Σ asientos» (05).

### F17.17 · Canje de puntos en el cobro
Ficha de diseño: [commerce-plan F17.17](../commerce-plan.md#f1717--canje-de-puntos-en-el-cobro) · Nivel L4 · Estado 📋.
- **Contrato**: riel/medio de puntos en `Tender` (aditivo; verificar `PaymentRail` en `common.proto`).
- **Pruebas**: L2 `TestF17_17_InsufficientPoints`, `TestF17_17_NeverNegativeUnderConcurrency`.
- **Terminado cuando**: «`INSUFFICIENT_POINTS`; nunca saldo negativo» (05).

### F19.6 · Pago de nómina (T10)
Nivel L4 · Estado: ver `status.md` F19 · **Bloqueo**: los valores legales de la nómina (cuotas, ISR, recargos) esperan Q-13 y se leen de `legal.pa.*`; F19.5 (cálculo) debe estar cerrado.
- **Resultado observable**: el comercio aprueba la corrida (con control de que quien prepara no aprueba su propia corrida, `CANNOT_APPROVE_OWN_RUN`) y cada empleado recibe en su billetera su neto: asiento T10 `payroll:<run>:<employee>` desde la billetera del comercio, una vez aunque se reintente.
- **Pruebas**: L2 cruzado payroll + payments-core + ledger `f19_6_each_employee_paid_once`, `f19_6_insufficient_merchant_wallet_fails_whole_run_or_per_employee` (decide según el SPEC de payroll R6).
- **Terminado cuando**: «R6» (05).
