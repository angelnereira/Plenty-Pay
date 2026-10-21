# Catálogo de pantallas (app Flutter única)

Fuente de verdad de **qué pantallas existen, para quién, con qué permiso y de qué datos se alimentan**. Cada pantalla implementa los 4 estados (`flutter-standards.md` §4), cumple estrictamente la regla de diseño [`docs/gravital-experience-ui.md`](../gravital-experience-ui.md) (`gravital-experience-ui`), usa componentes de `docs/design-system.md` y llama solo a rutas de `api-gateway/SPEC.md` §4. La columna *Paso* indica en qué paso del roadmap se construye.

El detalle de cada pantalla (elementos, textos, validaciones, flujos y estados) está en [`functional-spec/`](functional-spec/README.md), con un identificador `S-<módulo>-<nn>` por pantalla.

## 1. Módulos y navegación
Orden de navegación (= orden de `identity` R10 y de `ModuleRegistry`):

| # | id | Etiqueta (es) | Icono (Material Symbols) | Visible si | Ruta raíz | Paso |
|---|---|---|---|---|---|---|
| 1 | `wallet` | Billetera | `account_balance_wallet` | algún `wallet:*` | `/wallet` | F11.9 |
| 2 | `marketplace` | Comprar | `storefront` | `orders:create:self`/`orders:read:self` | `/market` | F15.10 |
| 3 | `pos` | Caja | `point_of_sale` | algún `pos:*` | `/pos` | F17.10 |
| 4 | `appointments` | Agenda | `calendar_month` | algún `appointments:*` | `/appointments` | F31.1 |
| 5 | `catalog` | Productos | `inventory_2` | `catalog:write`/`import`/`listing:manage`/`pricelist:manage` | `/catalog` | F15.10 |
| 6 | `inventory` | Inventario | `warehouse` | algún `inventory:*` | `/inventory` | F16.7 |
| 7 | `orders` | Pedidos | `receipt_long` | `orders:read`/`orders:manage`/`orders:quote:manage` | `/orders` | F15.10 |
| 8 | `logistics` | Entregas | `local_shipping` | algún `logistics:*` | `/logistics` | F18.7 |
| 9 | `finance` | Finanzas | `payments` | algún `payments:*`, `settlement:*`, `fiscal:*` | `/finance` | F11.9/F12.8/F13.9 |
| 10 | `payroll` | Equipo | `badge` | algún `payroll:*` | `/team` | F19.8 |
| 11 | `analytics` | Análisis | `insights` | algún `analytics:*` | `/insights` | F21.10 |
| 12 | `admin` | Mi negocio | `tune` | algún `admin:*` | `/business` | F08.8 |
| 13 | `platform` | Plataforma | `admin_panel_settings` | algún `platform:*` | `/platform` | F05.9/F08.8/F12.8 |

Fuera de los módulos (siempre disponibles con sesión): Inicio (`/`), Bandeja (`/inbox`), Cuenta (`/account`). Inicio muestra tarjetas según módulos visibles (saldo, ventas de hoy, pedidos por aceptar, entregas activas, alertas).

**Navegación**: < 600 dp barra inferior con Inicio + hasta 3 módulos más usados + "Más"; 600–1024 `NavigationRail`; > 1024 rail extendido. Un módulo en una fase aún no construida se muestra con la pantalla "Disponible próximamente" (`ModuleDef.phase`).

