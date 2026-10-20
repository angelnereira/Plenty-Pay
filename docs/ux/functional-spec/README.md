# Especificación funcional y de pantallas

Define **qué hace PlentyPay y cómo se ve cada pantalla**: elementos, textos, validaciones, acciones, estados y conexiones entre módulos. Complementa a [`../screen-catalog.md`](../screen-catalog.md) (qué pantallas existen y con qué permiso), a [`../../gravital-experience-ui.md`](../../gravital-experience-ui.md) (regla de diseño estricta `gravital-experience-ui` para todas las interfaces Flutter previas y futuras) y a [`../../design-system.md`](../../design-system.md) (cómo se ven los componentes). Las reglas normativas `N-…` vienen de [`../../compliance/regulatory-framework.md`](../../compliance/regulatory-framework.md) (Panamá) y de [`../../compliance/international-standards.md`](../../compliance/international-standards.md) (estándares internacionales, `N-STD-…`).

Precedencia si hay conflicto: ADR → `domain-model.md` → SPEC del contenedor → este documento → `screen-catalog.md`. Una pantalla que necesite una ruta o un dato que el gateway aún no expone lo declara en §7 (contratos pendientes) y no se construye hasta que exista.

## 1. Archivos

| Archivo | Módulos | Pantallas |
|---|---|---|
| [`00-transversal.md`](00-transversal.md) | Acceso, inicio, cuenta, privacidad, verificación de identidad, alta de negocio | S-GEN-01 a S-GEN-22 |
| [`01-wallet.md`](01-wallet.md) | Billetera y pago presencial | S-WAL-01 a S-WAL-09 |
| [`02-marketplace-orders.md`](02-marketplace-orders.md) | Comprar y pedidos del comercio | S-MKT-01 a S-MKT-08, S-ORD-01 a S-ORD-02 |
| [`03-pos.md`](03-pos.md) | Caja | S-POS-01 a S-POS-12 |
| [`04-catalog-inventory.md`](04-catalog-inventory.md) | Productos e inventario | S-CAT-01 a S-CAT-05, S-INV-01 a S-INV-09 |
| [`05-logistics.md`](05-logistics.md) | Entregas: tienda, repartidor y cliente | S-LOG-01 a S-LOG-07 |
| [`06-finance.md`](06-finance.md) | Cobros, liquidación y fiscal | S-FIN-01 a S-FIN-10 |
| [`07-payroll.md`](07-payroll.md) | Equipo, asistencia y nómina | S-PAY-01 a S-PAY-09 |
| [`08-analytics.md`](08-analytics.md) | Análisis | S-ANA-01 a S-ANA-08 |
| [`09-admin-platform.md`](09-admin-platform.md) | Mi negocio, plataforma y páginas públicas | S-ADM-01 a S-ADM-08, S-PLT-01 a S-PLT-09, S-PUB-01 a S-PUB-04 |

## 2. Cómo se lee la ficha de una pantalla

```
### S-XXX-nn · /ruta · Nombre
Quién · Permiso · Paso del roadmap · Reglas que implementa
Tabla de elementos: Id | Componente | Texto visible | Comportamiento y validación
Flujo: pasos numerados de la acción principal y a dónde navega
Estados: vacío y errores propios (los comunes están en §3)
```

- **Id de elemento**: `e1`, `e2`… en orden visual de arriba abajo. Es la clave ARB: `sWal01_e3`.
- **Componente**: uno de `design-system.md` §6. Si no existe, se agrega allí primero.
- **Texto visible**: literal en español (`es_PA`). El inglés se traduce en ARB con la misma clave. `{x}` es un valor dinámico.
- Lo que la ficha no menciona **no existe** en la pantalla (N-DAT-12).

## 3. Comportamiento común a todas las pantallas

Estas reglas no se repiten en cada ficha.

