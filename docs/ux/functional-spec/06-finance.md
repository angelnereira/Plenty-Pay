# Finanzas: cobros, liquidación y fiscal

Módulo `finance`. Pasos F11.9 (cobros), F12.8 (liquidación), F13.9 (fiscal). Convenciones: [`README.md`](README.md). Fórmulas de comisión: [`../../domain/domain-model.md`](../../domain/domain-model.md) §4.

### S-FIN-01 · `/finance` · Resumen
`payments:read` o `settlement:read`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Hoy · 7 días · Mes · Rango | — |
| e2 | Tarjetas | Cobrado {x} · Comisiones {y} · Reembolsos {z} · Neto {w} | Cada una → S-FIN-02 filtrada |
| e3 | Tarjeta | Por liquidar {monto} · Próxima liquidación: {fecha} | → S-FIN-05. Solo con `settlement:read`; sin fecha: "Liquidación manual" |
| e4 | Tarjeta | Facturas del mes: {n} autorizadas · {m} pendientes · {k} rechazadas | Rechazadas en `error` → S-FIN-07. *Pendiente*: `ListInvoices` aún no filtra por fecha; no se muestra |
| e5 | Tarjeta | Folios disponibles: {n} | En `warning` bajo el mínimo → S-FIN-09. Solo con `fiscal:read` y perfil fiscal; sin tope: "Sin límite de folios" |
| e6 | Tarjeta | ITBMS del mes: {monto} · Declaración antes del 15 de {mes} | → S-FIN-10 |
| e7 | Gráfico | Cobros por medio de pago | Barras; lista equivalente accesible |
| e8 | Lista | Cobros · Puntos de cobro · Liquidaciones · Calendario de pagos · Documentos fiscales · Clientes fiscales · Perfil fiscal | Accesos a S-FIN-02, S-FIN-04, S-FIN-05, S-FIN-06, S-FIN-07, S-FIN-08 y S-FIN-09; cada uno solo con su permiso (C-12): `payments:read`, `finance.terminals`, `settlement:read`, `settlement:schedule:manage`, `fiscal:read`, `fiscal:issue`, `fiscal:profile:manage` |

### S-FIN-02 · `/finance/payments` · Cobros
`payments:read` · `/v1/payments`. Filtros: rango, estado (Completado, Confirmando, Rechazado, Reembolsado parcial, Reembolsado), medio, origen (Caja, Tienda en línea, Terminal), monto. Lista: fecha, referencia, origen, medio, bruto, neto, `StatusChip`. Exportar (C-20).

### S-FIN-03 · `/finance/payments/:id` · Detalle del cobro
`payments:read` · reembolso con `payments:refund` 🔒 · Regla: N-PAG-06

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `MoneyText` | Cobrado {bruto} | — |
| e2 | `StatusChip` | — | "Confirmando" explica: "Aún no sabemos si el banco cobró. No entregues productos de alto valor hasta confirmar." |
| e3 | Desglose | Bruto · Comisión PlentyPay · ITBMS de la comisión · Comisión del medio de pago · **Recibes** | Cada línea con su tasa |
| e4 | Datos | Fecha · Medio · Referencia · Origen (enlace a la venta o pedido) · Pagador enmascarado | — |
| e5 | Línea de tiempo | Intentos y estados | — |
| e6 | Liquidación | Incluido en la liquidación {número} / Aún sin liquidar | Enlace |
| e7 | Reembolsos | Lista de reembolsos con monto y estado | — |
| e8 | `PPButton.secondary` | Reembolsar | Abre: monto (≤ cobrado − reembolsado), motivo. Resumen: "Se devolverán {R} al cliente. Se descontarán {merchant_debit} de tu saldo." C-05 "Reembolsar {R}" → S-GEN-21 |

Errores: `REFUND_EXCEEDS_CAPTURED` "El reembolso supera lo cobrado." `MERCHANT_BALANCE_INSUFFICIENT` "Tu saldo por liquidar no alcanza para este reembolso."

### S-FIN-04 · `/finance/terminals` · Puntos de cobro
`payments:terminal:manage` · Pasos F11.9, F23.2. Lista: nombre, sucursal, activo. Crear: nombre, sucursal, monto fijo opcional. Detalle: QR grande, "Imprimir QR" (hoja con nombre del comercio y el texto "Escanea para pagar con PlentyPay"), "Grabar etiqueta NFC" (`NfcPrompt` "Acerca la etiqueta"), "Copiar enlace", e interruptor "Activo" (desactivar con C-05).

