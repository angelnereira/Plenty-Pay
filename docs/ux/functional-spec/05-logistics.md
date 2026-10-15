# Entregas y app del repartidor

Módulo `logistics`. Paso F18.7 salvo indicación. Convenciones: [`README.md`](README.md). Estados: [`../../domain/domain-model.md`](../../domain/domain-model.md) §8.11. En el contrato las entidades son `Carrier` (transportista) y `Driver` (repartidor).

### S-LOG-01 · `/logistics` · Despacho
`logistics:manage` · `/v1/logistics/deliveries`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Mapa | Marcadores de entregas y repartidores | Ocupa la mitad derecha en ≥ 1024 dp; pestaña aparte en móvil |
| e2 | Pestañas | Sin asignar · Asignadas · En camino · Con problema · Finalizadas | Con contador |
| e3 | Tarjeta | Pedido {número} · {corregimiento} · {distancia} · desde hace {tiempo} | Toca → S-LOG-02 |
| e4 | `PPButton.secondary` | Asignar al más cercano | Propone el repartidor activo más cercano con documentos vigentes |
| e5 | `PPButton.primary` | Nueva entrega | Entrega manual: origen, destino, receptor, bultos, nota |

### S-LOG-02 · `/logistics/:id` · Detalle de entrega
`logistics:read`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | Entrega {número} · `StatusChip` · Intento {n} de 3 | — |
| e2 | Mapa | Ruta, repartidor en vivo, hora estimada | — |
| e3 | Línea de tiempo | Creada · Asignada · Recogida · En camino · Llegó · Entregada | Cada hito con hora y ubicación. Punto a más de 300 m del destino: marca "Requiere revisión" |
| e4 | Datos | Origen · Destino · Receptor · Bultos · Restricción de edad | Contacto del cliente según permiso |
| e5 | Prueba de entrega | Código / Foto / Firma · documento verificado | Tras "Entregada" |
| e6 | Acciones | Asignar o reasignar · Cancelar · Reintentar | "Cancelar" solo en Pendiente o Asignada. "Reintentar" tras un intento fallido, hasta 3 |

Asignar a un repartidor con documentos vencidos: `DRIVER_DOCS_EXPIRED` "Este repartidor tiene documentos vencidos."

### S-LOG-03 · `/logistics/drivers`, `/logistics/carriers` · Repartidores y transportistas
`logistics:manage` · Reglas: N-LOG-03, N-LAB-16

Repartidor:

| Campo | Validación |
|---|---|
| Usuario | Debe ser usuario del negocio con permiso `logistics:deliver` |
| Vínculo | Empleado / Contratista. Solo "Empleado" entra a nómina |
| Transportista | Propio o uno de la lista |
| Tipo de vehículo | Moto, Auto, Bicicleta, A pie, Camión |
| Placa | Obligatoria salvo bicicleta y a pie |
| Licencia de conducir | Número, tipo y vencimiento. Obligatoria para vehículos a motor |
| Póliza de seguro | Aseguradora, número y vencimiento. Obligatoria para vehículos a motor |
| Fotos | Licencia y póliza |
| Activo | No se activa con un documento vencido |

La lista muestra un aviso 30 días antes de cada vencimiento. Transportista: nombre, RUC + DV, contacto, externo o propio.

### S-LOG-04 · `/logistics/geofences` · Geocercas
`logistics:geofence:manage` · Paso F14.7. Mapa con herramientas de círculo y polígono; lista de geocercas con nombre, tipo (Sucursal, Zona de entrega, Zona de marcaje) y uso. Un polígono necesita entre 3 y 100 vértices y no puede cruzarse a sí mismo.

### S-LOG-05 · `/courier` · Mis entregas (repartidor)
`logistics:deliver` · `/v1/logistics/my-deliveries` · Reglas: N-LOG-06, N-DAT-02

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Interruptor | En turno / Fuera de turno | Al activarlo por primera vez: consentimiento de ubicación "Compartimos tu ubicación con el negocio y con el cliente solo mientras estás en turno." Fuera de turno no se envía ubicación |
| e2 | Lista ordenada | Entrega {número} · {corregimiento} · {distancia} | — |
| e3 | Indicador | Sin conexión: {n} registros por enviar | — |

### S-LOG-06 · `/courier/:id` · Entrega en curso (repartidor)
`logistics:deliver` · `POST /v1/logistics/deliveries/{id}/checkpoints` · Reglas: N-LOG-04

El botón primario cambia con el estado.

| Estado | Botón primario | Requisito |
|---|---|---|
| Asignada | Recoger paquete | Escanear el QR del paquete. Código incorrecto: "Este paquete no corresponde a la entrega." |
| Recogida | Iniciar viaje | — |
| En camino | Llegué | Botón "Navegar" abre la app de mapas externa. "Llamar" disponible |
| Llegó | Entregar | Prueba de entrega |

Prueba de entrega, en este orden: 1) código de 6 dígitos del cliente (alternativas si no lo tiene: foto del paquete entregado o firma en pantalla, con el nombre de quien recibe); 2) si hay restricción de edad: casilla "Verifiqué el documento: es mayor de 18 años" y campo de fecha de nacimiento del documento; sin esto no se entrega. 

Botón secundario "No pude entregar": motivo obligatorio (No había nadie, Dirección incorrecta, Rechazó el paquete, No presentó documento, Otro + texto) y foto. Registra el intento fallido. Los datos de contacto del cliente desaparecen de la pantalla al finalizar.
