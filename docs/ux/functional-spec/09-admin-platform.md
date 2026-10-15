# Mi negocio, plataforma y páginas públicas

Módulos `admin` (paso F08.8) y `platform` (pasos indicados), y páginas servidas por `web`. Convenciones: [`README.md`](README.md).

## Mi negocio

### S-ADM-01 · `/business` · Datos del negocio
`admin:business:manage`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Estado | `StatusChip` En revisión / Activo / Suspendido / Rechazado | Con el texto de S-GEN-16 o S-GEN-18 según el caso |
| e2 | Datos legales | Razón social · RUC · DV · Tipo de persona | Solo lectura tras la aprobación. "Solicitar cambio" abre una revisión con documento |
| e3 | Datos comerciales | Nombre comercial · Logo · Teléfono · Correo · Sitio web | Editables |
| e4 | Aviso de Operación | Número · Archivo · Vigente | Reemplazable; el cambio pasa por revisión |
| e5 | Dueños | Personas con 10 % o más | Cambios 🔒 y con revisión (N-AML-04) |
| e6 | Sucursales | Lista: nombre, código, dirección, punto en el mapa, horario | Agregar, editar, desactivar. El código se usa en la factura |
| e7 | Preferencias | Mostrar moneda como $ o B/. · Mostrar equivalencia en libras | — |

### S-ADM-02 · `/business/staff` · Equipo de usuarios
`admin:users:manage`. Lista: nombre, correo, rol, sucursal, estado, último acceso. "Invitar": correo, rol, sucursal → envía enlace que vence en 7 días. Por usuario: "Cambiar rol" (🔒 si el rol nuevo incluye permisos de dinero), "Desactivar" (C-05; cierra sus sesiones), "Reenviar invitación". El dueño no se desactiva (`CANNOT_DEACTIVATE_OWNER`: "No puedes desactivar al dueño del negocio.").

### S-ADM-03 · `/business/roles` · Roles
`admin:roles:manage`. Lista de roles predefinidos (solo lectura, `PRESET_READ_ONLY`) y propios. Editor: nombre y matriz de permisos agrupada por módulo, con una descripción en lenguaje llano de cada permiso ("Devolver ventas y reembolsar dinero"). Los permisos de dinero llevan el icono 🔒. No aparecen permisos de plataforma. Aviso al guardar un rol que combina crear y aprobar nómina, o cobrar y reembolsar: "Este rol reúne funciones que conviene separar."

### S-ADM-04 · `/business/integrations` · Integraciones
`admin:integrations:manage` · Pasos F13.9, F20.8, F23.6. Tarjeta por integración (medios de pago, facturación, WhatsApp, impresoras) con estado: "Modo de prueba", "Conectado", "Requiere atención". Las credenciales se introducen una vez, se guardan cifradas y no se vuelven a mostrar. Cambiarlas es operación 🔒.

### S-ADM-05 · `/business/templates` · Plantillas de mensajes
`notifications:template:manage`. Lista por evento (recibo, pedido aceptado, pedido en camino, factura). Editor: asunto, cuerpo con variables de una lista cerrada (`{cliente}`, `{total}`, `{enlace}`), vista previa por canal y "Enviar prueba a mi correo". Los mensajes de seguridad y los textos legales no son editables. Todo mensaje de mercadeo incluye el enlace para dejar de recibirlos.

### S-ADM-06 · `/business/audit` · Auditoría del negocio
`admin:audit:read`. Filtros: rango, usuario, tipo de acción (acceso, dinero, fiscal, permisos, datos personales, configuración). Lista: fecha, usuario, acción, recurso, dispositivo. Solo lectura; exportable (C-20). No se puede borrar ni editar ningún registro.

### S-ADM-07 · `/business/privacy` · Privacidad del negocio
`admin:business:manage` · Reglas: N-DAT-01, N-DAT-05, N-DAT-10

