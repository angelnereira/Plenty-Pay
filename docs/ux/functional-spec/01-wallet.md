# Billetera y pago presencial

Módulo `wallet`. Paso F11.9 salvo indicación. Convenciones: [`README.md`](README.md). Reglas de dinero: [`../../domain/domain-model.md`](../../domain/domain-model.md) §4–§6.

Precondición de todo el módulo: con dinero real, la billetera exige nivel "Verificado" (N-AML-02). Sin él, cada pantalla muestra `EmptyState` "Verifica tu identidad para usar tu billetera." con botón "Verificar" → S-GEN-14. En sandbox no se exige.

### S-WAL-01 · `/wallet` · Saldo y movimientos
`wallet:read` · `/v1/wallet/balance`, `/v1/wallet/statement`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `MoneyText` `displayMoney` | Saldo disponible {monto} | Botón de ojo lo oculta; se recuerda la preferencia |
| e2 | Texto `caption` | Retenido: {monto} | Solo si > 0. Toca: explica "Dinero apartado para pagos en curso." |
| e3 | Fila de 4 acciones | Recargar · Enviar · Recibir · Pagar | Cada una según su permiso (C-12) → S-WAL-02, 03, 04, 05 |
| e4 | Chips de filtro | Todos · Entradas · Salidas · Rango de fechas | Rango máximo 366 días (`INVALID_RANGE`: "Elige un rango de hasta un año.") |
| e5 | Lista de movimientos | Icono, contraparte o concepto, fecha, monto con signo, `StatusChip` si no es definitivo | Toca → S-WAL-08 |
| e6 | Acción de barra | Exportar | C-20 |

Vacío: "Aún no tienes movimientos." con acción "Recargar".

### S-WAL-02 · `/wallet/topup` · Recargar
`wallet:topup` · `POST /v1/wallet/topups` · Reglas: N-AML-03, N-AML-05, N-PAG-06

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `MoneyInput` | ¿Cuánto quieres recargar? | Mínimo $1.00. Máximo: lo que falte para el tope de saldo del nivel |
| e2 | Texto `caption` | Puedes recargar hasta {monto}. | Calculado con `/v1/me/limits` |
| e3 | Lista de métodos | Yappy · Clave · Tarjeta · … | Solo rieles activos para el país. En sandbox cada uno lleva la etiqueta "Prueba" |
| e4 | Desglose | Recarga {monto} · Comisión {monto} · Total a pagar {monto} | Se actualiza al cambiar e1 o e3 (`/v1/payments/quote`) |
| e5 | `PPButton.primary` | Recargar {total} | Tarjeta: abre el componente del PSP (N-PAG-01). Otros: abre la app del riel o muestra su QR |

Flujo: confirmación → espera de resultado → S-WAL-07. Si la recarga supera B/. 10 000 acumulados en 24 h, antes de e5 se pide "Origen de estos fondos" (lista de S-GEN-14 paso 3).

### S-WAL-03 · `/wallet/send` · Enviar dinero
`wallet:transfer` · Paso F11.10 · `GET /v1/pay-links/{código}` → `POST /v1/payments/intents` (con el código) → `/confirm` · 🔒 desde el umbral

**Implementado (F11.10)**: «Enviar» abre el lector de S-WAL-05 con el título "Enviar" y la instrucción "Escanea el código de quien recibe o escríbelo abajo."; el código se resuelve en el servidor como persona (`kind = PERSON`) y la confirmación es S-WAL-06 en modo envío: "Persona verificada en PlentyPay", nombre abreviado, "Enviar entre personas no tiene comisión." y botón "Enviar {monto}". Una transferencia no cobra comisión (R10). `SELF_TRANSFER`: "No puedes enviarte dinero a ti mismo." *Pendiente*: e1 búsqueda por correo o teléfono (Q-54), e3 recientes y e5 concepto.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Buscador | Correo, teléfono o código | Busca al escribir ≥ 4 caracteres. Icono de cámara: escanea el QR personal (S-WAL-04) |
| e2 | Resultado | {Nombre verificado} · {correo enmascarado} | Solo usuarios con billetera verificada. Sin resultado: "No encontramos a esa persona en PlentyPay." |
| e3 | Recientes | Últimos 5 destinatarios | Atajo |
| e4 | `MoneyInput` | Monto | Mínimo $0.01; máximo = saldo disponible y límite por operación |
| e5 | `PPTextField` | Concepto (opcional) | ≤ 140 caracteres |
| e6 | `PPButton.primary` | Continuar | Abre el resumen: "Enviarás {monto} a {nombre}." con "Enviar {monto}" y "Cancelar" |

No se puede enviar a uno mismo. Éxito → S-WAL-07.

