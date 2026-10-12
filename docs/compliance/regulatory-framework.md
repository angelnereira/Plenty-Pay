# Marco normativo y reglas de cumplimiento

Fuente de verdad de **qué normas panameñas y qué estándares internacionales gobiernan PlentyPay y en qué regla de negocio se convierte cada una**. Ninguna norma queda como texto informativo: cada una produce reglas con identificador `N-<área>-<nn>`, un contenedor responsable y las pantallas donde se hace visible ([`../ux/functional-spec/README.md`](../ux/functional-spec/README.md)).

> **Alcance y límites.** Este documento es una especificación de ingeniería, no asesoría legal. Se elaboró el 2026-10-12 a partir de las fuentes citadas en §14. Cada regla lleva su nivel de verificación. Antes de operar con dinero real, datos reales de nómina o facturación fiscal real, un abogado y un contador panameños deben validar las reglas marcadas ◐ y ⚠ (pasos F28.7 y F30.3).

## 1. Cómo se lee

| Marca | Significado | Qué puede hacer el código |
|---|---|---|
| ✔ | Confirmado en fuente oficial (DGI, SBP, MITRADEL, ANTAI, Gaceta Oficial) | Implementar tal cual |
| ◐ | Confirmado solo en fuentes secundarias (despachos, prensa, proveedores) | Implementar como **valor por defecto configurable**; no cerrar F28.7 sin confirmación |
| ⚠ | No verificado o fuentes en conflicto | Implementar el mecanismo, dejar el valor **sin defecto** o en modo sandbox, y citar la pregunta `Q-NN` |

## 2. Principios de diseño para cumplir por construcción

- **P1 — Los valores legales son datos con vigencia, no constantes.** Toda tasa, tope, plazo o porcentaje legal vive en `infra-management` como parámetro `legal.pa.*` con `effective_from` y `effective_to`. El cálculo usa el valor vigente **en la fecha del hecho** (fecha de la venta, del período de nómina), no en la fecha de ejecución. Un cambio de ley se despliega como dato, con auditoría, sin recompilar.
- **P2 — La regla vive en el servidor.** La app solo muestra el resultado y pide los datos que la regla necesita. Ningún cálculo legal se hace únicamente en el cliente.
- **P3 — Bloquear, advertir o registrar.** Cada regla declara su efecto: **B** bloquea la operación con un `reason`; **A** advierte y exige confirmación con motivo; **G** se registra para auditoría sin interrumpir.
- **P4 — Evidencia inmutable.** Toda operación con efecto legal guarda quién, cuándo, con qué versión del parámetro y qué documento la respalda. Nada financiero, fiscal o laboral se borra.
- **P5 — País como dimensión.** Las reglas son de Panamá (`PA`). El prefijo `legal.pa.` y el campo `country` permiten añadir otro país sin reescribir.
- **P6 — Sandbox visible.** Si falta una credencial, licencia o valor legal confirmado, la función opera en modo sandbox y la interfaz lo muestra (regla inviolable 12 de `AGENTS.md`).

## 3. Mapa de autoridades

| Autoridad | Materia | Afecta a |
|---|---|---|
| **DGI** (Dirección General de Ingresos, MEF) | ITBMS, ISR, ISC, factura electrónica (SFEP), RUC | fiscal-invoicing, pos, orders, catalog, payroll |
| **SBP** (Superintendencia de Bancos) | Prevención de blanqueo para emisores de medios de pago y dinero electrónico | identity, payments-core, ledger, settlement, security |
| **UAF** (Unidad de Análisis Financiero) | Recepción de reportes de operaciones sospechosas y de efectivo | payments-core, security |
| **ANTAI** (Dirección de Protección de Datos Personales) | Ley 81 de 2019 | todos los que guardan datos de personas |
| **MITRADEL** | Código de Trabajo, salario mínimo | payroll |
| **CSS** (Caja de Seguro Social) | Cuotas obrero-patronales, riesgos profesionales, planilla (SIPE) | payroll |
| **ACODECO** | Protección al consumidor, descuentos legales | catalog, orders, pos, marketplace |
| **MICI** / Panamá Emprende | Aviso de Operación; metrología (Consejo Nacional de Metrología, CENAMEP) | identity (KYB), catalog, inventory |
| **Registro Público** (Dirección Nacional de Firma Electrónica) | Firma electrónica calificada | identity, fiscal-invoicing |
| **ATTT** | Tránsito y transporte terrestre | logistics |

## 4. Fiscal (DGI)

