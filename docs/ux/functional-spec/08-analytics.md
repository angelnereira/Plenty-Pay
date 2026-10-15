# Análisis

Módulo `analytics`. Paso F21.10. Convenciones: [`README.md`](README.md). Los datos son proyecciones de eventos: pueden tener minutos de retraso y cada pantalla muestra "Actualizado {fecha y hora}". Ninguna cifra de esta sección es la fuente de verdad contable; el reporte de ITBMS oficial está en S-FIN-10.

Todo gráfico tiene una tabla equivalente accesible con el botón "Ver como tabla" y nunca depende solo del color.

### S-ANA-01 · `/insights` · Indicadores
`analytics:read`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Hoy · Semana · Mes · Rango · Sucursal | Comparación con el período anterior equivalente |
| e2 | Tarjetas | Ventas · Número de ventas · Ticket promedio · Margen bruto · Clientes nuevos | Cada una: valor, variación con flecha y signo, minigráfico |
| e3 | Gráfico | Ventas por hora o por día | Según el rango |
| e4 | Listas | Productos más vendidos · Medios de pago · Cajeros | 5 filas y "Ver todo" |
| e5 | Tarjeta | Ingresos del año: {monto} | Al acercarse a B/. 36,000 sin ITBMS activo: "Estás cerca del límite para registrarte como contribuyente de ITBMS." (N-FIS-12) |

### S-ANA-02 · `/insights/ask` · Preguntar
`analytics:read`. Campo "Pregunta sobre tu negocio" con ejemplos tocables ("¿Qué vendí más la semana pasada?"). La respuesta muestra primero **cómo se interpretó** ("Ventas por producto, del 5 al 11 de octubre, todas las sucursales") con opción de corregir cada parte, y luego el resultado en tabla y gráfico. Pregunta no entendida: "No entendí la pregunta. Prueba con una de estas:" y sugerencias. No responde sobre datos de personas concretas.

### S-ANA-03 · `/insights/dashboards` · Tableros
`analytics:read`; editar con `analytics:dashboard:manage`. Lista de tableros; editor de cuadrícula (se reordena arrastrando o con los botones "Mover arriba" y "Mover abajo", C-21) con widgets (indicador, serie de tiempo, barras, tabla) elegidos del catálogo de métricas, cada uno con su filtro. Acciones: duplicar, compartir con roles, eliminar (C-05).

### S-ANA-04 · `/insights/products` · Productos
Tabla ABC: producto, unidades, ventas, margen, participación acumulada y clase (A, B, C). Filtros por categoría y sucursal. Lista "Sin movimiento en {30} días" con valor inmovilizado al costo.

### S-ANA-05 · `/insights/customers` · Clientes
Segmentos por recencia, frecuencia y monto: nombre del segmento, número de clientes, ventas. Solo cuenta clientes identificados en ventas. El detalle de un segmento lista clientes con nombre y totales, sin documento. Enviar una campaña a un segmento solo alcanza a quienes dieron consentimiento de mercadeo (N-DAT-02).

### S-ANA-06 · `/insights/forecast` · Pronóstico
Serie de ventas con pronóstico a 4 semanas y banda de intervalo; texto "Estimación basada en tus ventas pasadas. No es una garantía." Tabla de productos con fecha estimada de agotamiento y enlace a S-INV-08.

### S-ANA-07 · `/insights/alerts` · Alertas
`analytics:alert:manage`. Lista de reglas con interruptor. Editor: métrica, condición (mayor, menor, cambia más de {n} %), umbral, ventana, destinatarios (roles) y canales. Pestaña "Historial" con cada disparo, su valor y enlace al detalle. Reglas del sistema, no eliminables: caída de ventas atípica, diferencia de caja repetida, descuentos por encima de lo habitual por cajero.

### S-ANA-08 · `/insights/exports` · Exportes para el contador
`analytics:export` · Regla: N-COM-03

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Qué exportar | Diario de ventas · Cobros y comisiones · Liquidaciones · Devoluciones y notas · Inventario valorizado · Movimientos de inventario · Nómina por período |
| e2 | Selector | Rango de fechas | Máximo 366 días por archivo |
| e3 | Selector | Formato: CSV · PDF | CSV en UTF-8, fechas ISO 8601, montos en centavos y también con decimales, moneda en columna aparte |
| e4 | `PPButton.primary` | Generar | Se procesa en segundo plano; llega un aviso con el enlace, válido 7 días |
| e5 | Lista | Exportes recientes | Quién lo pidió y cuándo |

Los exportes con datos de personas (nómina) exigen además `payroll:employee:read` y son operación 🔒.
