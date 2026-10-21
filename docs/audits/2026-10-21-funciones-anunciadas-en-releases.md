# Auditoría: funciones anunciadas en los releases frente a la app actual (2026-10-21)

Pedida por el dueño del producto: las notas de los releases de GitHub describen funciones que ya no
se ven en la app. Se comparó el código de `flutter_app` en cada etiqueta (`v0.1.0` … `v0.3.0`) con
`main` (`4d503f7`): qué pantallas existen, cuáles se alcanzan desde la navegación, de dónde sacan sus
datos y qué commit cambió cada cosa.

## 1. Conclusión

1. **Casi nada se borró**: de 115 archivos de pantallas en v0.1.1 quedan todos menos 3 (hoy hay 131).
2. **Lo que se perdió de vista son pantallas con datos inventados.** Las notas de v0.1.0 y v0.1.1
   presentaron como funciones completas pantallas que **no llamaban a ningún servicio**: listas fijas
   en el código (p. ej. liquidaciones «Banco General **** 8912», facturas y contribuyentes de
   ejemplo), formularios que no enviaban nada y una nota de crédito que se «emitía» con un retardo de
   600 ms. Esta máquina es producción (AGENTS.md §3.1: «nada de simulaciones ni datos de
   demostración»), así que entre el 2026-10-20 y el 2026-10-21 se desconectaron o se reescribieron
   sobre servicios reales.
3. **Las notas de v0.1.0 y v0.1.1 sobrestimaron el avance.** Ejemplos verificados: en v0.1.1 la
   foto del producto solo se mostraba en el teléfono (`_productImageUrl = photo.path`, commit
   `fc08160`) y no se subía; hoy sí se sube (gateway `POST /v1/media/upload`) y se guarda con el
   producto. «Reclamos N-CON-10»: el formulario no enviaba el reclamo a ningún lado.
4. **Los servicios de los módulos ocultos no están desplegados**: fiscal-invoicing, settlement,
   payroll, logistics y analytics-bi no corren en producción.

## 2. Inventario

### 2.1 Módulos que pasaron a «Disponible próximamente»
Commit `2497f55` (2026-10-20, `ModuleDef.live`): un módulo sin servicio desplegado abre «Disponible
próximamente».

| Módulo (release que lo anunció) | Pantallas que siguen en el código | Servicio |
|---|---|---|
| Agenda (v0.2.0) | `features/appointments` | scheduling (F31), no desplegado |
| Logística: preparación, despacho, flota, geocercas, app de repartidor, POD con QR (v0.1.0, v0.1.1) | `features/logistics` | logistics, no desplegado |
| Nómina y asistencia: empleados, turnos, quiosco con QR y PIN, corridas, comprobantes (v0.1.0) | `features/payroll` | payroll, no desplegado |
| Analítica: KPIs, tableros, ABC, pronóstico, preguntas, exportaciones (v0.1.0) | `features/analytics` | analytics-bi, no desplegado |

### 2.2 Pantallas que se alcanzaban en v0.1.1 y hoy no tienen entrada
Ninguna llama a la API; las que muestran datos los tienen fijos en el código.

| Función anunciada | Pantalla | Desconectada en |
|---|---|---|
| Facturas DGI con CUFE, XML/PDF, notas de crédito/débito | `fiscal/invoices_screen.dart`, `fiscal/fiscal_profile_screen.dart` | `2497f55`, `9603e79` |
| Contribuyentes frecuentes RUC/DV | `finance/taxpayers_screen.dart` | `2497f55` |
| Reporte mensual de ITBMS (N-FIS-11) | `finance/tax_report_screen.dart` | `2497f55` |
| Lotes de liquidación y cuentas ACH | `finance/settlements_screen.dart`, `finance/payout_settings_screen.dart` | `2497f55` |
| Importación masiva CSV con vista previa | `catalog/catalog_import_screen.dart` | `9603e79` |
| Sugerencias de reorden, proveedores | `inventory/reorder_suggestions_screen.dart`, `inventory/suppliers_screen.dart` | `9603e79` |
| Ventas estacionadas, ajustes de caja | `pos/pos_parked_screen.dart`, `pos/pos_settings_screen.dart` | `9603e79` |
| Cola de pedidos (versión de catálogo) | `catalog/orders_screen.dart` | `9603e79` (la reemplaza `features/orders` real) |
| Auditoría encadenada, integraciones, privacidad del negocio, plantillas de avisos | `business/audit_log_screen.dart`, `integrations_screen.dart`, `business_privacy_screen.dart`, `notification_templates_screen.dart` | `aa89303` |