Normas: Código Fiscal (ITBMS, art. 1057-V); Ley 256 de 2021 y Decreto Ejecutivo 766 de 2020 (factura electrónica); Resolución 201-6299 de 29 de julio de 2025 (deberes de los usuarios del SFEP); Ley 45 de 1995 (ISC).

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-FIS-01** | Toda línea de venta lleva una tasa de ITBMS de la lista `legal.pa.itbms.rates_bps` = {0, 700, 1000, 1500}. Por defecto 700. 1000 para bebidas alcohólicas y hospedaje; 1500 para derivados del tabaco. Una tasa fuera de la lista se rechaza | B `INVALID_TAX_RATE` | catalog, pos, orders | ✔ tasa general · ◐ asignación 10/15 % |
| **N-FIS-02** | Todo producto declara su tratamiento: `GRAVADO` (con tasa), `EXENTO` o `NO_SUJETO`. Sin tratamiento no se puede publicar ni vender | B | catalog | ◐ lista de exentos: Q-11 |
| **N-FIS-03** | El ITBMS se calcula **por línea** con `half_up` y se suma; nunca sobre el total (dominio §10.4). Con `tax_included=true` se extrae: `tax = total − round(total × 10000 / (10000 + bps))` | — | pos, orders | ✔ (regla interna coherente con la factura por línea) |
| **N-FIS-04** | Un comercio con perfil fiscal `PRODUCTION` emite documento fiscal por toda venta según su `CheckoutPreference`. Con `INTERNAL_ONLY` la app muestra un aviso permanente: el recibo interno no sustituye a la factura | A | fiscal-invoicing, pos | ◐ |
| **N-FIS-05** | Una factura solo es válida si tiene **CUFE**, **código QR** de verificación y autorización de uso del PAC o de la DGI. El recibo y el PDF no se entregan como "factura" antes de `ACCEPTED`; mientras tanto dicen "Comprobante en proceso de autorización" | B | fiscal-invoicing | ✔ |
| **N-FIS-06** | Tipos de documento admitidos: factura de operación interna, factura de exportación, factura de importación, nota de crédito, nota de débito. El MVP emite operación interna y notas | — | fiscal-invoicing | ◐ códigos exactos: Q-11 |
| **N-FIS-07** | El receptor se clasifica en `CONTRIBUYENTE`, `CONSUMIDOR_FINAL`, `GOBIERNO` o `EXTRANJERO`. `CONTRIBUYENTE` y `GOBIERNO` exigen RUC + DV válidos (N-FMT-06); `EXTRANJERO` exige identificación y país | B `FISCAL_RECEIVER_REQUIRED` | fiscal-invoicing, pos | ◐ |
| **N-FIS-08** | Una factura aceptada **no se edita ni se borra**. Se corrige solo con nota de crédito o débito que la referencia; la suma de notas de crédito no supera el total original | B `EXCEEDS_ORIGINAL` | fiscal-invoicing | ✔ |
| **N-FIS-09** | Si el PAC no responde, la venta no se pierde: el documento queda `QUEUED` y se reintenta. La app muestra "Factura pendiente de autorización". El plazo máximo de transmisión en contingencia es `legal.pa.fe.contingency_hours` | A | fiscal-invoicing | ⚠ plazo: Q-11 |
| **N-FIS-10** | Desde el 2026-01-01 el facturador gratuito de la DGI solo sirve a contribuyentes con facturación anual ≤ B/. 36 000 y ≤ 100 documentos al mes. PlentyPay siempre emite por PAC; el asistente de alta fiscal lo explica y pide el PAC contratado | G | fiscal-invoicing, admin | ◐ |
| **N-FIS-11** | El comercio obtiene un **reporte mensual de ITBMS** (débito por tasa, exento, notas, retenciones) que cuadra con las facturas aceptadas del período, para preparar el Formulario 430 (vence el día 15 del mes siguiente). PlentyPay no presenta la declaración | G | fiscal-invoicing, analytics-bi | ◐ |
| **N-FIS-12** | Al superar B/. 36 000 de ingresos anuales acumulados, un comercio sin ITBMS activado recibe una alerta: debe inscribirse como contribuyente de ITBMS | A | analytics-bi, notifications | ◐ |
| **N-FIS-13** | El ISC (bebidas, licores, cervezas, cigarrillos) es un impuesto del fabricante o importador; el comercio minorista lo recibe incluido en su costo. El MVP no lo calcula; el producto puede llevar la etiqueta informativa `isc_applies` | G | catalog | ◐ |
| **N-FIS-14** | PlentyPay factura sus propias comisiones a cada comercio con ITBMS (vector A del dominio) | — | fiscal-invoicing | ⚠ Q-07 |
| **N-FIS-15** | XML y PDF de cada documento se conservan `legal.pa.retention.fiscal_years` años (por defecto 5) en `object-storage`, con hash en la base | G | fiscal-invoicing | ⚠ Q-08 |

## 5. Prevención de blanqueo de capitales (SBP y UAF)

