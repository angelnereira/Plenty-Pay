# Ola 3 · El dinero sale hacia el comercio

**Qué cierra**: lo que el comercio cobró se le paga, lo que el riel depositó se concilia contra lo cobrado, y el libro contable se vigila solo. Etapas: M1, M4, M5, M6, M9 ([`../lifecycles.md`](../lifecycles.md)). Contenedores Rust (ledger, settlement) y payments-core: procedimiento común en [`README.md`](README.md) §2 con los comandos Rust.

Todos están **desplegados** (ledger, payments-core y settlement «healthy» el 2026-10-23); notas de `status.md` del 2026-10-20 que dicen «ledger no desplegado» ya no aplican: verifica con `docker compose ps`.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F10.6](#f106--outbox-y-eventos-del-ledger-en-vivo) Outbox y eventos del ledger en vivo | ledger | L2 | — | — |
| 2 | [F10.7](#f107--job-i7-alertas-y-observabilidad) Job I7, alertas y observabilidad | ledger, observability | L4 | F10.6 | — |
| 3 | [F12.5](#f125--importación-de-extractos) Importación de extractos | settlement, object-storage | L2 | — | formato real del riel ⛔ Q-02 (CSV genérico mientras tanto) |
| 4 | [F12.6](#f126--conciliación-t5-y-excepciones) Conciliación, T5 y excepciones | settlement, ledger | L4 | F12.5 | — |
| 5 | [F12.4](#f124--pago-al-comercio-cierre) Pago al comercio (cierre) | settlement | L4 | — | banco real ⛔ Q-10 |
| 6 | [F12.7](#f127--jobs-alertas-y-feriados) Jobs, alertas y feriados | settlement, infra-management, observability | L4 | F12.6 | — |
| 7 | [F12.8](#f128--consola-de-conciliación-y-finanzas) Consola de conciliación y finanzas | flutter_app | L4 | F12.6 | — |
| 8 | [F10.8](#f108--carga-básica-del-ledger) Carga básica del ledger | ledger | L5 | F10.7 | k6 instalado |

---

### F10.6 · Outbox y eventos del ledger en vivo
Nivel L2 · Estado 📝 (asiento + outbox en la misma transacción ✅ L2; relay con `Nats-Msg-Id`).
- **Qué falta**: publicar en el stream `PP_LEDGER` en vivo y demostrar «exactamente una vez» con un consumidor de prueba. El 2026-10-20 había 6 252 filas sin publicar: antes de nada, mide el atraso: `docker compose exec -T postgres-db psql -U postgres -d plentypay -At -c "SELECT count(*) FROM ledger.outbox WHERE published_at IS NULL"`.
- **Código**: `ledger/src/events/mod.rs` (relay): si hay atraso, publica por lotes con `Nats-Msg-Id = event_id` (la deduplicación de JetStream evita duplicados al reintentar); métrica `pp_outbox_pending{service="ledger"}` y `pp_outbox_oldest_age_seconds`.
- **Pruebas**: L2 `r12_transaction_posted_exactly_once_per_transaction` (consumidor de prueba cuenta mensajes por `transaction_id` tras reiniciar el relay a mitad).
- **L4 operativo**: tras desplegar, el atraso llega a 0 y se mantiene; settlement (consumidor) procesa sin duplicar (`processed_events`).
- **Trampas conocidas**: no borres filas de outbox para «limpiar» el atraso: publícalas.
- **Terminado cuando**: «TransactionPosted exactamente una vez por transacción (consumidor de prueba)» (05) y atraso 0 en producción.

### F10.7 · Job I7, alertas y observabilidad
Nivel L4 · Estado 📝 (job horario y métricas con L2).
- **Qué falta**: regla de alerta en Prometheus/Alertmanager, trazas OTel, `request_id` en respuestas INTERNAL, captura de pánico (fila Observabilidad del README del ledger).
- **Código**: regla en `observability/prometheus/rules/*.yml` (verificar la carpeta real): `pp_ledger_invariant_violations_total > 0` → crítica; `pp_ledger_job_failures_total` creciente → advertencia. Interceptor tonic con `request_id` y captura de pánico (`std::panic::catch_unwind` alrededor del handler o capa tower), siguiendo `rust-standards.md` §5 y `observability-standards.md` §14.
- **Pruebas**: `r13_panic_is_internal_with_request_id`, `r13_trace_context_is_propagated`, `r13_no_sensitive_data_in_logs` (las tres obligatorias de `observability-standards.md` §15).
- **L4**: en una base **efímera** (nunca la de producción) sembrar un descuadre con el rol de migración y verificar que la alerta llega a Alertmanager.
- **Terminado cuando**: «Inyectar descuadre dispara alerta crítica» (05).

### F12.5 · Importación de extractos
Nivel L2 · Estado 📝 (`import_rail_statement` idempotente por riel+fecha; falta el parser).
- **Documentos primero**: el criterio exige «Formato documentado en SPEC». Agregar a `settlement/SPEC.md` §4 el **formato CSV genérico** (propuesta; ajustar si el SPEC ya define otro): UTF-8, separador coma, cabecera obligatoria `value_date,external_ref,type,gross_minor,fee_minor,net_minor,currency`; `type` ∈ `CAPTURE|REFUND|FEE|ADJUSTMENT`; montos enteros en la unidad menor (ADR 0013); `value_date` ISO 8601; `currency` ISO 4217; una línea por movimiento; `net_minor = gross_minor − fee_minor` (si no cuadra, la línea se rechaza con `INVALID_LINE` y su número). Reservar ISO 20022 (camt.053) para cuando haya banco (N-PAG-04, Q-10).
- **Código**: `settlement/src/domain` (parser puro con errores por línea), `src/store` (guardar líneas pendientes de conciliar), original a object-storage (bucket de settlement en `scripts/init-buckets.sh`, llave `settlement_svc`).
- **Pruebas**: L1 `f12_5_parses_generic_csv`, `f12_5_rejects_line_with_bad_net`; L2 `f12_5_same_statement_twice_is_already_imported`.
- **Terminado cuando**: «Formato documentado en SPEC» (05) y el parser con L2.

### F12.6 · Conciliación, T5 y excepciones
Nivel L4 · Estado 📝.
- **Precedencia**: F12.5.
- **Leer antes**: `settlement/SPEC.md` R7, R8, R10; `domain-model.md` §5.2 T5 y §8.7 `ReconciliationState`.
- **Resultado observable**: importar el extracto del día concilia cada línea contra los pagos del riel (`RAIL_RECEIVABLE`); las coincidentes se asientan con T5 (`railsettle:<línea>`), las distintas quedan como excepción; la plataforma resuelve una excepción con evidencia.
- **Código**: match por `(rail, external_ref)`; estados MATCHED, AMOUNT_MISMATCH, UNMATCHED_INTERNAL (tras 3 días hábiles), UNMATCHED_EXTERNAL; T5 al ledger con clave determinista; diferencias a SUSPENSE con excepción; `resolve_exception` exige nota y deja auditoría.
- **Pruebas**: L2 contra ledger efímero `f12_6_spec11_2_amount_mismatch_posts_t5_only_for_the_rest` (aceptación 2 del SPEC), `f12_6_t5_is_idempotent_per_line`, `f12_6_suspense_alert_after_5_days` (reloj inyectado).
- **L4**: con pagos sandbox del riel genérico, generar un extracto CSV de prueba que coincida con ellos más una línea con monto distinto; importarlo desde la consola (F12.8) o por API de plataforma; verificar T5 y la excepción.
- **Trampas conocidas**: los pagos `sandbox:true` no entran a lotes (R2); para la L4 de conciliación usa el riel sandbox y documenta que el extracto también es de prueba.
- **Terminado cuando**: «Prueba de aceptación 2» (05).

### F12.4 · Pago al comercio (cierre)
Nivel L4 · Estado 📝 (T6b inmediato a la billetera; T6 bancario confirmado por plataforma; L2 contra ledger real).
- **Qué falta**: (a) consola de plataforma en la app para confirmar o fallar un pago bancario (S-PLAT, actualizar la ficha); (b) L4 de la aceptación 1 en producción con destino billetera (T6b): 3 cobros + 1 reembolso → lote con `net = Σ − reembolso`, asiento T6b y saldo del comercio en su billetera; segundo `CreateBatch` del mismo período no duplica. El conector bancario espera **Q-10**.
- **Terminado cuando**: «Prueba de aceptación 1» (05) en producción con T6b; T6 bancario citado como dependiente de Q-10.

### F12.7 · Jobs, alertas y feriados
Nivel L4 · Estado 📝.
- **Qué falta**: feriados (R9: no procesar pagos bancarios en feriados nacionales, leídos de `holidays.pa` de infra-management con la fecha del hecho) y alertas de conciliación (lote FAILED, excepciones abiertas > 3 días, SUSPENSE ≠ 0 > 5 días) como reglas de Prometheus.
- **Trampas conocidas**: los feriados son valores legales con vigencia: nunca en el código (AGENTS §2.13); si `holidays.pa` no existe en infra-management, agregarlo allí primero con su fuente (AGENTS §7).
- **Terminado cuando**: «Alertas de §9» (05) disparadas en una prueba con reloj inyectado.

### F12.8 · Consola de conciliación y finanzas
Nivel L4 · Estado 📝 (S-FIN-05/06 reales).
- **Qué falta**: consola de conciliación de plataforma (importar extracto, ver líneas y excepciones, resolver con nota) y la vista del comercio «por liquidar / próximo pago / historial» si algo falta en S-FIN-05.
- **Pruebas**: widget de 4 estados y texto al 200 %; L4 con el extracto de F12.6.
- **Terminado cuando**: «Widget tests 4 estados» (05) + L4.

### F10.8 · Carga básica del ledger
Nivel L5 · Estado 📝 (script k6 en `scripts/load/ledger-posttransaction.js`).
- **Qué falta**: ejecutar. k6 no está instalado: pide al dueño instalarlo o corre k6 en su contenedor oficial (`docker run --rm --network plentypay_data grafana/k6 run - < scripts/load/ledger-posttransaction.js`) contra un **ledger efímero** (base efímera del script L2), nunca contra producción.
- **Terminado cuando**: «500 PostTransaction/s p99 ≤ 50 ms en compose» (05) con la salida pegada en `status.md`.
