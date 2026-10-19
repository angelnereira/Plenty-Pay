# Runbook — Pago en estado UNKNOWN (F30.1, F11.6)

Un pago en `UNKNOWN` **no es un pago fallido**. Significa que se envió una
solicitud al riel y no llegó una respuesta concluyente. Podría haber cobrado o no:
tratarlo como fallo muestra «no se pudo» a un usuario que sí pagó
(`flutter-standards.md` §10.5).

> [!IMPORTANT]
> **Nunca** cobres de nuevo un pago `UNKNOWN` para «arreglarlo». El
> `idempotency_key` del intento es el mismo; un reintento con la misma clave lo
> devuelve el mismo resultado, y con una clave distinta crea un segundo cobro.

---

## 1. Qué significa cada estado

| Estado | Significado | Qué hacer |
|---|---|---|
| `CAPTURED` | El riel confirmó el cobro. | Nada. |
| `FAILED` | El riel rechazó; no hay dinero. | Reintentar solo si el comercio lo pide y el motivo es del usuario. |
| `UNKNOWN` | Se envió y no hubo respuesta concluyente. | **Esperar el webhook o consultar.** Ver §2. |
| `PENDING` | El riel aceptó y procesa. | Esperar. |

## 2. Diagnóstico

```bash
# 1. Estado en el contenedor de pagos
grpcurl -plaintext -d '{"payment_intent_id":"<id>"}' \
  localhost:50051 list /plentypay.payments.v1.Payments/GetPaymentIntent

# 2. Buscar en el libro contable: si hay asiento, el dinero se movió
docker exec plentypay-postgres-db-1 psql -U postgres -d plentypay -c \
  "SELECT id, transaction_type, occurred_at FROM ledger.entries
   WHERE tenant_id = '<tenant>' AND created_at > now() - interval '1 hour'
   ORDER BY created_at DESC LIMIT 20;"

# 3. Consultar directamente al riel con el idempotency key original
#    (ver `Q-11`: el proveedor de SMS/QR está sin confirmar; para Yappy y
#    Telered Clave el endpoint está en payments-core/SPEC.md §4)
```

## 3. Resolución

### 3.1 El webhook llega con `CAPTURED`

El estado se actualiza solo. El comercio recibe la notificación por
`notifications` (`payment.captured`). No hay acción manual.

Comprueba que llegó:

```sql
SELECT dedupe_key, status, provider_message_id
FROM notifications.messages
WHERE dedupe_key LIKE 'paymentcaptured:<payment_id>:%';
```

### 3.2 El webhook nunca llega

El relay de eventos de `payments-core` reintenta con retroceso. Si tras 15 minutos
sigue `UNKNOWN`, la regla de notificaciones marca el evento para la mesa de ayuda
(`ops.payment_unknown`).

Acción: consultar al riel con el `idempotency_key` original (§2.3) y, según su
respuesta:

- Cobró → corregir el estado a mano con el RPC de soporte, **nunca** con un `UPDATE`
  directo a la base: el libro contable debe llevar el asiento.
- No cobró → transicionar a `FAILED` con el mismo procedimiento.

### 3.3 Dos cobros con el mismo `idempotency_key`

Es un incidente. Ver `double-charge.md` (pendiente de redactar).

## 4. Verificación del runbook

Este runbook se considera probado cuando, en el simulacro de F30.1, un pago forzado
a `UNKNOWN` termina en el estado correcto sin intervención del ledger:

1. Crear un pago y cortar la conexión al riel antes de la respuesta.
2. Verificar que la app muestra «Estamos confirmando tu pago».
3. Restablecer la conexión.
4. Verificar que el pago llega a `CAPTURED` y que el asiento contable existe.

## 5. Comunicación con el comercio

Si un comercio pregunta, la respuesta es: **«Estamos confirmando tu pago; no lo
cobres de nuevo.»** Nunca «tu pago falló» mientras el estado sea `UNKNOWN`.