### S-FIN-05 · `/finance/settlements` · Liquidaciones
`settlement:read` · `/v1/settlement/summary`, `/v1/settlement/batches`. Cabecera: "Por liquidar {monto}", "En proceso {monto}" (solo si > 0) y "Próxima liquidación {fecha}" (con frecuencia Manual o sin calendario: "Liquidación manual"). Botón primario "Liquidar ahora" (`settlement:schedule:manage`, `POST /v1/settlement/batches`): crea el lote con lo disponible tras la retención (R4); a la billetera se paga al instante, a un banco queda "En proceso" hasta que PlentyPay confirma la transferencia. Errores: `NOTHING_TO_SETTLE` "No tienes cobros listos para liquidar.", `BELOW_MINIMUM` "Lo disponible no alcanza tu mínimo de liquidación.", `SANDBOX_FUNDS` "Tus cobros de prueba solo se liquidan a la billetera del negocio.", `PAYOUTS_BLOCKED` "Por seguridad, los pagos a tu cuenta nueva empiezan 48 horas después del cambio.". Lista: número (los primeros 8 caracteres del lote), fecha, monto, destino (banco enmascarado o billetera), `StatusChip` (Abierta, En proceso, Pagada, Fallida) y chip "Prueba" si incluye cobros de prueba. Detalle: cobros incluidos, reembolsos descontados, total, referencia bancaria y fecha de pago. Fallida: motivo y "Revisa tu cuenta de destino". *Pendiente*: descarga del detalle (C-20).

### S-FIN-06 · `/finance/payout-settings` · Calendario y cuenta de destino
`settlement:schedule:manage` · 🔒 al cambiar destino · Regla: N-PAG-07

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Frecuencia: Diaria · Semanal ({día}) · Manual | Diaria y semanal liquidan solas a las 17:00 (hora de Panamá) |
| e2 | `MoneyInput` | Liquidar solo si supera | Por defecto $1.00 (R6) |
| e3 | Selector | Destino: Cuenta bancaria · Billetera del negocio | — |
| e4 | Cuenta | Banco · Tipo (Corriente / Ahorros) · Número · Titular | Con una cuenta guardada se muestra "{banco} · {tipo} · •••• {últimos 4} · {titular}" y "Cambiar cuenta"; el número nunca se vuelve a mostrar. El titular debe coincidir con la razón social o el nombre comercial: `INVALID_DESTINATION` "El titular no coincide con tu negocio." |
| e5 | Texto | Por seguridad, los pagos a una cuenta bancaria nueva empiezan 48 horas después del cambio. | Con el bloqueo activo: "Pagos detenidos hasta el {fecha}" (R5) |
| e6 | `PPButton.primary` | Guardar | S-GEN-21 (`settlement.destination.update`) si cambió e3 o e4 |

### S-FIN-07 · `/finance/invoices` · Documentos fiscales
`fiscal:read` · `/v1/fiscal/invoices` · Reglas: N-FIS-05, N-FIS-08, N-FIS-09

Filtros: tipo (Factura, Nota de crédito, Nota de débito) y estado (En cola, Enviada, Autorizada, Rechazada, Anulada). *Pendiente*: rango de fechas y cliente (`ListInvoices` aún no filtra por ellos); el recibo interno no es un documento de fiscal-invoicing. Lista: número, fecha, cliente, total, `StatusChip`. Con perfil en ambiente de pruebas, franja C-11 «Modo de prueba: los documentos no tienen validez fiscal.» (R9). Botón primario "Nueva factura" (`fiscal:issue`): cliente frecuente opcional (S-FIN-08; sin cliente = consumidor final), líneas de concepto libre (descripción, cantidad, precio, tasa de ITBMS entre las vigentes; *pendiente*: elegir un producto del catálogo), medio de pago (Efectivo, Tarjeta, Transferencia, Billetera), vista previa de totales. Sin perfil fiscal: `PROFILE_MISSING` con enlace a S-FIN-09.

Detalle (`/finance/invoices/:id`):

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | {Tipo} {número} · `StatusChip` | — |
| e2 | CUFE y QR | CUFE {código} · QR de verificación | Solo si está autorizada. CUFE copiable |
| e3 | Emisor y receptor | Razón social, RUC, DV, dirección | — |
| e4 | Líneas y totales | Por tasa de ITBMS | — |
| e5 | Rechazo | Motivo del PAC: {texto} | Solo en Rechazada. *Pendiente*: "Corregir y reenviar" (no existe aún en el contrato) |
| e6 | Acciones | Descargar PDF · Descargar XML · Enviar por correo | *Pendiente* (fiscal-invoicing bloque C): no se muestra hasta que existan los documentos |
| e7 | `PPButton.secondary` | Emitir nota de crédito / Emitir nota de débito | `fiscal:note:issue`. Formulario: líneas afectadas, monto, motivo. La suma de créditos no supera el total (`EXCEEDS_ORIGINAL`). Requiere que la factura esté autorizada (`RELATED_NOT_ACCEPTED`) |

No existe "Editar" ni "Eliminar" en un documento autorizado.