Normas: Ley 23 de 27 de abril de 2015 (modificada por Ley 21 de 2017 y Ley 70 de 2019); Decreto Ejecutivo 35 de 6 de septiembre de 2022; Acuerdo SBP 5-2015.

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-AML-01** | Emitir dinero electrónico exige estar registrado ante la SBP como sujeto obligado financiero (art. 22 de la Ley 23). Hasta tener el código de registro, la billetera opera solo en sandbox | B (flag `wallet.real_money`) | infra-management, payments-core | ✔ · Q-01 |
| **N-AML-02** | **Debida diligencia con independencia del monto.** Ninguna billetera recibe, envía o retira dinero real sin identidad verificada: nombre completo, documento (N-FMT-05), fecha de nacimiento, nacionalidad, dirección, ocupación y origen de fondos | B `KYC_REQUIRED` | identity | ✔ |
| **N-AML-03** | Niveles de cuenta: `KYC_0` (solo correo: explora y compra con riel externo), `KYC_1` (datos + documento: billetera con límites base), `KYC_2` (verificación reforzada: límites altos). Los topes viven en `legal.pa.aml.limits.*` | B `AMOUNT_OUT_OF_RANGE` | identity, payments-core | ◐ diseño propio · topes: Q-01 |
| **N-AML-04** | Comercios (KYB): RUC + DV, Aviso de Operación, pacto social o certificado del Registro Público, representante legal y **beneficiarios finales con ≥ 10 %** de participación, cada uno identificado | B (tenant no pasa a `ACTIVE`) | identity | ✔ umbral · Q-04 documentos |
| **N-AML-05** | **Atención especial** a toda operación individual o acumulada en 24 h superior a B/. 10 000: se marca, se exige origen de fondos y entra a la cola de cumplimiento | A + G | payments-core, security | ✔ |
| **N-AML-06** | Monitoreo de operaciones inusuales: fraccionamiento bajo umbrales, velocidad anómala, ida y vuelta inmediata, cuentas nuevas con volumen alto, cambio de dispositivo o ubicación. Cada regla genera un caso en la cola | G | payments-core, security | ◐ |
| **N-AML-07** | Un oficial de cumplimiento revisa cada caso y lo cierra como `SIN_NOVEDAD`, `SEGUIMIENTO` o `REPORTADO`. El reporte de operación sospechosa (ROS) se exporta para la UAF; **el cliente nunca es avisado** (ni la app ni soporte ven el estado) | B (confidencialidad) | security, platform | ✔ confidencialidad · ⚠ plazos: Q-18 |
| **N-AML-08** | Listas restrictivas: toda persona y comercio se coteja al alta y periódicamente contra listas de sanciones y de personas expuestas políticamente. Una coincidencia congela el alta hasta revisión | B | identity | ◐ proveedor: Q-09 |
| **N-AML-09** | Requerimientos de la UAF se responden en 15 días hábiles. La consola de cumplimiento exporta el expediente completo de un cliente (identidad, movimientos, dispositivos) en un solo paso | G | platform | ✔ |
| **N-AML-10** | Expedientes de identificación y registros de operaciones se conservan `legal.pa.retention.aml_years` años después de terminada la relación | G | identity, ledger | ⚠ Q-18 |
| **N-AML-11** | Segregación de fondos: el saldo de los usuarios se respalda 1:1 en cuenta bancaria separada del patrimonio de PlentyPay. El job I7 y la conciliación diaria (T5) lo prueban | G | ledger, settlement | ⚠ Q-01 |
| **N-AML-12** | Tenant y usuario bloqueados por cumplimiento no pueden mover dinero; el motivo que ve el usuario es genérico ("Tu cuenta está en revisión") | B `ACCOUNT_UNDER_REVIEW` | identity, payments-core | ✔ |

## 6. Protección de datos personales (ANTAI)

Normas: Constitución, art. 42; Ley 81 de 26 de marzo de 2019; Decreto Ejecutivo 285 de 28 de mayo de 2021.

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-DAT-01** | Cada tratamiento declara su **condición de licitud**: consentimiento, relación contractual, obligación legal, interés vital, interés público o interés legítimo. El registro vive en `security` (inventario de tratamientos) | G | security | ✔ |
| **N-DAT-02** | El consentimiento es **previo, inequívoco, informado y trazable**, y revocable sin efecto retroactivo. Se guarda: usuario, finalidad, versión del texto, fecha, canal, dispositivo. Casillas nunca premarcadas | B `CONSENT_REQUIRED` | identity | ✔ |
| **N-DAT-03** | Toda pantalla que recoge datos muestra la **cláusula informativa** (art. 14 del D.E. 285): responsable y contacto, finalidad, licitud, destinatarios, plazo de conservación, derechos y cómo ejercerlos, decisiones automatizadas | B (no se envía el formulario sin enlace visible) | flutter_app, web | ✔ |
| **N-DAT-04** | **Datos sensibles** (biometría facial y de huella, salud) exigen consentimiento expreso y separado. La biometría de marcaje no se envía al servidor en claro (payroll R1) y no se transfiere a terceros | B | payroll, security | ✔ |
| **N-DAT-05** | Derechos ARCO desde la app: **acceso** resuelto en ≤ 10 días hábiles; **rectificación** y **cancelación** en ≤ 5 días hábiles; oposición y portabilidad. Gratuitos y siempre respondidos | G con alerta de vencimiento | identity, security | ✔ |
| **N-DAT-06** | La cancelación no borra lo que otra ley obliga a conservar (fiscal, contable, blanqueo, laboral): esos datos se **bloquean** (inaccesibles para operación) hasta vencer su plazo, y se informa al titular | — | todos | ✔ principio de finalidad |
| **N-DAT-07** | Portabilidad: el titular descarga sus datos en formato estructurado y común (JSON y CSV) | G | identity | ✔ |
| **N-DAT-08** | Decisiones automatizadas con efecto sobre la persona (bloqueo antifraude, límites, puntuación) permiten pedir **revisión humana** | G | security, platform | ✔ |
| **N-DAT-09** | Violación de seguridad con riesgo significativo: se registra y se notifica a la ANTAI y a los titulares afectados. El plazo objetivo es `legal.pa.data.breach_notice_hours` | G | security | ✔ obligación · ⚠ plazo: Q-08 |
| **N-DAT-10** | Transferencia de datos a terceros: registro de cada transferencia (quién, motivo, qué datos, base, plazo). Los datos sensibles no se transfieren salvo autorización explícita u obligación legal | B | security | ✔ |
| **N-DAT-11** | Transferencia fuera de Panamá (nube de DR, proveedores) solo a destinos con protección equivalente o con garantías contractuales; se declara en la política de privacidad | G | infra, security | ✔ |
| **N-DAT-12** | Minimización: cada formulario pide solo los campos listados en la especificación de su pantalla. Un campo nuevo exige actualizar primero la especificación | — | flutter_app | ✔ |
| **N-DAT-13** | Oficial de protección de datos: voluntario para privados, pero la SBP lo ha exigido a sus regulados. PlentyPay lo designa y publica su contacto en `/legal/privacy` | G | web | ✔ |
| **N-DAT-14** | Menores: no se abre cuenta a menores de 18 años | B `AGE_REQUIREMENT` | identity | ◐ |
| **N-DAT-15** | Sanciones de referencia para dimensionar el riesgo: multas de B/. 1 000 a B/. 10 000, clausura de bases de datos y suspensión de la actividad | — | — | ✔ |