| Id | Regla |
|---|---|
| **C-01** | Cuatro estados: cargando (esqueleto con la forma del contenido), vacío (`EmptyState` con la acción primaria de la pantalla), error (`ErrorState`), datos |
| **C-02** | `ErrorState`: icono, mensaje traducido del `reason`, botón "Reintentar". Si el `reason` es desconocido: "Algo salió mal. Inténtalo de nuevo." y debajo "Código de soporte: {request_id}" con botón de copiar |
| **C-03** | Un solo `PPButton.primary` por pantalla, abajo. En formularios está deshabilitado hasta que todos los campos obligatorios son válidos; al pulsarlo muestra indicador y bloquea un segundo toque |
| **C-04** | Validación de campo al perder el foco y al enviar. El error se muestra bajo el campo, con icono. Campo obligatorio vacío: "Este campo es obligatorio." |
| **C-05** | Acción destructiva o de dinero: diálogo de confirmación con el efecto explícito en el botón ("Reembolsar $12.00"), y botón secundario "Cancelar" |
| **C-06** | Operación marcada 🔒: tras confirmar se abre S-GEN-21 (confirmación fuerte). Si se cancela, la operación no se envía |
| **C-07** | Toda mutación de dinero o estado envía `Idempotency-Key` generada al abrir la confirmación y reutilizada en reintentos |
| **C-08** | Dinero: `MoneyText`, siempre con símbolo, cifras tabulares, negativo con signo y color `error` (N-FMT-01). Entrada con `MoneyInput`, que construye centavos |
| **C-09** | Fechas: `10 oct 2026, 2:03 p. m.` en hora de Panamá, con el **mes siempre en texto** (N-STD-10, N-STD-11). En listas de actividad, relativo ("hace 5 min") con la fecha exacta al mantener pulsado. Los campos de fecha abren un selector de calendario y muestran el resultado con el mes en texto; no se teclea una fecha numérica |
| **C-10** | Listas: carga incremental al llegar al final, "tirar para actualizar" en móvil, y al final "No hay más resultados." |
| **C-11** | Franja superior fija, por prioridad: mantenimiento ("Estamos en mantenimiento. Puedes consultar, pero no hacer cambios."), sin conexión ("Sin conexión. Mostrando datos guardados."), sandbox ("Modo de prueba: no se mueve dinero real.") |
| **C-12** | Una acción sin permiso no se muestra. Una ruta de un módulo no visible redirige a Inicio |
| **C-13** | Barra superior: flecha atrás (o cerrar en flujos modales), título de la pantalla y como máximo 2 acciones con icono; el resto en menú "Más" |
| **C-14** | Tras una acción correcta: mensaje breve inferior ("Producto guardado.") durante 4 s, excepto en pagos, que tienen pantalla de resultado propia |
| **C-15** | Formularios largos guardan borrador local sin datos sensibles. Al salir con cambios: "¿Salir sin guardar?" con "Salir" y "Seguir editando" |
| **C-16** | Todo formulario que recoge datos personales muestra bajo el botón primario: "Tratamos tus datos según nuestra Política de privacidad." con enlace a `/legal/privacy` (N-DAT-03) |
| **C-17** | Accesibilidad: objetivo táctil ≥ 48 dp, etiqueta semántica en todo icono-acción, orden de foco igual al visual, texto escalable a 200 % sin cortes |
| **C-18** | Sesión inactiva 5 min en móvil: pantalla de bloqueo con biometría. En POS y quiosco el tiempo es configurable |
| **C-19** | Pantallas con saldo o datos de pago no aparecen en capturas ni en el selector de apps |
| **C-20** | Exportar siempre ofrece CSV y PDF, con el rango de fechas y el filtro aplicado en el encabezado del archivo |
| **C-21** | Toda acción de arrastrar tiene una alternativa de un solo toque visible (N-STD-43) |
| **C-22** | La ayuda está siempre en el mismo lugar: última entrada del menú "Más" y fila "Ayuda y reclamos" en Mi cuenta (N-STD-44) |
| **C-23** | Un asistente no vuelve a pedir un dato ya capturado en el mismo proceso: lo precarga o lo ofrece para elegir (N-STD-45) |
| **C-24** | Los campos de contraseña y de códigos permiten pegar y autocompletar (N-STD-39) |
| **C-25** | Todo error no esperado se registra con pantalla, widget, traza de pila y las últimas acciones, y el usuario ve solo el mensaje y el código de soporte (`observability-standards.md` §13). Un widget que falla se reemplaza por `ErrorState` de su sección sin tumbar la pantalla |
| **C-26** | Cantidades con unidad: número, espacio y símbolo SI exacto (`2.5 kg`, `750 mL`); nunca plural ni punto (N-STD-21) |

