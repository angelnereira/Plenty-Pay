# notifications-service

Punto ÚNICO de salida de notificaciones (doc 04 §3: ningún servicio llama a un proveedor por su cuenta). Contrato: `plentypay.notifications.v1`.

**Estado: PLANNED (Etapa 2)**

| Canal | Estado |
|---|---|
| `CONSOLE` (log estructurado dev) | TODO — primer canal, cero dependencias externas |
| `EMAIL` | TODO — proveedor real `BLOCKED-UNVERIFIED` (credenciales) |
| `PUSH` | TODO — `BLOCKED-UNVERIFIED` |
| `WHATSAPP` | TODO — Etapa 4+, acuerdo comercial (doc 03 §6) |

Tecnología: **Go**. Idempotencia por clave; estados QUEUED/SENDING/SENT/FAILED/SUPPRESSED.