## 7. Laboral y seguridad social (MITRADEL y CSS)

Normas: Código de Trabajo; Decreto de Gabinete 221 de 1971 (décimo tercer mes); Ley 51 de 2005 modificada por Ley 462 de 2025 (CSS); Decreto Ejecutivo 13 de 31 de diciembre de 2025 (salario mínimo).

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-LAB-01** | Jornadas máximas: diurna 8 h/día y 48 h/semana; nocturna 7 h y 42 h; mixta 7,5 h y 45 h. El editor de turnos clasifica cada turno y advierte si lo excede | A | payroll | ✔ |
| **N-LAB-02** | Recargo de hora extraordinaria: **25 %** diurna; **50 %** nocturna o prolongación de jornada mixta iniciada de día; **75 %** prolongación de nocturna o de mixta iniciada de noche | — | payroll | ✔ |
| **N-LAB-03** | Límite de extras: 3 h por día y 9 h por semana. El excedente se paga con **75 %** y genera alerta al gerente | A | payroll | ✔ |
| **N-LAB-04** | Trabajo en día de descanso semanal, feriado o duelo nacional lleva recargo según `legal.pa.labor.holiday_surcharge_bps`. El calendario de feriados se mantiene como dato | — | payroll, infra-management | ⚠ Q-13 |
| **N-LAB-05** | **Décimo tercer mes**: un mes de salario al año en tres partidas, con pago el 15 de abril, 15 de agosto y 15 de diciembre. Base: salario, extras, comisiones, primas, vacaciones y bonificaciones del cuatrimestre. Pago tardío: recargo de 10 % | A (recordatorio 10 días antes) | payroll | ✔ fechas · ◐ recargo |
| **N-LAB-06** | **Vacaciones**: 30 días por cada 11 meses continuos (1 día por cada 11 trabajados). Se pagan por adelantado. Se acumulan como máximo 3 períodos. El saldo se muestra al empleado | A | payroll | ◐ |
| **N-LAB-07** | Cuota del **empleado** a la CSS: 9,75 % del salario; sobre el décimo tercer mes: 7,25 % | — | payroll | ◐ |
| **N-LAB-08** | Cuota del **empleador** a la CSS, escalonada por fecha: 13,25 % hasta febrero de 2027; 14,25 % desde marzo de 2027; 15,25 % desde marzo de 2029. Sobre el décimo tercer mes: 10,75 % | — | payroll | ◐ (ejemplo directo de P1) |
| **N-LAB-09** | **Seguro Educativo**: 1,25 % empleado y 1,50 % empleador | — | payroll | ◐ |
| **N-LAB-10** | **Riesgos profesionales**: prima a cargo del empleador según la clase de riesgo de la actividad. Sin valor por defecto: el comercio la registra desde su resolución de la CSS | B (no aprueba corrida sin valor) | payroll | ⚠ Q-13 |
| **N-LAB-11** | **ISR del asalariado** sobre renta neta anual: hasta B/. 11 000, 0 %; de 11 000 a 50 000, 15 % del excedente; más de 50 000, B/. 5 850 + 25 % del excedente. Retención proporcional por período | — | payroll | ◐ (una fuente discrepa: Q-13) |
| **N-LAB-12** | **Salario mínimo** por hora según actividad, tamaño de empresa, ocupación y región (2 regiones, 59 tasas; vigente desde el 2026-01-16). Un salario por debajo de la tasa aplicable bloquea guardar el empleado | B `BELOW_MINIMUM_WAGE` | payroll | ✔ estructura · ⚠ tabla: Q-13 |
| **N-LAB-13** | Cada pago entrega un **comprobante** con: período, horas ordinarias y extras por tipo, salario bruto, cada deducción con su tasa, aportes patronales y neto | B (no hay pago sin comprobante) | payroll | ◐ |
| **N-LAB-14** | El **registro de asistencia** es inmutable: una corrección es un nuevo evento con motivo y autor (payroll R4), nunca una edición | B | payroll | ✔ regla interna |
| **N-LAB-15** | La corrida exporta el detalle para la **planilla de la CSS (SIPE)**. PlentyPay no presenta la planilla | G | payroll | ⚠ formato y fecha: Q-13 |
| **N-LAB-16** | Repartidores y personal por servicios no son empleados por defecto: se registran con `engagement = EMPLOYEE` o `CONTRACTOR`. Solo `EMPLOYEE` entra a nómina | — | payroll, logistics | ⚠ Q-19 |