El negocio es responsable de los datos de **sus** clientes y empleados; PlentyPay los custodia.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Datos | Contacto de privacidad del negocio (nombre y correo) | Aparece en los recibos y en la tienda |
| e2 | Lista | Solicitudes de clientes y empleados sobre sus datos | Tipo, fecha, fecha límite (5 o 10 días hábiles), estado. En `warning` a 2 días del límite |
| e3 | Detalle de solicitud | Datos encontrados · Lo que debe conservarse por ley | Acciones: "Entregar copia", "Corregir", "Eliminar lo permitido", "Rechazar" (motivo obligatorio) |
| e4 | Fila | Documentos: aviso de privacidad para mi tienda · consentimiento de biometría para empleados | Descarga de modelos |

## Plataforma (equipo de PlentyPay)

### S-PLT-01 · `/platform/tenants`, `/platform/tenants/:id` · Revisión de negocios
`platform:tenants:review` · Paso F08.8 · Reglas: N-AML-04, N-AML-08, N-COM-01

Lista con filtros por estado y antigüedad. Detalle con lista de comprobación; cada punto se marca "Cumple", "No cumple" u "Observado":
1. RUC y DV válidos y coincidentes con la razón social.
2. Aviso de Operación vigente y coincidente con la actividad.
3. Representante legal identificado.
4. Dueños con 10 % o más identificados.
5. Resultado del cotejo contra listas restrictivas (negocio, representante y dueños).
6. Cuenta bancaria a nombre del negocio o del representante.

Cada documento se ve en un visor sin descarga. Acciones: "Aprobar" (habilitada con los 6 puntos en "Cumple"), "Pedir corrección" (motivo comunicable + nota interna), "Rechazar", "Suspender" (negocios activos). Toda acción es 🔒 y queda en auditoría. Una coincidencia en listas impide aprobar y abre un caso en S-PLT-07.

### S-PLT-02 · `/platform/users` · Verificación de identidad
`platform:users:manage`. Cola de verificaciones de S-GEN-14: datos declarados junto a las fotos del documento, resultado del cotejo y marca de persona expuesta políticamente. Acciones: "Aprobar", "Rechazar" (motivo de la lista cerrada de S-GEN-14), "Escalar a cumplimiento".

### S-PLT-03 · `/platform/flags` · Configuración y mantenimiento
`platform:flags:manage` · Paso F05.9. Pestañas: Banderas (por entorno, tenant o porcentaje), Límites de tasa, Mantenimiento (activar con mensaje y ventana), Versión mínima de la app. Todo cambio pide motivo y es 🔒.

### S-PLT-04 · `/platform/legal-parameters` · Parámetros legales
`platform:flags:manage` · Paso F05.8 · Principio P1

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Filtros | Área: Fiscal · Laboral · Blanqueo · Datos · Consumidor · Retención | — |
| e2 | Tabla | Clave · Valor vigente · Vigente desde · Próximo cambio · Estado de verificación (Confirmado, Por confirmar, Sin valor) | Las claves "Sin valor" van arriba en `warning` |
| e3 | Detalle | Historial de valores con vigencia, autor y fuente | Nunca se edita un valor pasado |
| e4 | `PPButton.primary` | Programar nuevo valor | Campos: valor, vigente desde (fecha de negocio), norma que lo respalda (texto y enlace o documento), estado de verificación. 🔒 y requiere una segunda persona que lo apruebe |

Una función que depende de una clave "Sin valor" aparece listada bajo ella como bloqueada.

### S-PLT-05 · `/platform/payments/unknown` · Pagos por confirmar
`platform:reconcile` · Paso F11.9. Lista de pagos sin resultado por más de 24 h: antigüedad, monto, medio, comercio. Detalle: intentos, respuestas del medio de pago, consultas hechas. Acción "Resolver": resultado (Cobrado / No cobrado), **evidencia obligatoria** (archivo) y nota. Sin evidencia: `EVIDENCE_REQUIRED`. 🔒.

### S-PLT-06 · `/platform/reconciliation` · Conciliación
`platform:reconcile` · Paso F12.8. Pestañas: Extractos (importar CSV por medio de pago; `ALREADY_IMPORTED` si se repite), Excepciones (sin par interno, sin par externo, monto distinto; resolver con nota y evidencia), Saldos de control: cuenta transitoria y prueba de suma cero por moneda, y respaldo de saldos de usuarios frente a la cuenta bancaria segregada (N-AML-11). Cualquier descuadre aparece como alerta crítica arriba.