## 2. Transversales (F02, F08)
| Ruta | Pantalla | Quién | Datos (gateway) | Notas | Paso |
|---|---|---|---|---|---|
| `/welcome` | Bienvenida | sin sesión | `GET /v1/client-config` | elegir: entrar / crear cuenta | F02.6 |
| `/login` | Iniciar sesión | sin sesión | `POST /v1/auth/login` | error único `INVALID_CREDENTIALS`; bloqueo muestra tiempo | F02.6 |
| `/register` | Crear cuenta | sin sesión | `POST /v1/auth/register` | nombre, correo, contraseña ≥ 12 con medidor | F02.6 |
| `/forgot`, `/reset/:token` | Recuperar contraseña | sin sesión | `/v1/auth/password/*` | mensaje idéntico exista o no el correo | F08.7 |
| `/` | Inicio | todos | varias | tarjetas por módulo | F02.6 (vacío) → cada fase agrega su tarjeta |
| `/inbox` | Bandeja | todos | `/v1/inbox`, WS `inbox` | marcar leído; deep link al recurso | F20.8 |
| `/account` | Mi cuenta | todos | `/v1/me` | nombre, correo, idioma, tema, cerrar sesión | F02.6 |
| `/account/security` | Seguridad | todos | sesiones, contraseña 🔒, PIN de confirmación, passkeys (`/v1/me/passkeys`, `/v1/me/step-up-pin`) | revocar dispositivos y passkeys | F08.8, F23.3, F28.2 |
| `/account/permissions` | Permisos del dispositivo (S-GEN-23) | todos | registro de capacidades del dispositivo (sin servidor) | abrir ajustes del sistema | F23.8 |
| `/account/notifications` | Preferencias de avisos | todos | `/v1/notification-preferences` | seguridad/pagos no desactivables | F20.8 |
| `/business/new` | Registrar mi negocio | sin tenant | `POST /v1/business` + subida KYB | asistente de 4 pasos; estado "en revisión" | F08.8 |
| `/invite/:token` | Aceptar invitación | sin sesión | `/v1/invitations/accept` | crea cuenta de staff | F08.8 |
| `/update-required` | Actualización obligatoria | todos | client-config | bloqueante | F22.4 |
| `/maintenance` | Mantenimiento | todos | client-config | solo lectura | F05.9 |
| — | Diálogo de confirmación fuerte | todos | `/v1/step-up/*` | biometría/PIN/passkey; muestra operación y monto | F05.6 / F23.3 |

## 3. Billetera (`wallet`)
| Ruta | Pantalla | Permiso | Datos | Notas | Paso |
|---|---|---|---|---|---|
| `/wallet` | Saldo y movimientos | `wallet:read` | `/v1/wallet/balance`, `/statement` | saldo `displayMoney`, retenido, lista con filtros | F11.9 |
| `/wallet/topup` | Recargar | `wallet:topup` | `POST /v1/wallet/topups` | elegir riel; sandbox visible | F11.9 |
| `/wallet/send` | Enviar dinero | `wallet:transfer` | `POST /v1/wallet/transfers` | buscar por correo/teléfono/QR personal; step-up ≥ umbral | F11.9 |
| `/wallet/receive` | Recibir (mi QR) | `wallet:read` | — | QR personal con enlace firmado | F11.9 |
| `/pay/scan` | Pagar: escanear / acercar | `wallet:pay` | `GET /v1/pay-links/:code` | QR + NFC (§10 flutter-standards) | F11.9, F23.1–2 |
| `/pay/:code` | Confirmar pago | `wallet:pay` | intents + confirm | nombre verificado, monto, comisión si la paga el cliente, biometría | F11.9 |
| `/pay/result/:intent` | Resultado | `wallet:pay` | WS `payment.status` | éxito / falló / **confirmando** (UNKNOWN) | F11.9, F23.4 |
| `/wallet/tx/:id` | Detalle de movimiento | `wallet:read` | statement | recibo compartible PDF | F11.9, F23.7 |

## 4. Comprar (`marketplace`)
| Ruta | Pantalla | Permiso | Datos | Paso |
|---|---|---|---|---|
| `/market` | Descubrir (búsqueda, categorías, cerca de mí) | `orders:create:self` | `/v1/market/search` | F15.10 |
| `/market/p/:id` | Producto | idem | `/v1/market/products/:id` | F15.10 |
| `/market/s/:slug` | Vitrina del comercio | idem | `/v1/market/stores/:slug` | F15.10 |
| `/market/cart` | Carrito agrupado por comercio | idem | `/v1/cart` | F15.10 |
| `/market/checkout` | Checkout (entrega/retiro, dirección, pago, resumen por comercio) | idem | quote + checkout + pago | F15.10 |
| `/market/orders` | Mis pedidos | `orders:read:self` | `/v1/orders/mine` | F15.10 |
| `/market/orders/:id` | Detalle con estado por comercio y seguimiento | idem | `/v1/orders/:id`, WS `delivery` | F15.10, F18.7 |