## 8. Protección al consumidor (ACODECO)

Normas: Ley 45 de 31 de octubre de 2007 y Decreto Ejecutivo 46 de 2009; Ley 6 de 16 de junio de 1987 (jubilados, pensionados y tercera edad); Ley 134 de 2013 (personas con discapacidad).

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-CON-01** | El consumidor paga **únicamente el precio informado**. El precio mostrado es el total con impuestos; cualquier cargo adicional (envío, comisión a cargo del cliente) aparece desglosado **antes** de confirmar | B `PRICE_CHANGED` | orders, pos, payments-core | ✔ |
| **N-CON-02** | Cada publicación informa: características, precio total, condiciones de entrega, garantía, identidad del vendedor (nombre comercial, RUC) y política de devolución | B (no se publica sin estos campos) | catalog | ✔ art. 36 |
| **N-CON-03** | **Garantía**: todo bien mueble nuevo tiene garantía de funcionamiento; el vendedor no la traslada al fabricante. La ficha exige `warranty_days` (0 solo en categorías sin garantía aplicable). El comprador abre un reclamo desde el pedido | B / G | catalog, orders | ✔ art. 41 |
| **N-CON-04** | **Descuento legal a jubilados, pensionados y tercera edad** (mujeres desde 55 años, hombres desde 60): 25 % en consumo individual en restaurantes, 15 % en comida rápida de franquicia, 20 % en medicamentos, y los demás de la ley. Tabla en `legal.pa.consumer.law6_discounts` por categoría | — | pos, catalog | ◐ |
| **N-CON-05** | El descuento legal se aplica **solo al consumo personal** del beneficiario, exige registrar tipo y número de documento, **no requiere** el permiso `pos:discount:apply`, no cuenta para el tope de descuentos del cajero y no se acumula con promociones: se aplica el más favorable al cliente | B `LEGAL_DISCOUNT_ID_REQUIRED` | pos | ◐ |
| **N-CON-06** | **Personas con discapacidad** (Ley 134): mismos mecanismos, con carné de SENADIS. Al alcanzar la edad de la Ley 6, rige esta | — | pos | ◐ |
| **N-CON-07** | **Ofertas**: una promoción muestra el precio anterior real (el más bajo de los últimos 3 meses) y el nuevo. El sistema calcula el precio de referencia desde el historial | B | catalog | ◐ art. 64 |
| **N-CON-08** | **Retracto**: en ventas a domicilio el consumidor revoca dentro de 3 días hábiles. Para compras en línea no hay norma general vigente: el marketplace aplica una política mínima propia de `policy.returns_days` | A | orders | ◐ art. 71 · ⚠ Q-20 |
| **N-CON-09** | Son nulas las cláusulas que reducen derechos del consumidor. Un comercio no puede configurar "no se aceptan devoluciones" para productos defectuosos | B | catalog | ✔ art. 40 |
| **N-CON-10** | Todo usuario presenta un **reclamo** desde un pedido, pago o venta, con número de caso y plazo de respuesta de `policy.complaint_response_days`. El historial es exportable para ACODECO | G | orders, notifications | ◐ |
| **N-CON-11** | La propina es voluntaria: se registra como línea separada, no lleva ITBMS y nunca se agrega sin acción del cliente | B | pos | ⚠ Q-21 |

## 9. Comercial, contable y documentos electrónicos

Normas: Código de Comercio; Ley 5 de 2007 (Aviso de Operación); Ley 52 de 2016 (registros contables); Ley 280 de 2021 (contador público autorizado); Ley 51 de 2008 y Ley 82 de 2012 (documentos y firma electrónica).

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-COM-01** | Un comercio no cobra sin Aviso de Operación vigente registrado en su KYB | B `TENANT_NOT_ACTIVE` | identity | ◐ Q-04 |
| **N-COM-02** | El ledger es de **doble entrada**, inmutable, con reverso como única corrección (invariantes I1–I7). Es el respaldo de los registros contables | — | ledger | ✔ |
| **N-COM-03** | El comercio exporta sus registros (diario de ventas, cobros, liquidaciones, inventario valorizado) en CSV y PDF para su contador. PlentyPay no es su libro oficial | G | analytics-bi | ◐ |
| **N-COM-04** | Conservación de registros contables: `legal.pa.retention.accounting_years` (por defecto 5) | G | todos | ⚠ Q-08 |
| **N-COM-05** | Los documentos electrónicos tienen validez legal si se garantiza su integridad y conservación: cada documento se guarda con hash SHA-256, marca de tiempo y registro de auditoría encadenado | G | security, object-storage | ✔ Ley 51 |
| **N-COM-06** | Aceptaciones de términos, consentimientos y aprobaciones usan firma electrónica simple (identidad autenticada + step-up + registro). La firma **calificada** del Registro Público solo se exige donde una norma lo pida (el PAC firma el documento fiscal) | — | identity | ✔ Ley 82 |
| **N-COM-07** | Informes financieros de PlentyPay bajo NIIF: el plan de cuentas del ledger separa pasivo con usuarios, ingresos por comisión e impuestos por pagar | — | ledger | ◐ |

## 10. Pagos