## 4. Mensajes comunes por `reason`

| `reason` | Texto |
|---|---|
| `INVALID_CREDENTIALS` | Correo o contraseña incorrectos. |
| `ACCOUNT_LOCKED` | Demasiados intentos. Inténtalo de nuevo en {tiempo}. |
| `TOKEN_INVALID` | Tu sesión terminó. Inicia sesión de nuevo. |
| `PERMISSION_DENIED` | No tienes permiso para hacer esto. |
| `INSUFFICIENT_FUNDS` | Saldo insuficiente. |
| `AMOUNT_OUT_OF_RANGE` | El monto está fuera del límite permitido ({mín} – {máx}). |
| `AMOUNT_BELOW_FEES` | El monto es menor que las comisiones. |
| `STEP_UP_REQUIRED` | Confirma tu identidad para continuar. |
| `STEP_UP_INVALID` | No pudimos confirmar tu identidad. |
| `TENANT_NOT_ACTIVE` | Este negocio aún no puede cobrar. |
| `KYC_REQUIRED` | Verifica tu identidad para usar esta función. |
| `ACCOUNT_UNDER_REVIEW` | Tu cuenta está en revisión. Te avisaremos cuando termine. |
| `CONSENT_REQUIRED` | Necesitamos tu autorización para continuar. |
| `OUT_OF_STOCK` | No hay existencias suficientes. |
| `OUT_OF_DELIVERY_ZONE` | Esta tienda no entrega en esa zona. |
| `PRICE_CHANGED` | El precio cambió. Revisa el nuevo total. |
| `INVALID_STATE_TRANSITION` | Esta acción ya no está disponible. Actualiza la pantalla. |
| `RAIL_UNAVAILABLE` | Este método de pago no está disponible ahora. Prueba con otro. |
| `RATE_LIMITED` | Demasiados intentos. Espera un momento. |
| `MAINTENANCE_MODE` | Estamos en mantenimiento. Inténtalo más tarde. |
| `IDENTITY_UNAVAILABLE` | No pudimos conectarnos. Tu sesión sigue activa; inténtalo de nuevo. |

## 5. Requisitos funcionales por módulo

Cada requisito es verificable y cita las pantallas que lo cumplen.