## 5. Caja (`pos`) — layout de 2 paneles en ≥ 1024 dp
| Ruta | Pantalla | Permiso | Notas | Paso |
|---|---|---|---|---|
| `/pos` | Selección de caja y apertura (fondo inicial) | `pos:session:manage` | una sesión abierta por caja | F17.10 |
| `/pos/sell` | Venta: búsqueda/escáner, grilla de favoritos, ticket, cliente, descuentos | `pos:sell` | modo offline visible; `pos:discount:apply` o PIN supervisor | F17.10, F24.3 |
| `/pos/sell/pay` | Cobro multi-pago (efectivo con vuelto, QR/NFC, wallet, tarjeta, crédito, puntos) | `pos:sell` | tenders parciales; estado "confirmando" | F17.10 |
| `/pos/receipt/:id` | Recibo (imprimir, enviar, fiscal/interno) | `pos:sell` | elección de documento si ASK_ALWAYS | F17.10, F24.1 |
| `/pos/parked` | Ventas estacionadas | `pos:sell` | | F17.10 |
| `/pos/sales` | Ventas del turno / historial | `pos:sell` | | F17.10 |
| `/pos/sales/:id/refund` | Devolución por líneas | `pos:refund` 🔒 | | F17.10 |
| `/pos/cash` | Movimientos de caja | `pos:session:manage` | | F17.10 |
| `/pos/close` | Cierre y arqueo (reporte Z) | `pos:session:manage` | diferencia resaltada | F17.10 |
| `/pos/settings` | Configuración POS | `pos:settings:manage` | impuestos incluidos, descuentos máx., puntos, offline | F17.10 |
| `/display/:pairing` | Pantalla del cliente (pantalla completa, oscuro) | dispositivo emparejado | WS `customer_display` | F17.10, F24.4 |

## 6. Productos (`catalog`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/catalog` | Lista con búsqueda, filtros, escáner | `catalog:read` | F15.10 |
| `/catalog/new`, `/catalog/:id` | Editor de producto (variantes, precios por sucursal, imágenes, impuestos) | `catalog:write` | F15.10 |
| `/catalog/import` | Importar CSV con vista previa y resultado por fila | `catalog:import` | F15.10 |
| `/catalog/categories` | Categorías | `catalog:write` | F15.10 |
| `/catalog/storefront` | Mi vitrina y publicación en marketplace | `catalog:listing:manage` | F15.10 |

## 7. Inventario (`inventory`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/inventory` | Existencias por bodega (alertas de quiebre arriba) | `inventory:read` | F16.7 |
| `/inventory/:variant` | Detalle: lotes, movimientos, cobertura en días | `inventory:read` | F16.7 |
| `/inventory/adjust` | Ajuste con motivo | `inventory:adjust` | F16.7 |
| `/inventory/transfer` | Transferencia entre bodegas | `inventory:adjust` | F16.7 |
| `/inventory/purchases` | Órdenes de compra | `inventory:purchase:manage` | F16.7 |
| `/inventory/receive/:po` | Recepción con escáner | `inventory:receive` | F16.7 |
| `/inventory/suppliers` | Proveedores | `inventory:purchase:manage` | F16.7 |
| `/inventory/suggestions` | Sugerencias de reorden → crear OC | `inventory:read` | F16.7 |
| `/inventory/warehouses` | Bodegas | `inventory:adjust` | F16.7 |

## 8. Pedidos del comercio (`orders`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/orders` | Bandeja de sub-pedidos (por aceptar con cuenta regresiva de SLA, en preparación, listos, en entrega) | `orders:read` | F15.10 |
| `/orders/:id` | Detalle: aceptar/rechazar con motivo, marcar listo, entregar en tienda (código) | `orders:manage` | F15.10 |

## 9. Entregas (`logistics`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/logistics` | Despacho (tienda): mapa + lista, cotizar y crear entrega, asignar (manual / más cercano) | `logistics:manage` | F18.7 |
| `/logistics/:id` | Detalle de entrega (tienda) con línea de tiempo, prueba de entrega y ubicación en vivo | `logistics:read` | F18.7 |
| `/logistics/drivers`, `/carriers` | Repartidores (licencia, póliza, vehículo, vínculo laboral) y transportistas | `logistics:manage` | F18.7 |
| `/logistics/geofences` | Editor de geocercas y tarifas por zona de entrega | `logistics:geofence:manage` | F14.7, F18.7 |
| `/courier`, `/courier/:id` | App de repartidor: turno (`En turno`/`Fuera de turno`), mis entregas, navegación externa, escanear paquete, prueba de entrega (código/foto/firma + mayoría de edad) | `logistics:deliver` | F18.7 |
| `/deliveries`, `/deliveries/:id` | Mis entregas y seguimiento en vivo (cliente): mapa en vivo, ETA, repartidor y código de recepción de 6 dígitos | `orders:read:self` | F18.7 |