| Id | Norma o estándar → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-PAG-01** | **PCI DSS v4.0.1, alcance SAQ A**: PlentyPay nunca recibe, procesa ni almacena el número de tarjeta, CVV o banda. La captura ocurre en el componente del PSP; solo se guarda un token y los últimos 4 dígitos | B | payments-core, flutter_app | ✔ estándar · Q-03 |
| **N-PAG-02** | Moneda de curso legal: el **Balboa (PAB)** a la par del **dólar (USD)**. El ledger opera en `USD`; `PAB` se acepta solo como forma de presentación (B/.) | B `CURRENCY_MISMATCH` | ledger | ✔ |
| **N-PAG-03** | QR de cobro propio con URL. Si se adopta un estándar interoperable, será **EMVCo Merchant-Presented Mode**; el campo `qr_format` distingue ambos | — | payments-core | ⚠ Q-05 |
| **N-PAG-04** | Mensajería con bancos: archivos y APIs de liquidación se modelan con los datos de **ISO 20022** (identificador de extremo a extremo, referencia de remesa) para no perder información al integrar | — | settlement | ◐ Q-10 |
| **N-PAG-05** | Autenticación reforzada del pagador (step-up) alineada con **FIDO2/WebAuthn** y NIST SP 800-63B | B `STEP_UP_REQUIRED` | identity | ✔ |
| **N-PAG-06** | Toda comisión se muestra antes de confirmar y aparece en el recibo. No hay cargos ocultos (N-CON-01) | B | payments-core | ✔ |
| **N-PAG-07** | Cuentas bancarias de destino: banco de la lista vigente, tipo (corriente o ahorros), número y titular. El titular debe coincidir con el tenant o su representante | B `INVALID_DESTINATION` | settlement | ◐ |

## 11. Logística y metrología

| Id | Norma → regla de negocio | Efecto | Dueño | Estado |
|---|---|---|---|---|
| **N-LOG-01** | **Sistema Internacional de Unidades** obligatorio en actividades comerciales (Ley 52 de 2007). Toda cantidad se almacena en unidad SI o en `UNIT` (N-FMT-08) | B | catalog, inventory | ✔ |
| **N-LOG-02** | Por la transición cultural, la app puede **mostrar** además la unidad tradicional (lb, gal, oz) como equivalencia, siempre junto a la SI | — | flutter_app | ✔ |
| **N-LOG-03** | Repartidor registrado con: licencia de conducir vigente y su tipo, placa, tipo de vehículo, póliza de seguro y vencimientos. Un documento vencido impide asignarle entregas | B `DRIVER_DOCS_EXPIRED` | logistics | ◐ requisitos exactos: Q-19 |
| **N-LOG-04** | Productos restringidos por edad (alcohol, tabaco): la entrega exige verificar documento del receptor mayor de 18 años | B | logistics, catalog | ◐ |
| **N-LOG-05** | Medicamentos de venta con receta no se publican en el marketplace | B | catalog | ◐ |
| **N-LOG-06** | La ubicación del repartidor se recoge solo durante el turno activo y se conserva ≤ 90 días en detalle (N-DAT-12) | B | geolocation | ✔ regla interna |
| **N-LOG-07** | Alimentos con vencimiento: lote y fecha obligatorios; salida FEFO; un lote vencido no se vende | B | inventory, pos | ◐ |

## 12. Formatos y estándares internacionales

Regla general: **se almacena en el formato del estándar y se presenta en el formato local**. El detalle de cada estándar, con su edición, fuente y reglas `N-STD-…`, está en [`international-standards.md`](international-standards.md); esta tabla es el resumen.

| Id | Dato | Almacenamiento (estándar) | Presentación `es_PA` |
|---|---|---|---|
| **N-FMT-01** | Moneda | ISO 4217: `USD`; entero en centavos | `$1,234.56` o `B/. 1,234.56`. Separador decimal punto, miles coma. Negativo `−$12.00` |
| **N-FMT-02** | Fecha e instante | ISO 8601 / RFC 3339 en UTC | `10 oct 2026, 2:03 p. m.` en hora de Panamá, con el mes siempre en texto; nunca una fecha solo con números (N-STD-10) |
| **N-FMT-03** | Zona horaria | IANA `America/Panama` (UTC−5, sin horario de verano) | Nunca se muestra otra zona |
| **N-FMT-04** | País y subdivisión | ISO 3166-1 alfa-2 (`PA`); ISO 3166-2 para provincias y comarcas; código de ubicación provincia-distrito-corregimiento para la factura | Nombres oficiales |
| **N-FMT-05** | Cédula | Texto normalizado `P-T-A`: provincia `1`–`13` o prefijo `E`, `N`, `PE`, `PI`, `AV`; tomo; asiento | `8-926-1601` |
| **N-FMT-06** | RUC y DV | RUC: persona natural = cédula; jurídica = `rollo-folio-asiento` del Registro Público; extranjero con prefijo `NT`. DV: 2 dígitos | `2588017-1-831938 DV 20`. Algoritmo del DV: Q-22 |
| **N-FMT-07** | Teléfono | ITU-T E.164: `+507` + 8 dígitos (móvil) o 7 (fijo) | `+507 6123-4567` |
| **N-FMT-08** | Unidad de medida | Código UN/CEFACT Rec. 20: `KGM`, `GRM`, `LTR`, `MLT`, `MTR`, `CMT`, `MTK`, `C62` (unidad) | Símbolo SI: kg, g, L, mL, m, cm, m², ud |
| **N-FMT-09** | Código de producto | GS1 GTIN-8/12/13/14 con dígito de control validado | Tal cual |
| **N-FMT-10** | Clasificación de producto | Código de la Codificación Panameña de Bienes y Servicios cuando la factura lo exija | Q-11 |
| **N-FMT-11** | Idioma | BCP 47: `es-PA`, `en` | — |
| **N-FMT-12** | Texto | UTF-8, normalización NFC | — |
| **N-FMT-13** | Coordenadas | WGS 84 (EPSG:4326), grados decimales | — |
| **N-FMT-14** | Correo | RFC 5321/5322, en minúsculas | — |
| **N-FMT-15** | Dirección | Provincia, distrito, corregimiento, calle o referencia, punto en el mapa. Panamá no usa código postal de forma general: el campo es opcional | — |
| **N-FMT-16** | QR y NFC | ISO/IEC 18004 (QR); NFC Forum NDEF con registro URI | — |