| Id | Requisito | Pantallas |
|---|---|---|
| **RF-GEN-01** | Una persona crea una cuenta con nombre, correo y contraseña, aceptando términos y política de privacidad por separado | S-GEN-03 |
| **RF-GEN-02** | Una persona verifica su identidad para habilitar la billetera con dinero real (N-AML-02) | S-GEN-14 |
| **RF-GEN-03** | Un usuario ejerce acceso, rectificación, cancelación, oposición y portabilidad, y gestiona sus consentimientos | S-GEN-12, S-GEN-13 |
| **RF-GEN-04** | Un usuario registra un negocio y sigue el estado de su revisión | S-GEN-15 a S-GEN-18 |
| **RF-GEN-05** | La navegación muestra solo los módulos que el servidor habilita | S-GEN-05 |
| **RF-WAL-01** | Consultar saldo disponible, retenido y movimientos | S-WAL-01, S-WAL-08 |
| **RF-WAL-02** | Recargar, enviar y recibir dinero dentro de los límites del nivel de verificación | S-WAL-02 a S-WAL-04 |
| **RF-WAL-03** | Pagar en un comercio por QR, NFC o enlace, viendo el nombre verificado, el monto y toda comisión antes de confirmar | S-WAL-05 a S-WAL-07 |
| **RF-WAL-04** | Un pago sin respuesta del riel se muestra como "confirmando", nunca como fallido | S-WAL-07 |
| **RF-MKT-01** | Buscar productos de varios comercios, ver precio total, garantía, vendedor y política de devolución | S-MKT-01 a S-MKT-03 |
| **RF-MKT-02** | Comprar a varios comercios en un solo pago, con desglose por comercio | S-MKT-04, S-MKT-05 |
| **RF-MKT-03** | Seguir el pedido, cancelarlo, pedir devolución y abrir un reclamo | S-MKT-06 a S-MKT-08 |
| **RF-ORD-01** | El comercio acepta o rechaza cada sub-pedido dentro del plazo y lo prepara | S-ORD-01, S-ORD-02 |
| **RF-POS-01** | Abrir y cerrar caja con arqueo | S-POS-01, S-POS-10 |
| **RF-POS-02** | Vender con varios medios de pago, descuentos permitidos y descuentos legales | S-POS-02 a S-POS-04 |
| **RF-POS-03** | Emitir factura electrónica o recibo interno según la preferencia fiscal | S-POS-05 |
| **RF-POS-04** | Vender sin conexión en efectivo y sincronizar después | S-POS-02 |
| **RF-POS-05** | Devolver por líneas con nota de crédito | S-POS-08 |
| **RF-CAT-01** | Mantener productos con tratamiento fiscal, unidad de medida, garantía y código de barras válidos | S-CAT-02 |
| **RF-CAT-02** | Publicar en el marketplace solo productos con la información obligatoria | S-CAT-05 |
| **RF-INV-01** | Conocer existencias por bodega y lote, y todo movimiento con su motivo | S-INV-01 a S-INV-04 |
| **RF-INV-02** | Comprar a proveedores y recibir mercancía | S-INV-05 a S-INV-07 |
| **RF-LOG-01** | El comercio gestiona zonas, flota y despacho; el repartidor controla su turno, navega y registra la prueba de entrega; el cliente sigue sus entregas en vivo y confirma recepción con su código | S-LOG-01 a S-LOG-07, S-MKT-07, S-PUB-02 |
| **RF-FIN-01** | Ver cada cobro con su desglose de comisiones y reembolsarlo | S-FIN-02, S-FIN-03 |
| **RF-FIN-02** | Recibir liquidaciones en la cuenta del negocio según calendario | S-FIN-05, S-FIN-06 |
| **RF-FIN-03** | Emitir, consultar y corregir documentos fiscales; obtener el reporte mensual de ITBMS | S-FIN-07 a S-FIN-10 |
| **RF-PAY-01** | Registrar empleados con su contrato, salario y aportes | S-PAY-03 |
| **RF-PAY-02** | Marcar asistencia con método verificable y dentro de la geocerca | S-PAY-01, S-PAY-09 |
| **RF-PAY-03** | Calcular la nómina con extras, deducciones y aportes legales, aprobarla y pagarla | S-PAY-06, S-PAY-07 |
| **RF-PAY-04** | Calcular y pagar el décimo tercer mes y las vacaciones | S-PAY-06, S-PAY-08 |
| **RF-ANA-01** | Ver indicadores, pronósticos y alertas, y exportar registros para el contador | S-ANA-01 a S-ANA-08 |
| **RF-ADM-01** | Administrar datos del negocio, equipo, roles e integraciones | S-ADM-01 a S-ADM-08 |
| **RF-PLT-01** | La plataforma revisa negocios, opera cumplimiento, resuelve pagos inciertos y concilia | S-PLT-01 a S-PLT-09 |

## 6. Conexiones entre módulos

Lectura: el módulo de la fila **origina**; la celda dice qué pide al de la columna. "→" es llamada síncrona por el gateway; "⇢" es evento.