## 10. Finanzas (`finance`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/finance` | Resumen: cobrado hoy/semana, por liquidar, próxima liquidación, comisiones | `payments:read` o `settlement:read` | F12.8 |
| `/finance/payments` · `/:id` | Cobros con filtros; detalle con desglose de comisiones; reembolsar 🔒 | `payments:read` / `payments:refund` | F11.9 |
| `/finance/terminals` | Terminales QR/NFC (crear, imprimir QR, escribir tag NFC, desactivar) | `payments:terminal:manage` | F11.9, F23.2 |
| `/finance/settlements` · `/:id` | Lotes de liquidación | `settlement:read` | F12.8 |
| `/finance/payout-settings` | Calendario y cuenta destino 🔒 | `settlement:schedule:manage` | F12.8 |
| `/finance/invoices` · `/:id` | Facturas y notas; descargar PDF/XML; emitir nota | `fiscal:read` / `fiscal:note:issue` | F13.9 |
| `/finance/fiscal-profile` | Perfil fiscal y credenciales del PAC 🔒 | `fiscal:profile:manage` | F13.9 |
| `/finance/taxpayers` | Clientes con RUC frecuentes | `fiscal:issue` | F13.9 |

## 11. Equipo (`payroll`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/team/clock` | Marcar entrada/salida (QR del quiosco, NFC, biometría, PIN) | `payroll:attendance:record` | F19.8 |
| `/team/me` | Mis marcajes y mis comprobantes | `payroll:payslip:read:self` | F19.8 |
| `/team/employees` · `/:id` | Empleados (datos cifrados, enrolamiento biométrico con consentimiento) | `payroll:employee:read` / `manage` | F19.8 |
| `/team/schedule` | Turnos y calendario | `payroll:employee:manage` | F19.8 |
| `/team/attendance` | Asistencia con revisiones (`needs_review`) | `payroll:attendance:read` | F19.8 |
| `/team/runs` · `/:id` | Corridas de nómina: borrador, aprobar 🔒, pagar 🔒 | `payroll:run:*` | F19.8 |
| `/kiosk/:session` | Quiosco de marcaje (pantalla completa, QR dinámico, rostro, PIN) | sesión de quiosco | F19.8, F24.5 |

## 12. Análisis (`analytics`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/insights` | KPIs del día/semana/mes con comparación | `analytics:read` | F21.10 |
| `/insights/ask` | Preguntar en lenguaje natural (muestra la interpretación) | `analytics:read` | F21.10 |
| `/insights/dashboards` · `/:id` | Dashboards personalizados | `analytics:read` / `dashboard:manage` | F21.10 |
| `/insights/products` | Top productos y ABC | `analytics:read` | F21.10 |
| `/insights/customers` | Segmentos RFM | `analytics:read` | F21.10 |
| `/insights/forecast` | Pronóstico con intervalos | `analytics:read` | F21.10 |
| `/insights/alerts` | Reglas y eventos de alerta | `analytics:alert:manage` | F21.10 |
| `/insights/exports` | Exportes | `analytics:export` | F21.10 |

## 13. Mi negocio (`admin`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/business` · `/business/branches` | Datos del negocio, estado de revisión, sucursales y códigos DGI | `admin:business:manage` | F08.8 |
| `/business/staff` | Equipo: invitar, desactivar, asignar rol y alcance 🔒 | `admin:users:manage` | F08.8 |
| `/business/roles` | Roles personalizados (matriz de permisos y plantillas por vertical) | `admin:roles:manage` | F08.8 |
| `/business/modules` | Módulos y funciones: activar/desactivar capacidades y rasgos | `admin:business:manage` | F08.8 |
| `/business/integrations` | Integraciones (rieles, PAC, WhatsApp) — estado sandbox/real | `admin:integrations:manage` | F13.9, F20.8, F23.6 |
| `/business/templates` | Plantillas de mensajes | `notifications:template:manage` | F20.8 |
| `/business/audit` | Auditoría del negocio | `admin:audit:read` | F05.4 (backend) / F08.8 |