Estándares transversales adoptados:

| Estándar | Uso en PlentyPay |
|---|---|
| ISO/IEC 27001:2022 y 27002 | Marco de controles de seguridad (F28.7) |
| OWASP ASVS y MASVS | Verificación de seguridad del backend y de la app |
| WCAG 2.2 nivel AA | Accesibilidad de toda pantalla (F25.1) |
| ISO 22301 | Continuidad: RPO ≤ 5 min, RTO ≤ 1 h |
| 40 Recomendaciones del GAFI | Base de N-AML |
| NIIF | Presentación financiera (N-COM-07) |
| Incoterms 2020 | Solo si se habilita venta transfronteriza (fuera del MVP) |

## 13. Parámetros legales (`legal.pa.*`)

Todos con `effective_from` y auditoría de cambio (P1). "—" significa sin valor por defecto: la función queda bloqueada o en sandbox hasta cargarlo.

| Clave | Valor inicial | Estado |
|---|---|---|
| `legal.pa.itbms.rates_bps` | `[0, 700, 1000, 1500]` | ✔ |
| `legal.pa.itbms.registration_threshold_minor` | `3600000` (anual) | ◐ |
| `legal.pa.fe.contingency_hours` | — | ⚠ Q-11 |
| `legal.pa.aml.special_attention_minor` | `1000000` | ✔ |
| `legal.pa.aml.beneficial_owner_bps` | `1000` | ✔ |
| `legal.pa.aml.limits.kyc1.balance_minor` | `500000` | ⚠ Q-01 |
| `legal.pa.aml.limits.single_charge_minor` | `1000000` | ⚠ Q-01 |
| `legal.pa.data.arco_access_business_days` | `10` | ✔ |
| `legal.pa.data.arco_rectify_business_days` | `5` | ✔ |
| `legal.pa.data.breach_notice_hours` | `72` (objetivo interno) | ⚠ Q-08 |
| `legal.pa.labor.day_shift_max_minutes` / `night` / `mixed` | `480` / `420` / `450` | ✔ |
| `legal.pa.labor.week_max_minutes` día / noche / mixta | `2880` / `2520` / `2700` | ✔ |
| `legal.pa.labor.overtime_bps` día / noche / noche-prolongada | `2500` / `5000` / `7500` | ✔ |
| `legal.pa.labor.overtime_max_minutes` día / semana | `180` / `540` | ✔ |
| `legal.pa.labor.holiday_surcharge_bps` | — | ⚠ Q-13 |
| `legal.pa.labor.thirteenth_month_dates` | `04-15`, `08-15`, `12-15` | ✔ |
| `legal.pa.labor.vacation_days_per_11_months` | `30` | ◐ |
| `legal.pa.css.employee_bps` | `975` | ◐ |
| `legal.pa.css.employer_bps` | `1325` hasta 2027-02-28 · `1425` desde 2027-03-01 · `1525` desde 2029-03-01 | ◐ |
| `legal.pa.css.thirteenth.employee_bps` / `employer_bps` | `725` / `1075` | ◐ |
| `legal.pa.se.employee_bps` / `employer_bps` | `125` / `150` | ◐ |
| `legal.pa.css.professional_risk_bps` | — (por tenant) | ⚠ Q-13 |
| `legal.pa.isr.brackets` | `[0–1100000: 0]`, `[1100000–5000000: 1500 bps]`, `[> 5000000: 585000 + 2500 bps]` | ◐ |
| `legal.pa.labor.minimum_wage_table` | — | ⚠ Q-13 |
| `legal.pa.labor.holidays` | — (calendario anual) | ⚠ Q-13 |
| `legal.pa.consumer.law6_discounts` | restaurante `2500`, comida rápida `1500`, medicamentos `2000` | ◐ |
| `legal.pa.consumer.law6_age` | mujer `55`, hombre `60` | ◐ |
| `legal.pa.consumer.reference_price_days` | `90` | ◐ |
| `legal.pa.retention.fiscal_years` / `accounting_years` / `aml_years` | `5` / `5` / `5` | ⚠ Q-08, Q-18 |

## 14. Fuentes consultadas (2026-10-12)