### S-WAL-04 · `/wallet/receive` · Recibir
`wallet:read`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `QrView` | — | Contiene `https://plentypay.app/t/{código}`: un código opaco de 128 bits de la persona, que vence a las 24 h (pedirlo de nuevo con menos de 1 h por delante emite otro). No lleva datos personales: identifica a la persona en el servidor |
| e2 | Texto | {nombre abreviado} · "Muestra este código para que te envíen dinero. Te identifica sin mostrar tu correo ni tu teléfono." · "Válido hasta el {fecha y hora con mes en texto}" | El nombre es nombre + inicial del apellido (N-DAT-12) |
| e3 | `MoneyInput` opcional | Pedir un monto (opcional) | Si se llena, el QR lleva `?amount={centavos}` y quien envía no lo puede cambiar |
| e4 | `PPButton.secondary` | Copiar enlace | Copia el enlace del QR. "Por ahora este código se lee con la app PlentyPay." mientras el dominio no exista (Q-53). *Pendiente*: hoja de compartir del sistema (F22) |

### S-WAL-05 · `/pay/scan` · Pagar: escanear o acercar
`wallet:pay` · Pasos F11.9, F23.1, F23.2 · `GET /v1/pay-links/:code`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `QrScannerView` | Apunta al código QR del comercio | Linterna. Solo acepta URL `https://<host permitido>/t/<code>` con `code` de 8–64 caracteres `[A-Za-z0-9_-]` |
| e2 | `PPButton.secondary` | Acercar el teléfono (NFC) | Abre `NfcPrompt` "Acerca tu teléfono al lector". Oculto si el dispositivo no tiene NFC |
| e3 | `PPButton.text` | Escribir código | Campo para el código impreso |

Código de otro dominio: "Este código no es de PlentyPay." y no se abre. Código inexistente o terminal inactiva: "Este punto de cobro no está disponible." (`TERMINAL_INACTIVE`).

### S-WAL-06 · `/pay/:code` · Confirmar pago
`wallet:pay` · intents + confirm · 🔒 desde el umbral · Reglas: N-CON-01, N-PAG-06

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | {Nombre comercial verificado} · icono de verificado · {sucursal} | Siempre del servidor; nunca del contenido del QR o del tag |
| e2 | `MoneyInput` o `MoneyText` | Monto | Editable solo si el terminal no fijó el monto |
| e3 | Selector | Pagar con: Saldo PlentyPay ({disponible}) · otros rieles activos | Saldo insuficiente: opción deshabilitada con "Saldo insuficiente" y enlace "Recargar" |
| e4 | Desglose | Compra {monto} · Comisión de servicio {monto} · ITBMS {monto} · Total {monto} | Las líneas de comisión solo si la paga el cliente |
| e5 | Interruptor | Quiero factura con mi RUC | Abre selector de datos fiscales guardados o formulario RUC + DV + nombre |
| e6 | `PPButton.primary` | Pagar {total} | Biometría local siempre; S-GEN-21 si total ≥ umbral |

Negocio no activo: `TENANT_NOT_ACTIVE` como `ErrorState` sin reintento.

### S-WAL-07 · `/pay/result/:intent` · Resultado
`wallet:pay` · Pasos F11.9, F23.4 · WebSocket `payment.status`

Tres variantes, sin botón de atrás hasta tener resultado.

| Variante | Elementos |
|---|---|
| **Éxito** | Check animado ≤ 600 ms con háptico · "Pago realizado" · `MoneyText` total · "{comercio} · {fecha}" · "Referencia {código corto}" · `PPButton.primary` "Listo" → Inicio · `PPButton.secondary` "Ver recibo" → S-WAL-08 |
| **Rechazado** | Icono de error · "No se pudo completar el pago" · motivo traducido · "No se te cobró nada." · `PPButton.primary` "Intentar de nuevo" (genera nueva clave de idempotencia) · "Cambiar método" |
| **Confirmando** | Icono de reloj en `warning` · "Estamos confirmando tu pago" · "Puede tardar unos minutos. No vuelvas a pagar: te avisaremos el resultado." · `PPButton.primary` "Entendido" → Inicio. La pantalla sigue escuchando; al resolverse cambia sola a Éxito o Rechazado y llega un aviso |

Nunca se muestra "Rechazado" para el estado UNKNOWN (dominio §6.3).

### S-WAL-08 · `/wallet/tx/:id` · Detalle de movimiento
`wallet:read` · Pasos F11.9, F23.7

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `MoneyText` `displayMoney` | {monto con signo} | — |
| e2 | `StatusChip` | Completado / Confirmando / Rechazado / Reembolsado | — |
| e3 | Tabla | Tipo · Contraparte · Fecha y hora · Método · Referencia · Concepto | Referencia copiable |
| e4 | Desglose | Compra · Comisión · ITBMS · Total | Si aplica |
| e5 | Fila | Factura {número} · CUFE {abreviado} | Si hay documento fiscal. Abre el PDF; muestra el QR de verificación de la DGI |
| e6 | `PPButton.secondary` | Compartir recibo | PDF |
| e7 | `PPButton.text` | Tengo un problema con este pago | → S-MKT-08 con el pago precargado |

### S-WAL-09 · `/account/limits` · Límites de mi cuenta
Todos · `/v1/me/limits` · Regla: N-AML-03

Tabla de solo lectura: Saldo máximo · Recarga por día · Envío por operación · Envío por mes · Pago por operación. Cada fila: límite del nivel, usado y disponible, con barra. Encima, el nivel actual. Botón primario "Aumentar mis límites" → S-GEN-14 (visible si existe un nivel superior). Texto al pie: "Los límites protegen tu cuenta y cumplen la regulación de Panamá."
