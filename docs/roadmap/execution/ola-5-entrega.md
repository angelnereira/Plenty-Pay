# Ola 5 · Entrega a domicilio

**Qué cierra**: un sub-pedido aceptado se entrega con repartidor, prueba de entrega y seguimiento para el cliente. Etapa P7 ([`../lifecycles.md`](../lifecycles.md)). geolocation y logistics **no tienen servidor**: se construyen con [`README.md`](README.md) §3.

**Antes de empezar (decisión pendiente)**: `status.md` dice que geolocalización «se delega a GeoStream» (repositorio externo `angelnereira/GeoStream`), pero ni `geolocation/SPEC.md` (PostGIS + Scylla, R1–R5) ni un ADR lo registran. Un agente **no** debe elegir: pregunta al dueño y registra la decisión como ADR (delegar en GeoStream como dependencia externa, o implementar el SPEC con PostGIS). Las fichas de F14 siguientes valen para las dos opciones; donde difieren se indica.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 0 | ADR de geolocalización (GeoStream o PostGIS) | docs | — | — | decisión del dueño |
| 1 | [F14.1–F14.5](#f141f145--geocercas-ingesta-trayectorias-consultas-y-cruces) Geocercas, ingesta, trayectorias, consultas y cruces | geolocation | L2 | ADR | — |
| 2 | [F14.6–F14.7](#f146f147--stream-y-editor-de-geocercas) Stream y editor de geocercas | geolocation, gateway, app | L3/L1 | F14.5 | mapa ⛔ Q-49 |
| 3 | [F18.1–F18.2](#f181f182--servicio-logistics-repartidores-y-entregas) Servicio logistics: repartidores y entregas | logistics | L2 | F14, F15 | — |
| 4 | [F18.4 + F18.8](#f184--f188--prueba-de-entrega-y-qr-de-un-solo-uso) Prueba de entrega y QR de un solo uso | logistics, object-storage, app | L2 | F18.2 | — |
| 5 | [F18.3](#f183--asignación-manual-y-por-cercanía) Asignación manual y por cercanía | logistics, geolocation | L4 | F18.2, F14.4 | — |
| 6 | [F18.6](#f186--integración-con-orders-y-seguimiento-público-en-web) Integración con orders y página pública | logistics, orders, web | L4 | F18.4 | — |
| 7 | [F18.5](#f185--seguimiento-público-y-en-vivo) Seguimiento público y en vivo | logistics, gateway | L4 | F18.6 | mapa ⛔ Q-49 |
| 8 | [F18.7](#f187--pantallas-de-despacho-y-repartidor-integration_test) Pantallas de despacho y repartidor | flutter_app | L4 | F18.6 | — |

---

### F14.1–F14.5 · Geocercas, ingesta, trayectorias, consultas y cruces
Nivel L2 · Estado 📝 (reabiertos: solo dominio o cliente sin servicio).
- **Leer antes**: `geolocation/SPEC.md` (R1–R5), `geolocation/migrations/0001_initial.sql`, `geolocation/internal/domain/geofence.go`, `geolocation/internal/geostream` (cliente existente), Q-08 y Q-49 en `open-questions.md`.
- **Resultado observable**: el comercio define su zona de entrega (círculo o polígono); la app del repartidor envía su posición solo en turno (≥ 5 s entre pings, R4); `IsInside`/`FindNearby` responden como la referencia haversine; un cruce de geocerca con histéresis de 2 pings publica `GeofenceCrossed` por outbox.
- **Código**: servidor gRPC según [`README.md`](README.md) §3. Con PostGIS: `ST_DWithin`/`ST_Contains` y trayectorias en Scylla con TTL 90 días (R2; keyspace en `nosql-db`, script de inicialización). Con GeoStream: cliente con reintentos y *circuit breaker*, sin copiar código del otro repositorio (ADR 0002).
- **Privacidad**: posiciones solo con consentimiento (N-LOG-06) y de sujetos en turno o entrega activa (R5); retención según R2; nunca la posición de un cliente.
- **Pruebas**: L2 `TestF14_1_CircleAndPolygon`, `TestR4_PingsUnder5sAreDropped`, `TestF14_4_MatchesHaversineReference` (vectores fijos de Panamá), `TestR3_CrossingNeedsTwoConsecutivePings`, `TestR2_TrajectoryTTL`.
- **Terminado cuando**: criterios de 05: «Círculo y polígono», «R4 y descartes», «R2», «Coincide con haversine de referencia», «R3 con histéresis».

### F14.6–F14.7 · Stream y editor de geocercas
Niveles L3 y L1 · Estado 📝 (bloqueados por la integración).
- **F14.6** `WatchSubject` (server-stream) recibe pings en vivo; el gateway lo expone solo a quien tiene la entrega asignada o al despacho del comercio.
- **F14.7** editor de geocercas en S-LOG-04 con `flutter_map`: el **proveedor de teselas** es Q-49 (licencia, costo, cuotas). Sin respuesta, el editor permite definir un círculo por dirección o coordenadas sin mapa de fondo, y lo dice; nunca coordenadas simuladas.
- **Terminado cuando**: «Stream recibe pings» (L3) y «Widget test» (L1).

### F18.1–F18.2 · Servicio logistics: repartidores y entregas
Nivel L2 · Estado 📝 (dominio con L1).
- **Leer antes**: `logistics/SPEC.md` R1–R10 (máquina de estados de `domain-model.md` §8.11, 3 intentos, documentos del repartidor N-LOG-03, vínculo laboral N-LAB-16, ubicación en turno N-LOG-06), `logistics.proto`, `logistics/internal/domain/driver.go`.
- **Resultado observable**: el comercio registra transportistas y repartidores (con placa, licencia y póliza vigentes para vehículos a motor); una entrega se crea, se asigna y recorre sus estados con un evento `DeliveryStatusChanged` por transición (R7, outbox).
- **Código**: servidor según [`README.md`](README.md) §3; dominio de `Delivery` (verificar si existe en `internal/domain`; `status.md` lo menciona pero hoy solo está `driver.go`); permisos `logistics:read|manage|deliver` (matriz de commerce-plan §3).
- **Pruebas**: L2 `TestR8_ExpiredDocsBlockAssignment` (aceptación 3, `DRIVER_DOCS_EXPIRED`), `TestR1_ThirdFailedAttemptIsTerminal` (aceptación 2), `TestR7_EveryTransitionWritesOneOutboxRow`.
- **Terminado cuando**: «Repartidor requiere permiso» y «§8.11 completo» (05).

### F18.4 + F18.8 · Prueba de entrega y QR de un solo uso
Ficha de diseño de F18.8: [commerce-plan F18.8](../commerce-plan.md#f188--confirmación-de-entrega-con-qr-de-un-solo-uso) · Nivel L2.
- **Resultado observable**: `DELIVERED` solo con prueba válida: código de 6 dígitos del cliente comparado en tiempo constante con su hash (R2), foto a object-storage o firma; un QR de un solo uso que vence y no confirma otra entrega; entrega con `age_restricted` exige documento de mayor de edad (aceptación 4, `AGE_REQUIREMENT`).
- **Pruebas**: L2 `TestR2_CodeComparedInConstantTime`, `TestF18_8_QRSingleUseAndExpires`, `TestSPEC11_4_AgeRestrictedNeedsDocument`.
- **Terminado cuando**: «R2» y «No confirma otra entrega, no se reutiliza y vence» (05).

### F18.3 · Asignación manual y por cercanía
Nivel L4.
- **Resultado observable**: el despacho asigna a mano o pide «el más cercano activo con documentos vigentes» (consulta a geolocation `FindNearby`).
- **Pruebas**: L2 con geolocation efímero; L4 en el Pixel con dos repartidores de prueba en turno.
- **Terminado cuando**: «Elige al más cercano activo» (05).

### F18.6 · Integración con orders y seguimiento público en web
Nivel L4.
- **Resultado observable**: un sub-pedido aceptado con entrega a domicilio crea su entrega (`source = sub_order`); al entregarse, el sub-pedido pasa a COMPLETED; la página `/track/<token>` en `web` muestra el estado sin datos personales (R4, R5). orders hoy responde `DELIVERY_UNAVAILABLE` para domicilio: se habilita aquí.
- **Código**: orders llama `logistics.QuoteDelivery`/`CreateDelivery` por tarea durable al aceptar; consume `DeliveryStatusChanged` (`processed_events`) para completar; `web` sirve la página (handler Go existente `/track/:token`).
- **Pruebas**: L2 cruzado `TestF18_6_DeliveredCompletesSubOrder`; aceptación 1 y 5 del SPEC de logistics.
- **Terminado cuando**: «Sub-pedido COMPLETED al entregar» (05).

### F18.5 · Seguimiento público y en vivo
Ficha de diseño: [commerce-plan F18.5](../commerce-plan.md#f185--seguimiento-en-mapa-futuro) · Nivel L4 · **Bloqueo**: mapa ⛔ Q-49 y F14. Sin mapa: estado, hora estimada y último checkpoint en texto; nunca coordenadas simuladas.
- **Terminado cuando**: «R5; sin datos personales» (05).

### F18.7 · Pantallas de despacho y repartidor (integration_test)
Nivel L4 · Estado 📝 (pantallas hechas el 2026-10-19 sin servicio).
- **Qué falta**: conectarlas al servicio real (quitar cualquier dato literal), `integration_test/delivery_flow_test.dart` (asignar → recoger → en camino → llegar → código → entregado) en el Pixel.
- **Terminado cuando**: «integration_test de entrega» (05).
