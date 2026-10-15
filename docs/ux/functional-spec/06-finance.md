# Finanzas: cobros, liquidación y fiscal

Módulo `finance`. Pasos F11.9 (cobros), F12.8 (liquidación), F13.9 (fiscal). Convenciones: [`README.md`](README.md). Fórmulas de comisión: [`../../domain/domain-model.md`](../../domain/domain-model.md) §4.

### S-FIN-01 · `/finance` · Resumen
`payments:read` o `settlement:read`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Hoy · 7 días · Mes · Rango | — |
| e2 | Tarjetas | Cobrado {x} · Comisiones {y} · Reembolsos {z} · Neto {w} | Cada una → S-FIN-02 filtrada |
| e3 | Tarjeta | Por liquidar {monto} · Próxima liquidación: {fecha} | → S-FIN-05 |
| e4 | Tarjeta | Facturas del mes: {n} autorizadas · {m} pendientes · {k} rechazadas | Rechazadas en `error` → S-FIN-07 |
| e5 | Tarjeta | Folios disponibles: {n} | En `warning` bajo el mínimo → S-FIN-09 |
| e6 | Tarjeta | ITBMS del mes: {monto} · Declaración antes del 15 de {mes} | → S-FIN-10 |
| e7 | Gráfico | Cobros por medio de pago | Barras; lista equivalente accesible |

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
`settlement:read` · `/v1/settlement/batches`. Cabecera: "Por liquidar {monto}" y "Próxima liquidación {fecha}". Lista: número, fecha, monto, destino (banco enmascarado o billetera), `StatusChip` (Abierta, En proceso, Pagada, Fallida). Detalle: cobros incluidos, reembolsos descontados, total, referencia bancaria, y descarga del detalle (C-20). Fallida: motivo y "Revisa tu cuenta de destino".

### S-FIN-06 · `/finance/payout-settings` · Calendario y cuenta de destino
`settlement:schedule:manage` · 🔒 al cambiar destino · Regla: N-PAG-07

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Frecuencia: Diaria · Semanal ({día}) · Manual | — |
| e2 | `MoneyInput` | Liquidar solo si supera | Mínimo de la plataforma |
| e3 | Selector | Destino: Cuenta bancaria · Billetera del negocio | — |
| e4 | Cuenta | Banco · Tipo · Número · Titular | Número mostrado enmascarado. El titular debe coincidir con el negocio o su representante: `INVALID_DESTINATION` "El titular no coincide con tu negocio." |
| e5 | Texto | Un cambio de cuenta se aplica a partir de la siguiente liquidación y te avisamos por correo. | — |
| e6 | `PPButton.primary` | Guardar | S-GEN-21 si cambió e3 o e4 |

### S-FIN-07 · `/finance/invoices` · Documentos fiscales
`fiscal:read` · `/v1/fiscal/invoices` · Reglas: N-FIS-05, N-FIS-08, N-FIS-09

Filtros: rango, tipo (Factura, Nota de crédito, Nota de débito, Recibo interno), estado (Borrador, En cola, Enviada, Autorizada, Rechazada, Anulada), cliente. Lista: número, fecha, cliente, total, `StatusChip`. Botón primario "Nueva factura" (`fiscal:issue`): cliente (S-FIN-08), líneas (producto o concepto libre, cantidad, precio, tasa), medio de pago, vista previa de totales por tasa.

Detalle (`/finance/invoices/:id`):

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | {Tipo} {número} · `StatusChip` | — |
| e2 | CUFE y QR | CUFE {código} · QR de verificación | Solo si está autorizada. CUFE copiable |
| e3 | Emisor y receptor | Razón social, RUC, DV, dirección | — |
| e4 | Líneas y totales | Por tasa de ITBMS | — |
| e5 | Rechazo | Motivo del PAC: {texto} | Solo en Rechazada, con botón "Corregir y reenviar" |
| e6 | Acciones | Descargar PDF · Descargar XML · Enviar por correo | — |
| e7 | `PPButton.secondary` | Emitir nota de crédito / Emitir nota de débito | `fiscal:note:issue`. Formulario: líneas afectadas, monto, motivo. La suma de créditos no supera el total (`EXCEEDS_ORIGINAL`). Requiere que la factura esté autorizada (`RELATED_NOT_ACCEPTED`) |

No existe "Editar" ni "Eliminar" en un documento autorizado.

### S-FIN-08 · `/finance/taxpayers` · Clientes fiscales
`fiscal:issue` · Reglas: N-FIS-07, N-FMT-06

Lista y editor.

| Campo | Validación |
|---|---|
| Tipo de receptor | Contribuyente · Consumidor final · Gobierno · Extranjero |
| RUC | Obligatorio para Contribuyente y Gobierno. Formato según persona natural o jurídica |
| DV | 2 dígitos; obligatorio con RUC. `INVALID_RUC` |
| Identificación y país | Obligatorios para Extranjero |
| Nombre o razón social | Obligatorio salvo Consumidor final |
| Correo | Opcional; recibe el documento |
| Dirección | Provincia, distrito, corregimiento y dirección; obligatoria para Contribuyente y Gobierno |

### S-FIN-09 · `/finance/fiscal-profile` · Perfil fiscal
`fiscal:profile:manage` · 🔒 · Reglas: N-FIS-04, N-FIS-10

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Datos del emisor | RUC · DV · Razón social · Sucursal (código) · Punto de facturación (código) | RUC y razón social vienen del negocio; solo lectura |
| e2 | Selector | Proveedor de facturación (PAC) | Lista de adaptadores disponibles |
| e3 | Credenciales | Usuario o token del PAC · Certificado | Se guardan cifradas; después solo se ve "Configurado el {fecha}". Botón "Probar conexión" |
| e4 | Selector | Ambiente: Pruebas / Producción | Pasar a Producción: C-05 "Tus facturas tendrán validez fiscal." |
| e5 | Selector | Qué documento emitir: Siempre factura / Solo recibo interno / Preguntar / Automático desde {monto} | — |
| e6 | Folios | Disponibles {n} · Aviso al quedar {mínimo} | Enlace "Comprar folios" al PAC |
| e7 | Texto | El facturador gratuito de la DGI solo aplica hasta B/. 36,000 al año y 100 documentos al mes. PlentyPay factura a través de tu PAC. | — |
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