## 14. Plataforma (`platform`)
| Ruta | Pantalla | Permiso | Paso |
|---|---|---|---|
| `/platform/tenants` · `/:id` | Revisión KYB: aprobar/rechazar/suspender | `platform:tenants:review` | F08.8 |
| `/platform/flags` | Feature flags, configuración, mantenimiento | `platform:flags:manage` | F05.9 |
| `/platform/payments/unknown` | Pagos UNKNOWN > 24 h: resolver con evidencia | `platform:reconcile` | F11.9 |
| `/platform/reconciliation` | Extractos, excepciones, SUSPENSE | `platform:reconcile` | F12.8 |
| `/platform/security` | Eventos de seguridad, bloqueos, verificación de cadena de auditoría | `platform:security:read` | F28.8 |
| `/platform/services` | Estado y versión de contenedores | `platform:support` | F27.7 |
| `/platform/fees` | Políticas de comisión | `platform:flags:manage` | F11.9 |

## 15. Páginas públicas (servidas por `web`, sin la app)
`/t/:code` enlace de pago (abre la app o tiendas), `/track/:token` seguimiento, `/legal/*` términos y privacidad, `/.well-known/*` deep links. Pasos F18.6, F22.3, F23.5.

## 16. Reglas de UX transversales
1. Un solo botón primario por pantalla; acciones destructivas con confirmación y texto explícito ("Reembolsar $12.00").
2. Montos de dinero siempre con moneda y cifras tabulares; nunca colores como único indicador.
3. Toda acción de dinero muestra resumen antes de confirmar y resultado después (con estado "confirmando" para UNKNOWN).
4. Errores traducidos por `reason`; request_id copiable en errores inesperados.
5. Listas con paginación infinita (keyset) y pull-to-refresh en móvil.
6. Formularios largos con guardado de borrador local (sin datos sensibles).
7. Indicador global de modo offline y de entorno sandbox.

## 17. Pantallas exigidas por el marco normativo
Agregadas por [`functional-spec/`](functional-spec/README.md) para cumplir [`../compliance/regulatory-framework.md`](../compliance/regulatory-framework.md). Sus rutas del gateway están en la lista de contratos pendientes (`functional-spec/README.md` §7).

| Ruta | Pantalla | Permiso | Regla | Ficha | Paso |
|---|---|---|---|---|---|
| `/account/profile` | Datos personales | todos | N-DAT-05 | S-GEN-09 | F08.8 |
| `/account/privacy` · `/account/privacy/request/:id` | Privacidad y mis datos; solicitudes de acceso, rectificación, cancelación, oposición y portabilidad | todos | N-DAT-02, N-DAT-05 a N-DAT-08 | S-GEN-12, S-GEN-13 | F25.4 |
| `/account/verify` | Verificación de identidad | todos | N-AML-02, N-AML-03 | S-GEN-14 | F08.8 |
| `/account/limits` | Límites de mi cuenta | todos | N-AML-03 | S-WAL-09 | F11.9 |
| `/help/complaints` | Ayuda y reclamos | todos | N-CON-10 | S-MKT-08 | F15.10 |
| `/finance/tax-report` | Reporte mensual de ITBMS | `fiscal:read` | N-FIS-11 | S-FIN-10 | F13.9 |
| `/business/privacy` | Privacidad del negocio y solicitudes de sus clientes y empleados | `admin:business:manage` | N-DAT-01, N-DAT-05 | S-ADM-07 | F25.4 |
| `/platform/users` | Verificación de identidad (revisión) | `platform:users:manage` | N-AML-02, N-AML-08 | S-PLT-02 | F08.8 |
| `/platform/legal-parameters` | Parámetros legales con vigencia | `platform:flags:manage` | principio P1 | S-PLT-04 | F05.8 |
| `/platform/compliance` | Cola de cumplimiento y requerimientos de autoridad | `platform:security:read` / `platform:reconcile` | N-AML-05 a N-AML-10 | S-PLT-07 | F28.7 |
| `/platform/data-requests` | Solicitudes sobre datos dirigidas a PlentyPay | `platform:support` | N-DAT-05 | S-PLT-09 | F25.4 |

Además, dentro de pantallas ya catalogadas: el descuento legal en `/pos/sell` (S-POS-02), los tipos de corrida de décimo tercer mes y vacaciones en `/team/runs` (S-PAY-06), y los documentos del repartidor en `/logistics/drivers` (S-LOG-03).
