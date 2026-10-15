# Equipo, asistencia y nómina

Módulo `payroll`. Paso F19.8 salvo indicación. Convenciones: [`README.md`](README.md). Estados de la corrida: [`../../domain/domain-model.md`](../../domain/domain-model.md) §8.14. Todas las tasas salen de los parámetros `legal.pa.*` vigentes en el período ([`../../compliance/regulatory-framework.md`](../../compliance/regulatory-framework.md) §13); la interfaz las muestra pero no permite editarlas.

### S-PAY-01 · `/team/clock` · Marcar asistencia
`payroll:attendance:record` · Reglas: N-LAB-14, N-DAT-04

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Reloj | {hora} · {fecha} | Hora del servidor; la del dispositivo solo se usa sin conexión y queda marcada |
| e2 | Estado | Estás {dentro / fuera} de turno · Entrada a las {hora} | — |
| e3 | `PPButton.primary` | Marcar entrada / Iniciar descanso / Terminar descanso / Marcar salida | Sigue la secuencia válida; no ofrece una acción fuera de orden |
| e4 | Método | Escanear QR del quiosco · Acercar a la etiqueta NFC · Rostro · PIN | Solo los que el negocio activó |
| e5 | Ubicación | Estás en {sucursal} / Estás fuera de la zona | Fuera de zona: se acepta con el aviso "Tu marcaje quedará en revisión." |
| e6 | Resumen | Hoy: {h} h {m} min · Semana: {h} h | — |

Marcar con rostro exige el consentimiento de biometría; sin él se ofrece otro método. Marcaje repetido en menos de 60 s se ignora sin error.

### S-PAY-02 · `/team/me` · Mis marcajes y comprobantes
`payroll:payslip:read:self`. Pestaña "Marcajes": calendario del mes y lista por día con entrada, descansos, salida, horas y marca "En revisión". Botón "Pedir corrección" (día, hora correcta, motivo): crea una solicitud al gerente. Pestaña "Comprobantes": lista por período con neto; toca → comprobante (S-PAY-08). Pestaña "Vacaciones": días acumulados, tomados y disponibles, y próxima fecha en que completa un período.

### S-PAY-03 · `/team/employees`, `/team/employees/:id` · Empleados
`payroll:employee:read` / `manage` · Reglas: N-LAB-10, N-LAB-12, N-LAB-16, N-DAT-04, N-FMT-05

| Sección | Campo | Validación |
|---|---|---|
| Persona | Usuario de PlentyPay (opcional) · Nombre · Cédula · Fecha de nacimiento · Teléfono · Dirección | Cédula con formato válido; se guarda cifrada y se muestra enmascarada |
| Seguridad social | Número de seguro social | Obligatorio para vínculo "Empleado" |
| Contrato | Vínculo: Empleado / Contratista · Tipo: Indefinido / Definido / Obra · Fecha de ingreso · Fecha de fin (si aplica) · Cargo · Sucursal | Solo "Empleado" entra a nómina |
| Salario | Modalidad: Por hora / Mensual fijo · Monto · Frecuencia de pago: Semanal / Quincenal / Mensual | Debajo: "Salario mínimo aplicable: {tasa} por hora ({actividad}, {región}, {tamaño})". Por debajo: `BELOW_MINIMUM_WAGE` "El salario es menor al mínimo legal." |
| Jornada | Tipo: Diurna / Nocturna / Mixta · Turno habitual | — |
| Aportes | Clase de riesgo profesional y prima (%) | Del negocio; solo lectura aquí |
| Deducciones adicionales | Concepto · monto o % · vigencia | Préstamos, pensión alimenticia, embargos. Requieren documento de respaldo |
| Marcaje | Métodos permitidos · PIN · Geocerca · Rostro: Enrolar | Enrolar rostro abre el consentimiento que firma **el empleado** en su propia sesión o en el quiosco |
| Estado | Activo / Inactivo · Fecha y motivo de salida | Un empleado no se borra |

### S-PAY-04 · `/team/schedule` · Turnos y calendario
`payroll:employee:manage` · Reglas: N-LAB-01, N-LAB-04

Vista semanal: filas = empleados, columnas = días. Arrastrar un turno a una celda lo asigna; tocar una celda abre "Asignar turno" con la misma función (C-21). Editor de turno: nombre, hora de inicio y fin (`HH:MM`), descanso en minutos, y el sistema lo clasifica como Diurno, Nocturno o Mixto. Avisos en la celda:
- "Supera la jornada máxima de {8} horas." (por tipo de jornada)
- "Supera {48} horas en la semana."
- "Feriado: {nombre}. Este día lleva recargo." (del calendario de feriados)

Los avisos no bloquean guardar; el exceso se calcula como hora extra.