Oficiales:
- DGI — [ITBMS, preguntas frecuentes](https://dgi.mef.gob.pa/Preguntas/Itbms.php) · [RUC](https://dgi.mef.gob.pa/Preguntas/ruc.php) · [Comunicado sobre la Ley 256](https://dgi.mef.gob.pa/New/news?n=138) · [Facturador gratuito, guía f-10](https://dgi.mef.gob.pa/_7facturaelectronica/source/f-10.pdf)
- SBP — [Resolución 00096-2025](https://www.superbancos.gob.pa/documentos/leyes_y_regulaciones/resolucion_prevencion_REDEMP/2025/Resolucion_00096-2025.pdf) · [Acuerdo 5-2015 compilado](https://www.superbancos.gob.pa/documentos/leyes_y_regulaciones/acuerdos/2017/Compilado_Acuerdo_05-2015.pdf) · [Guía de operaciones sospechosas](https://www.superbancos.gob.pa/documentos/leyes_y_regulaciones/circulares/2019/guia_operaciones_sospechosas.pdf)
- MEF — [Ley 23 de 2015](https://cnbc.mef.gob.pa/wp-content/uploads/2022/10/ley-23-de-2015.pdf) · [Ley 52 de 2016](https://cnbc.mef.gob.pa/wp-content/uploads/2022/10/ley-52-de-2016.pdf)
- ANTAI — [Guía para el sector privado, junio de 2023](https://www.antai.gob.pa/wp-content/uploads/2024/01/GUIA-SECTOR-PRIVADO-1.pdf)
- Gaceta Oficial — [Decreto Ejecutivo 285 de 2021](https://www.gacetaoficial.gob.pa/pdfTemp/29296_A/GacetaNo_29296a_20210528.pdf)
- MITRADEL — [Boletín de prestaciones laborales](https://mitradel.gob.pa/wp-content/uploads/2019/12/BOLETIN-DE-PRESTACIONES-LABORALES.docx)
- OCDE — [Panama TIN](https://www.oecd.org/tax/automatic-exchange/crs-implementation-and-assistance/tax-identification-numbers/Panama-TIN.pdf)
- Ministerio Público — [Ley 51 de 2008](https://ministeriopublico.gob.pa/wp-content/uploads/2016/06/Ley_No_51.pdf)

Secundarias (reglas ◐):
- [PwC, Decreto Ejecutivo 35 de 2022](https://pwc.com/ia/es/publicaciones/Noticias-Tax-Legal/Tax-and-Legal-2022/Tax-and-Legal-News-Decreto-Ejecutivo-35-de-2022-que-reglamenta-la-Ley-23-de-2015.pdf)
- [Morgan & Morgan, Ley 462 de 2025](https://morimor.com/es/la-ley-462-del-18-de-marzo-de-2025-introduce-varias-reformas-importantes-a-la-caja-de-seguro-social-css-de-panama) · [TVN, aumento escalonado de la cuota patronal](https://www.tvn-2.com/nacionales/reformas-a-la-css-aumento-escalonado-cuota-patronal-caja-de-seguro-social_1_2182102.html)
- [EY, salario mínimo 2026](https://www.ey.com/es_ce/technical/tax/tax-alerts/panama-salario-minimo-2026)
- [EDICOM, factura electrónica en Panamá](https://edicomgroup.com/es/blog/estado-factura-electronica-panama) · [Alegra, cómo emitir factura electrónica](https://blog.alegra.com/panama/como-emitir-factura-electronica-en-panama/) · [Sovos, cumplimiento en Panamá](https://sovos.com/es/iva/reglas-fiscales/cumplimiento-del-iva-en-panama/)
- [La Estrella, sistema tributario](https://www.laestrella.com.pa/economia/sistema-panameno-tributario-EWLE94060) · [La Estrella, décimo tercer mes](https://www.laestrella.com.pa/economia/como-calcular-el-decimo-tercer-mes-en-panama-guia-y-ejemplos-BP21487372) · [Panamá América, recargo por décimo tardío](https://panamaamerica.com.pa/economia/decimos-pagados-fuera-de-fecha-deben-tener-recarga-del-10-1225533)
- [La Prensa, descuentos a jubilados](https://www.prensa.com/economia/descuentos-de-hasta-50-acodeco-recuerda-beneficios-para-jubilados-y-reporta-incumplimientos/) · [TVN, cuándo aplica el descuento](https://www.tvn-2.com/nacionales/aplica-descuento-jubilados-panama-dice_1_2240320.html)
- [Panamá América, retracto en la relación de consumo](https://www.panamaamerica.com.pa/opinion/el-retracto-legal-convencional-y-voluntario-en-la-relacion-de-consumo-1132288) · [Texto de la Ley 45 de 2007](https://axl.cefan.ulaval.ca/amsudant/panama-loi-consom2007.htm)
- [Panamá América, transición a kilogramos](https://panamaamerica.com.pa/sociedad/de-libras-kilogramos-una-transicion-necesaria-para-el-comercio-local-1244093)

No se encontró fuente para: plazo de notificación de violaciones de datos; plazos de conservación y de reporte de la Ley 23; algoritmo oficial del DV; códigos de receptor y plazo de contingencia de la factura electrónica; tabla de riesgos profesionales; tabla de salario mínimo; requisitos de la ATTT para repartidores; régimen de la propina. Cada uno está registrado en [`../open-questions.md`](../open-questions.md).