### S-FIN-08 · `/finance/taxpayers` · Clientes fiscales
`fiscal:issue` · Reglas: N-FIS-07, N-FMT-06

Lista y editor.

| Campo | Validación |
|---|---|
| Tipo de identificación | RUC persona jurídica · RUC persona natural · Entidad del Estado · Cédula · Pasaporte · Identificación extranjera (los del contrato, `Taxpayer.tax_id_type`). El consumidor final no se guarda: es la factura sin cliente |
| RUC o identificación | RUC con el formato de N-FMT-06; cédula con N-FMT-05; pasaporte o extranjera hasta 30 caracteres |
| DV | 2 dígitos; obligatorio con RUC. `INVALID_RUC` |
| Nombre o razón social | Obligatorio |
| Correo | Opcional; recibe el documento |
| Dirección | 5 a 100 caracteres. Obligatoria para una entidad del Estado; la DGI también la exige al facturar a un RUC (ayuda: «La DGI la exige para facturar a un RUC.»), y la emisión lo avisa con `INVALID_TAXPAYER` (ADR 0022 §8) |
| Ubicación | Opcional: provincia-distrito-corregimiento de la DGI, p. ej. «8-8-7» |

Lista con buscador (nombre o identificación) y "Agregar cliente" como botón primario.

### S-FIN-09 · `/finance/fiscal-profile` · Perfil fiscal
`fiscal:profile:manage` · 🔒 · Reglas: N-FIS-04, N-FIS-10

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Datos del emisor | RUC · DV · Razón social · Sucursal (código) · Punto de facturación (código) | RUC y razón social vienen del negocio; solo lectura |
| e2 | Selector | Proveedor de facturación (PAC) | Los adaptadores que ofrece el servidor en `GET /v1/fiscal/pac-providers` (ADR 0022), con el nombre que declara cada uno; hoy «The Factory HKA» y «Simulador (pruebas)». La app no conoce a ningún PAC |
| e3 | Credenciales | Un campo por cada credencial que declara el PAC elegido (`credential_fields`: etiqueta y si es secreta, p. ej. con HKA «Token de empresa» y «Contraseña del token») | Se envían una sola vez y se guardan cifradas en security; después solo se ve «Configurado» con la acción «Cambiar credenciales». Obligatorias la primera vez y al cambiar de PAC. No se muestra si el PAC no pide credenciales (simulador). *Pendiente*: «Probar conexión» |
| e4 | Selector | Ambiente: Pruebas / Producción | Producción solo si el PAC la ofrece (`environments`); si no, deshabilitada con la nota «Producción se habilita tras la validación legal.» (`PAC_NOT_CONFIGURED`, `FISCAL_PROD_ENABLED`). Pasar a Producción: C-05 «Tus facturas tendrán validez fiscal.» |
| e5 | Selector | Qué documento emitir: Siempre factura / Solo recibo interno / Preguntar / Automático desde {monto} | — |
| e6 | Folios | Disponibles {n} · Aviso al quedar {mínimo} · En tu cuenta del PAC: {n} | Sin tope contratado: "Sin límite de folios". La línea del PAC solo si lo informa (`pac_remaining` ≥ 0). *Pendiente*: "Comprar folios" |
| e7 | Texto | El facturador gratuito de la DGI solo aplica hasta {tope anual} al año y {tope mensual} documentos al mes. PlentyPay factura a través de tu PAC. | *Pendiente*: los topes son valores legales (N-FIS-10) y deben leerse de `legal.pa.*` (AGENTS.md §2.13); no se muestra hasta que existan esos parámetros |
| e8 | `PPButton.primary` | Guardar | S-GEN-21 |

Sin perfil completo, toda emisión responde `PROFILE_MISSING` "Completa tu perfil fiscal para facturar." con enlace aquí.

### S-FIN-10 · `/finance/tax-report` · Reporte de ITBMS
`fiscal:read` · `/v1/fiscal/reports/itbms` · Regla: N-FIS-11

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Período (mes) | — |
| e2 | Tabla de ventas | Base y ITBMS al 7 %, 10 %, 15 % · Exento · No sujeto | Solo documentos autorizados |
| e3 | Notas | Notas de crédito y débito del período | — |
| e4 | Compras | ITBMS de compras registradas en inventario | Informativo |
| e5 | Resultado | ITBMS generado − ITBMS de compras = Estimado a pagar | — |
| e6 | Alerta | {n} documentos pendientes o rechazados no están incluidos | Enlace a S-FIN-07 filtrada |
| e7 | Texto | Usa este reporte para preparar tu Formulario 430. Vence el 15 de {mes}. PlentyPay no presenta la declaración por ti. | — |
| e8 | `PPButton.primary` | Exportar | C-20, con el detalle documento por documento |