Además, 18 pantallas **nunca** tuvieron entrada, tampoco en v0.1.1 (p. ej. `PasswordRecoveryScreen`,
`LegalDocumentScreen`, `KioskClockScreen`, `AskQuestionScreen`, `MaintenanceScreen`).

### 2.3 Funciones que dejaron de existir

| Función (release) | Qué pasó | Commit |
|---|---|---|
| Tomar la foto del producto con la cámara (v0.1.1) | Hoy las fotos se suben y se guardan de verdad, pero solo desde la galería; la opción de cámara se quitó al reescribir el catálogo | `9603e79` |
| Carrito de catálogo y pantalla de reclamos (v0.1.0) | Borradas; el carrito real vive en `marketplace/cart_screen.dart`; reclamos no tiene servicio | `f77349e` |
| Devolución con nota de crédito en caja (v0.1.0) | Borrada: sin entrada y simulaba la nota de crédito | `407b33d` |
| Inicio con tarjetas de resumen (v0.1.0) | Reescrito: ~700 líneas de cifras inventadas reemplazadas por saldo y movimientos reales | `2497f55` |
| Recibir dinero con QR personal (v0.1.1) | Muestra «Todavía no disponible» hasta que exista el servicio | `2497f55` |

### 2.4 Lo que hoy funciona con datos reales
Billetera (saldo, movimientos, recarga y pago con QR en modo de prueba), puntos de cobro y cobros,
marketplace (vitrina, carrito, checkout, pedidos del comercio), catálogo, inventario, caja (venta,
cobro, movimientos de efectivo, pantalla del cliente), Mi negocio (perfil, sucursales, equipo, roles,
módulos), plataforma (flags, parámetros legales, pagos desconocidos, conciliación, cumplimiento),
escáner de cámara, fotos de productos (desde la galería), cierre de caja y recibos, y desde v0.3.0 la confirmación fuerte con PIN.

## 3. Opciones para recuperar lo perdido (decide el dueño del producto)

1. **Reconectar cada pantalla cuando su servicio esté desplegado** (la regla actual). Orden sugerido
   por impacto: cámara en la foto del producto (la subida ya funciona), facturación DGI (fiscal-invoicing; depende del PAC, Q-11), liquidación,
   nómina, logística, analítica.
2. **Mostrar las pantallas como vista previa sin datos**: entradas visibles con su estado vacío y la
   franja «Disponible próximamente», sin cifras inventadas. Cumple §3.1 y deja ver el diseño.
3. Volver a mostrar datos de ejemplo: **no recomendado**; contradice AGENTS.md §3.1 y engañó a
   personas reales (saldos y pagos «completados» que no existían).

## 4. Corrección (2026-10-21, mismo día)
La primera versión de esta auditoría decía que las fotos de productos ya no existían. Era falso: la
búsqueda usó `\|` dentro de una expresión `grep -E` y no encontró nada. Se repitió con la expresión
correcta; las demás filas se verificaron leyendo el código.

## 5. Estado del roadmap corregido
Al revisar por qué los módulos ocultos no tienen servicio, 33 pasos marcados ✅ el 2026-10-19 se
compararon con el nivel de verificación que exige `05-HOJA-DE-RUTA-30-FASES.md`. 25 no lo alcanzaban:
eran dominio con pruebas L1, sin servidor, sin `main` o sin despliegue (logistics, payroll, geolocation
y analytics-bi no tienen `main`; ninguno de los servicios de los módulos ocultos está en
`docker-compose.yml`). Se reabrieron como 📝 en `docs/roadmap/status.md`: F13.2, F13.4, F13.5, F13.6, F13.7, F13.8, F14.1, F14.2, F18.1, F18.2, F18.3, F18.4, F18.5, F18.6, F19.1, F19.2, F19.3, F19.4, F19.7, F20.2, F20.6, F21.9, F22.3, F23.4, F25.1.
Se mantienen los que exigen L1 y lo cumplen (F13.1, F20.1, F21.5, F21.7, F22.2, F23.1, F23.7) y F12.1
(migración aplicada y servicio compilando).

Consecuencia para reconectar los módulos: logística, nómina, analítica, liquidación y facturación
necesitan su servicio completo (servidor gRPC, almacenamiento, despliegue y rutas en el gateway), no
solo cablear pantallas.