| Origen | Destino | Conexión |
|---|---|---|
| Billetera | Finanzas del comercio | Un pago capturado aparece como cobro (⇢ `PaymentCaptured`) |
| Billetera | Bandeja | Recibo y avisos de pago (⇢) |
| Comprar | Productos | Lee publicaciones, precio y garantía (→ catalog) |
| Comprar | Inventario | Reserva existencias al pagar (→ `ReserveStock`) |
| Comprar | Entregas | Cotiza tarifa y cobertura de envío por tienda antes de pagar (→ `QuoteDelivery`) |
| Comprar | Billetera | Un solo pago con reparto por comercio (→ payments, splits) |
| Comprar | Pedidos | Crea un sub-pedido por comercio (⇢ `OrderPaid`) |
| Pedidos | Entregas | Al marcar "listo" con envío, crea la entrega (→ `CreateDelivery`) |
| Pedidos | Finanzas | Rechazo o cancelación (o 3.er intento de entrega fallido) genera reembolso de su parte (→ `RefundPayment`) |
| Pedidos | Fiscal | Sub-pedido aceptado emite factura (→ `IssueInvoice`) |
| Caja | Productos | Precios y tratamiento fiscal (→ catalog, con caché sin conexión) |
| Caja | Inventario | Descuenta existencias al pagar (⇢ `SalePaid`) |
| Caja | Entregas | Venta con envío a domicilio cotiza tarifa y crea la entrega al pagarse (→ `QuoteDelivery`, `CreateDelivery`) |
| Caja | Billetera | Cada medio electrónico es un cobro (→ payments) |
| Caja | Fiscal | Emite factura o recibo interno (→ `IssueInvoice`) |
| Caja | Equipo | El cajero debe tener turno abierto si el comercio lo exige (→ payroll) |
| Inventario | Productos | Marca "agotado" en la publicación (⇢ `StockChanged`) |
| Inventario | Análisis | Sugerencias de reorden usan la velocidad de venta |
| Entregas | Geolocalización | Posición del repartidor en turno, geocercas y repartidor más cercano (→ geolocation) |
| Entregas | Pedidos / Caja | Cambia el estado del sub-pedido o venta con envío (⇢ `DeliveryStatusChanged`) |
| Equipo | Geolocalización | Marcaje dentro de la geocerca (→ `IsInside`) |
| Equipo | Billetera | Pago de nómina desde la billetera del negocio (→ payments, T10) |
| Finanzas | Billetera | Liquidación a la billetera del negocio (T6b) o a banco (T6) |
| Mi negocio | Todos | Roles y permisos deciden qué módulos y acciones existen |
| Plataforma | Todos | Banderas, límites y parámetros legales (`legal.pa.*`) |
| Todos | Bandeja | Avisos por evento (⇢ → notifications) |
| Todos | Análisis | Proyecciones de eventos (⇢ → analytics-bi) |

Regla de composición en la app: una feature no importa otra feature (`flutter-standards.md` §3). La conexión es por navegación con parámetros (`/finance/payments/{id}`) o por datos del servidor.

## 7. Contratos pendientes que esta especificación requiere

Rutas y RPC que hoy no existen. Se agregan de forma aditiva en F03.2 (contratos) y en el paso de cada módulo; hasta entonces su pantalla no se construye.

| Necesidad | Ruta propuesta | Dueño | Regla |
|---|---|---|
| Verificación de identidad del usuario | `POST /v1/me/kyc`, `GET /v1/me/kyc` | identity | N-AML-02, N-AML-03 |
| Consentimientos | `GET/PUT /v1/me/consents` | identity | N-DAT-02 |
| Solicitudes de derechos sobre datos | `GET/POST /v1/me/data-requests` | identity, security | N-DAT-05, N-DAT-07 |
| Límites vigentes del usuario | `GET /v1/me/limits` | payments-core | N-AML-03 |
| Beneficiarios finales del negocio | `GET/PUT /v1/business/beneficial-owners` | identity | N-AML-04 |
| Reclamos | `GET/POST /v1/complaints` | orders | N-CON-10 |
| Devolución de un pedido | `POST /v1/orders/{id}/returns` | orders | N-CON-03, N-CON-08 |
| Descuento legal en una venta | campo `legal_discount` en `CreateSale` | pos | N-CON-04 a N-CON-06 |
| Parámetros legales | `GET/PUT /v1/platform/legal-parameters` | infra-management | P1 |
| Cola de cumplimiento | `GET /v1/platform/compliance/cases`, `POST /{id}/resolve` | security | N-AML-05 a N-AML-07 |
| Solicitudes de datos (operador) | `GET /v1/platform/data-requests`, `POST /{id}/resolve` | security | N-DAT-05 |
| Reporte mensual de ITBMS | `GET /v1/fiscal/reports/itbms?period=` | fiscal-invoicing | N-FIS-11 |
| Décimo tercer mes y vacaciones | `POST /v1/payroll/runs` con `kind` | payroll | N-LAB-05, N-LAB-06 |