### S-PAY-05 · `/team/attendance` · Asistencia
`payroll:attendance:read`. Filtros: rango, sucursal, empleado, "Solo en revisión". Tabla por día: entrada, salida, descansos, horas ordinarias, horas extra por tipo (25 %, 50 %, 75 %), marcas ("Fuera de zona", "Sin conexión", "Corregido"). Bandeja "Por revisar": cada marcaje en revisión con mapa y método; acciones "Aceptar" y "Corregir" (hora, motivo obligatorio). Una corrección agrega un evento nuevo con autor; el original sigue visible tachado.

Aviso por empleado cuando la semana supera 9 horas extra o un día supera 3: "Excede el límite legal de horas extra. El excedente se paga con 75 %."

### S-PAY-06 · `/team/runs` · Corridas de nómina
`payroll:run:create` · Reglas: N-LAB-05, N-LAB-06

Lista: período, tipo, empleados, bruto, neto, `StatusChip` (Borrador, Aprobada, Pagando, Pagada, Con pagos fallidos). Botón primario "Nueva corrida":

| Campo | Opciones |
|---|---|
| Tipo | Salarios · Décimo tercer mes · Vacaciones · Liquidación |
| Período | Salarios: según la frecuencia. Décimo: partida de abril, agosto o diciembre (el período del cuatrimestre se fija solo) |
| Empleados | Todos los activos del período, con casillas |

Tarjeta de recordatorio 10 días antes del 15 de abril, 15 de agosto y 15 de diciembre: "El décimo tercer mes se paga el {fecha}." con botón "Preparar corrida".

### S-PAY-07 · `/team/runs/:id` · Detalle de la corrida
`payroll:run:approve` 🔒 · `payroll:run:pay` 🔒 · Reglas: N-LAB-02, N-LAB-03, N-LAB-07 a N-LAB-11, N-LAB-13, N-LAB-15

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | {Tipo} · {período} · `StatusChip` | — |
| e2 | Totales | Bruto · Deducciones del empleado · **Neto a pagar** · Aportes del empleador · **Costo total** | — |
| e3 | Tabla por empleado | Horas ordinarias · Extras · Bruto · CSS · Seguro Educativo · ISR · Otras · Neto | Toca: abre el comprobante en borrador (S-PAY-08) |
| e4 | Alertas | Marcajes en revisión · Empleados sin prima de riesgo · Salarios bajo el mínimo · Exceso de horas extra | Las dos primeras impiden aprobar |
| e5 | Tasas aplicadas | CSS empleado {9.75 %} · CSS empleador {13.25 %} · Seguro Educativo {1.25 % / 1.50 %} · Riesgo profesional {x %} · vigentes al {fecha} | Solo lectura, con enlace "Ver fuente" |
| e6 | Saldo | Saldo de la billetera del negocio: {monto} | Menor que el neto: "Recarga {faltante} antes de pagar." |
| e7 | `PPButton.primary` | Recalcular → Aprobar → Pagar {neto} | Según estado. Aprobar y pagar: C-05 + S-GEN-21. Aprobada ya no se edita |
| e8 | Acciones | Exportar para planilla de la CSS · Exportar detalle · Descargar comprobantes | Tras aprobar |

Pagos fallidos: lista con el motivo y botón "Reintentar fallidos". La pantalla nunca permite pagar dos veces al mismo empleado en la misma corrida.

### S-PAY-08 · comprobante de pago
`payroll:payslip:read:self` o `payroll:employee:read` · Regla: N-LAB-13

Documento de solo lectura, descargable en PDF. Contenido en orden: empleador (razón social, RUC), empleado (nombre, cédula enmascarada, seguro social, cargo), período y fecha de pago; **ingresos** (salario ordinario con horas y tarifa; horas extra por tipo con cantidad, recargo y monto; recargo por feriado o descanso; comisiones y bonificaciones); **deducciones** (cada una con su base y su tasa: Seguro Social, Seguro Educativo, Impuesto sobre la renta, otras); **neto pagado** en `displayMoney`; **aportes del empleador** (informativo); saldo de vacaciones; medio de pago y referencia.

### S-PAY-09 · `/kiosk/:session` · Quiosco de marcaje
Sesión de quiosco · Pasos F19.8, F24.5. Pantalla completa, sin navegación, tema oscuro.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Reloj grande | {hora} | — |
| e2 | `QrView` | Escanea con tu app | Cambia cada 30 s |
| e3 | `PPButton.secondary` | Marcar con mi rostro | Cámara con prueba de vida. La comparación ocurre en el dispositivo |
| e4 | `PPButton.secondary` | Marcar con PIN | `PinPad`; 3 errores bloquean ese PIN 5 minutos |
| e5 | Confirmación | {nombre}: entrada registrada a las {hora} | 3 s y vuelve al reposo. No muestra otros datos del empleado |
| e6 | Indicador | Sin conexión: {n} marcajes guardados | — |

Salir del quiosco exige el PIN de un gerente.