### S-PLT-07 · `/platform/compliance` · Cumplimiento
`platform:security:read` (ver) y `platform:reconcile` (resolver) · Paso F28.7 · Reglas: N-AML-05 a N-AML-10

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Pestañas | Casos abiertos · En seguimiento · Cerrados · Requerimientos de autoridad | — |
| e2 | Lista de casos | Regla que lo disparó · Persona o negocio · Monto · Antigüedad · Prioridad | Reglas: operación sobre B/. 10,000, fraccionamiento, velocidad, ida y vuelta, coincidencia en listas |
| e3 | Detalle | Perfil, nivel de verificación, origen de fondos declarado, movimientos relacionados, dispositivos y ubicaciones, casos anteriores | — |
| e4 | Acciones | Pedir información al cliente · Restringir cuenta · Levantar restricción | La petición al cliente usa un texto neutro; nunca menciona un reporte |
| e5 | Cierre | Sin novedad · Seguimiento · Reportado | "Reportado" exige adjuntar el acuse del reporte. Motivo obligatorio. 🔒 |
| e6 | `PPButton.secondary` | Exportar expediente | PDF con todo lo anterior, para la UAF o la SBP |
| e7 | Requerimiento | Autoridad · Fecha de recepción · Responder antes del {fecha} | 15 días hábiles; alerta a 5 días del límite |

Quien no tenga estos permisos (incluido soporte) no ve que una cuenta tiene un caso; solo ve "En revisión".

### S-PLT-08 · `/platform/security`, `/platform/services` · Seguridad y estado
`platform:security:read` / `platform:support` · Pasos F28.8, F27.7. Seguridad: eventos (accesos fallidos, reuso de sesión, firmas inválidas), bloqueos activos con opción de levantar (🔒), verificación de la cadena de auditoría ("Íntegra hasta {fecha}" o el punto de ruptura), y **registro de incidentes de datos** con fecha de detección, datos afectados, número de titulares, medidas, y fechas de aviso a la ANTAI y a los titulares (N-DAT-09). Estado: cada contenedor con versión, salud y último despliegue.

### S-PLT-09 · `/platform/data-requests`, `/platform/fees` · Datos y comisiones
`platform:support` / `platform:flags:manage`. Solicitudes sobre datos dirigidas a PlentyPay como responsable: misma mecánica que S-ADM-07 e2–e3, con el contador de días hábiles. Comisiones: políticas por alcance (global, medio de pago, negocio), con fijo, porcentaje, ITBMS y quién la asume, vigente desde; simulador que muestra el desglose para un monto de ejemplo antes de guardar. 🔒.

## Páginas públicas (`web`)

### S-PUB-01 · `/t/:code` · Enlace de pago
Paso F23.5. Nombre verificado del comercio y, si lo fija, el monto. Botón "Pagar con PlentyPay" abre la app (o las tiendas si no está instalada). No pide ni muestra datos del pagador.

### S-PUB-02 · `/track/:token` · Seguimiento
Paso F18.6. Estado de la entrega, línea de tiempo, mapa con el repartidor (solo "En camino") y hora estimada. Muestra el primer nombre del repartidor; nunca dirección completa, teléfono ni contenido del pedido. Token inválido: "Este enlace no existe o ya venció."

### S-PUB-03 · `/legal/terms`, `/legal/privacy`, `/legal/merchant` · Textos legales
Paso F25.4 · Reglas: N-DAT-03, N-DAT-13. Cada texto lleva versión y fecha de vigencia, e historial de versiones. La política de privacidad contiene, como mínimo: responsable y contacto; oficial de protección de datos; datos que se recogen por finalidad; condición de licitud de cada finalidad; destinatarios; transferencias fuera de Panamá; plazos de conservación; derechos y cómo ejercerlos (enlace a S-GEN-12); decisiones automatizadas; cómo reclamar ante la ANTAI. Un cambio de versión exige nueva aceptación al siguiente inicio de sesión.

### S-PUB-04 · `/.well-known/*` · Enlaces profundos
Paso F22.3. Archivos `assetlinks.json` y `apple-app-site-association`. Sin interfaz.
