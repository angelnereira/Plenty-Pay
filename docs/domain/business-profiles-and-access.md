# Perfiles de negocio, capacidades y modelo de acceso

- **Estado**: Vigente (ADR 0018)
- **Fecha**: 2026-10-19
- **Contenedores responsables**: `identity`, `api-gateway`, `infra-management`

---

## 1. Propósito y principios

PlentyPay opera sobre un modelo semántico único que responde tres preguntas ortogonales para cada petición entrante:
1. **¿Qué puede usar el negocio?** → Capacidades (`capabilities`), determinadas por su perfil de negocio y su plan contratado.
2. **¿Qué puede hacer la persona?** → Rol y permisos (`permissions`), otorgados por su membresía en el comercio o por su rol de plataforma.
3. **¿Dónde puede hacerlo?** → Alcance operativo (`branch_scope`), delimitando si su acción aplica a todo el comercio (`TENANT`) o a sucursales específicas (`BRANCHES`).

### Principios rectores
1. **Ortogonalidad absoluta**: Ninguna de las tres dimensiones se deriva ni reemplaza a otra. Un rol no otorga capacidades no contratadas; una capacidad encendida no confiere permisos a un usuario no autorizado; el alcance delimita el ámbito geográfico/físico de ejecución sin alterar el rol.
2. **El código consulta capacidades y permisos, nunca nombres de verticales ni de roles**: Condicionales del tipo `if vertical == "RESTAURANT"` o `if role == "cashier"` son defectos de arquitectura. Los contenedores evalúan permisos atómicos y capacidades activas (`CAPABILITY_DISABLED`).
3. **Deny-by-default en el servidor**: La app Flutter oculta elementos para simplificar la interfaz, pero el servidor es la barrera inviolable. Todo RPC no cubierto por los permisos efectivos y capacidades del actor es denegado con código gRPC canónico.
4. **Roles por responsabilidad, no por cargo laboral**: Los puestos de trabajo se registran en el atributo informativo `job_title` para fines contractuales y de planilla, sin otorgar permisos de acceso por sí mismos.
5. **No inventar valores legales en código**: Comisiones de servicios, propinas, depósitos de citas y verticales reguladas permanecen desactivadas o en modo sandbox hasta la validación de sus respectivas preguntas abiertas en `docs/open-questions.md`.

---

## 2. Taxonomía de acceso

| Término | Identificador | Qué es | Regla de uso |
|---|---|---|---|
| **Comercio / Negocio** | `tenant_id` | Entidad jurídica o comercial con RUC y DV; unidad de aislamiento de datos (RLS, ADR 0014). | Contexto obligatorio en metadatos `x-pp-tenant-id`. |
| **Perfil de negocio** | `business_profile` | Conjunto compuesto por la vertical principal, hasta dos verticales secundarias y los rasgos operativos del comercio. | Configura sugerencias y capacidades por defecto; no concede permisos directos. |
| **Vertical** | `vertical` (ej. `RETAIL_STORE`, `RESTAURANT`) | Paquete preconcebido de rasgos, sugerencias de módulos, plantillas de roles y paquete de textos i18n. | Identificador declarativo; prohibido usar como flag condicional en código. |
| **Rasgo operativo** | `trait` (ej. `sells_goods`, `table_service`) | Hecho operativo del comercio que habilita capacidades. | Puede ser confirmado o alterado por el dueño en el alta o administración. |
| **Plan** | `plan_code` | Nivel contratado de servicio en PlentyPay (módulos incluidos y límites de recursos). | Validado con JSON Schema en `infra-management`. |
| **Módulo** | id R10 (`pos`, `catalog`, `appointments`, etc.) | Unidad funcional y de navegación en la aplicación Flutter. | Visible si el usuario tiene permisos y el negocio tiene capacidades activas en él. |
| **Capacidad** | `capability` (ej. `pos.tables`, `catalog.variants`) | Función modular específica dentro de un módulo. | Se propaga en `x-pp-capabilities`; rechaza con `CAPABILITY_DISABLED` si está inactiva. |
| **Permiso** | `<módulo>:<acción>[:<calificador>]` | Derecho atómico a invocar un RPC o mutación (deny-by-default). | Evaluado en el gateway y en el interceptor gRPC del contenedor. |
| **Nivel de acceso** | Ver, Operar, Gestionar, Aprobar, Configurar | Agrupación didáctica de permisos en el editor visual de roles. | Solo existe en la presentación (S-ADM-03); el servidor siempre evalúa permisos atómicos. |
| **Rol base** | `UserRole` | Categoría fundamental de actor: `PLATFORM_ADMIN`, `BUSINESS_OWNER`, `BUSINESS_STAFF`, `CUSTOMER`. | Invariable en la cuenta del usuario. |
| **Plantilla de rol** | `role_template` | Rol universal o sectorial provisto por la plataforma (sólo lectura). | Base para clonar roles personalizados del negocio. |
| **Rol del comercio** | `role` con `tenant_id` | Conjunto persistido de permisos creado y administrado por el comercio. | Sujeto a reglas anti-escalada A1–A2. |
| **Membresía** | `membership` | Vínculo formal entre un usuario y un comercio específico (`role_id`, `scope`, `job_title`, `status`). | Entidad agregada en `identity`; una sola activa por persona en el MVP. |
| **Alcance** | `scope`: `TENANT` o `BRANCHES` | Límite territorial/operativo asignado a la membresía. | Propagado en `x-pp-branch-scope`. |
| **Sucursal** | `branch_id` | Establecimiento físico o lógico con código DGI de 4 dígitos (`branch_code`). | Agregado formal en `identity`. |
| **Cargo** | `job_title` | Título del puesto laboral (ej. "Cajero principal", "Estilista senior"). | Informativo; no otorga privilegios de sistema. |

---

## 3. Catálogo de verticales y rasgos operativos

### 3.1 Verticales estándar

| Familia | Vertical | Rasgos por defecto |
|---|---|---|
| Comercio | `RETAIL_STORE` | `sells_goods`, `tracks_inventory`, `purchasing`, `loyalty`, `fiscal_invoicing` |
| Comercio | `GROCERY` | `sells_goods`, `tracks_inventory`, `purchasing`, `loyalty`, `fiscal_invoicing`, `weighed_items`, `lots_expiry` |
| Comercio | `APPAREL_STORE` | `sells_goods`, `tracks_inventory`, `product_variants`, `loyalty`, `fiscal_invoicing` |
| Comercio | `WHOLESALE` | `sells_goods`, `tracks_inventory`, `b2b_customers`, `house_credit`, `purchasing`, `own_delivery`, `fiscal_invoicing` |
| Comercio | `ONLINE_SELLER` | `sells_goods`, `marketplace_seller`, `third_party_delivery` |
| Comida | `RESTAURANT` | `sells_goods`, `table_service`, `kitchen_production`, `modifiers`, `recipes`, `fiscal_invoicing` |
| Comida | `QUICK_SERVICE` | `sells_goods`, `kitchen_production`, `modifiers`, `loyalty` |
| Servicios personales | `BEAUTY_SALON` | `sells_services`, `appointments`, `sells_goods` |
| Servicios personales | `BARBERSHOP` | `sells_services`, `appointments`, `walk_in_queue` |
| Transporte | `COURIER` | `own_delivery`, `third_party_delivery`, `b2b_customers` |
| Transporte | `FREIGHT` | `fleet_management`, `freight`, `b2b_customers`, `house_credit` |
| Servicios | `PROFESSIONAL_SERVICES`| `sells_services`, `appointments`, `sells_goods` |
| General | `OTHER` | Ninguno (solo núcleo básico) |

*Nota sobre giros regulados*: Farmacias, expendio de licores y medicamentos controlados quedan postergados hasta formalizar sus requisitos legales en `docs/compliance/` (Q-34).

### 3.2 Rasgos operativos y capacidades asociadas

| Rasgo | Pregunta de configuración | Capacidades que activa |
|---|---|---|
| `sells_goods` | ¿Vendes productos físicos? | `catalog.products`, `pos.counter` |
| `sells_services` | ¿Prestas servicios con duración? | `catalog.services` |
| `tracks_inventory` | ¿Controlas existencias de inventario? | `inventory.stock` |
| `product_variants` | ¿Tus productos tienen opciones (talla, color)? | `catalog.variants` |
| `lots_expiry` | ¿Controlas lotes o fechas de vencimiento? | `inventory.lots` |
| `weighed_items` | ¿Vendes artículos por peso? | `pos.weighed_items` |
| `modifiers` | ¿Tus productos llevan extras o modificaciones? | `catalog.modifiers` |
| `table_service` | ¿Atiendes pedidos en mesas? | `pos.tables` |
| `kitchen_production` | ¿Tienes área de preparación o cocina? | `pos.kitchen_display` |
| `recipes` | ¿Descuentas insumos según recetas de preparación? | `inventory.recipes` |
| `appointments` | ¿Atiendes a clientes mediante citas? | `appointments.calendar`, `appointments.resources` |
| `walk_in_queue` | ¿Atiendes por orden de llegada? | `appointments.queue` |
| `staff_commissions` | ¿Pagas comisiones sobre ventas o servicios? | `payroll.commissions` *(desactivada por defecto, Q-32)* |
| `tips` | ¿Recibes propinas de clientes? | `pos.tips` *(desactivada por defecto, Q-21)* |
| `b2b_customers` | ¿Vendes a otras empresas o clientes mayoristas? | `catalog.price_lists`, `orders.quotes` |
| `house_credit` | ¿Ofreces crédito comercial directo? | `pos.house_credit` |
| `loyalty` | ¿Manejas programa de fidelización o puntos? | `pos.loyalty` |
| `purchasing` | ¿Emites órdenes de compra a proveedores? | `inventory.purchasing` |
| `multi_branch` | ¿Operas en múltiples locales o sucursales? | `admin.branches`, `catalog.branch_prices` |
| `own_delivery` | ¿Cuentas con repartidores propios? | `logistics.own_fleet` |
| `third_party_delivery` | ¿Utilizas transportistas o repartidores externos? | `logistics.carriers` |
| `fleet_management` | ¿Administras vehículos de carga o flota? | `logistics.fleet` |
| `freight` | ¿Transportas carga comercial pesada? | `logistics.freight` |
| `marketplace_seller` | ¿Publicas tus productos en el marketplace? | `catalog.listing`, `orders.marketplace` |
| `fiscal_invoicing` | ¿Emites factura electrónica ante la DGI? | `finance.fiscal` |
| `payroll` | ¿Gestionas nómina y asistencia laboral? | `payroll.runs`, `payroll.attendance` |

---

## 4. Capacidades estándar y módulos

El sistema organiza las funciones en ~38 capacidades distribuidas entre 12 módulos:

1. **`wallet` (Billetera)**: `wallet.balance`, `wallet.transfer`, `wallet.pay` *(Núcleo personal; siempre activo)*.
2. **`marketplace` (Comprar)**: `marketplace.buy` *(Núcleo personal; siempre activo)*.
3. **`pos` (Punto de Venta)**:
   - `pos.counter`: venta tradicional en mostrador y apertura/cierre de turnos.
   - `pos.offline`: operación offline con almacenamiento local y sincronización.
   - `pos.customer_display`: visor para cliente.
   - `pos.house_credit`: cobro mediante cuenta corriente/crédito del cliente.
   - `pos.loyalty`: redención y acumulación de puntos.
   - `pos.tables`: apertura, transferencia y gestión de comandas en mesas.
   - `pos.kitchen_display`: pantalla y cola de preparación en cocina.
   - `pos.split_bill`: división de cuentas entre múltiples comensales o medios de pago.
   - `pos.tips`: recepción y distribución de propinas *(requiere Q-21)*.
   - `pos.weighed_items`: lectura e integración de balanzas.
4. **`orders` (Pedidos)**:
   - `orders.marketplace`: recepción y despacho de pedidos del marketplace.
   - `orders.quotes`: elaboración de cotizaciones comerciales para clientes B2B.
   - `orders.b2b`: pedidos mayoristas con condiciones comerciales especiales.
5. **`appointments` (Agenda y Citas - Nuevo módulo)**:
   - `appointments.calendar`: agenda interactiva de citas y reservas por profesional.
   - `appointments.queue`: lista de espera en sala por turno de llegada.
   - `appointments.online_booking`: reserva pública por parte del cliente.
   - `appointments.deposits`: abonos previos para aseguramiento de reserva *(requiere Q-33)*.
   - `appointments.resources`: asignación de cabinas, sillones y equipamiento.
6. **`catalog` (Catálogo)**:
   - `catalog.products`: mantenimiento de artículos y precios base.
   - `catalog.services`: catálogo de servicios con duración estimada.
   - `catalog.variants`: variantes por atributos (tallas, colores).
   - `catalog.modifiers`: modificadores y agregados para platos o productos.
   - `catalog.branch_prices`: precios diferenciados por sucursal.
   - `catalog.price_lists`: listas de precios por tipo o volumen de cliente.
   - `catalog.listing`: publicación de catálogo en el marketplace.
   - `catalog.storefront`: vitrina digital pública.
7. **`inventory` (Inventario)**:
   - `inventory.stock`: saldos físicos, ajustes y kardex.
   - `inventory.lots`: trazabilidad de lotes y fechas de expiración (FEFO).
   - `inventory.transfers`: traslados de mercadería entre bodegas y sucursales.
   - `inventory.purchasing`: órdenes de compra y recepción contra proveedores.
   - `inventory.recipes`: explosión de insumos y recetas por preparación.
8. **`logistics` (Logística)**:
   - `logistics.own_fleet`: asignación y monitoreo de repartidores propios.
   - `logistics.carriers`: despacho mediante operadores logísticos externos.
   - `logistics.geofences`: áreas de cobertura y tarifas por zona.
   - `logistics.fleet`: control de vehículos, mantenimientos e inspecciones.
   - `logistics.freight`: guías de carga y cálculo por peso/volumen.
   - `logistics.routes`: optimización y ruteo de entregas.
9. **`finance` (Finanzas)**:
   - `finance.payments`: procesamiento de pagos presenciales y digitales.
   - `finance.terminals`: administración de terminales de cobro (POS/mPOS).
   - `finance.settlement`: conciliación bancaria y programación de liquidaciones.
   - `finance.fiscal`: emisión de facturación electrónica conforme a la DGI.
10. **`payroll` (Equipo y Nómina)**:
    - `payroll.attendance`: registro de entradas y salidas laborales.
    - `payroll.kiosk`: modo quiosco para marcaje presencial.
    - `payroll.runs`: cálculo, aprobación y dispersión de planillas de pago.
    - `payroll.commissions`: cálculo de comisiones individuales por venta o servicio.
    - `payroll.tips_distribution`: distribución de propinas consolidadas.
11. **`analytics` (Análisis)**:
    - `analytics.dashboards`: tableros de control operacional y financiero.
    - `analytics.ask`: consultas en lenguaje natural mediante IA.
    - `analytics.forecast`: proyección de demanda y ventas.
    - `analytics.export`: exportación de reportes tabulares y contables.
12. **`admin` (Mi Negocio)**:
    - `admin.profile`: datos de razón social, RUC, logo y configuración general.
    - `admin.staff`: invitación y gestión de miembros del equipo.
    - `admin.roles`: definición y parametrización de roles personalizados.
    - `admin.branches`: alta y mantenimiento de sucursales físicas y lógicas.
    - `admin.modules`: encendido y apagado de capacidades y funciones.
    - `admin.integrations`: llaves de API y webhooks.
    - `admin.audit`: consulta inmutable de registros de auditoría.

### 4.1 Capacidades que dependen del dispositivo

Algunas capacidades del comercio necesitan hardware del equipo: `pos.weighed_items` (balanza), `payroll.kiosk` (cámara para el marcaje facial), `logistics.*` y `payroll.attendance` (ubicación), los cobros por NFC (F23.2) y la confirmación fuerte con passkey. La app las resuelve con el registro de capacidades del dispositivo (`device.*`, [`../security/strong-authentication.md`](../security/strong-authentication.md) §6). Si el equipo no las tiene o el permiso fue negado, la pantalla lo explica y ofrece la alternativa (otro equipo, digitar el código, PIN en lugar de passkey); nunca falla en silencio ni apaga la capacidad del comercio. Las capacidades del comercio dicen qué puede hacer el negocio; las del dispositivo, qué puede hacer este equipo.

---

## 5. Plantillas de roles universales y sectoriales

### 5.1 Plantillas universales (disponibles en cualquier comercio)

| Clave de plantilla | Nombre | Responsabilidad | Permisos que incluye |
|---|---|---|---|
| `manager` | Gerente | Operar y gestionar integralmente el comercio día a día sin configurar credenciales ni roles. | `catalog:write`, `catalog:import`, `catalog:listing:manage`, `inventory:adjust`, `inventory:purchase:manage`, `inventory:receive`, `pos:sell`, `pos:void`, `pos:refund`, `pos:session:manage`, `pos:settings:manage`, `pos:discount:apply`, `orders:read`, `orders:manage`, `logistics:read`, `logistics:manage`, `logistics:deliver`, `logistics:geofence:manage`, `payments:charge`, `payments:read`, `payments:refund`, `settlement:read`, `fiscal:read`, `fiscal:issue`, `fiscal:note:issue`, `analytics:read`, `payroll:attendance:read`, `payroll:employee:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `supervisor` | Supervisor de turno | Autorizar excepciones de caja, devoluciones, anulación de tickets y supervisar turnos. **No incluye venta para evitar conflicto SoD.** | `pos:void`, `pos:refund`, `pos:discount:apply`, `pos:session:manage`, `payroll:attendance:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `cashier` | Cajero | Atender clientes, registrar ventas, cobrar y emitir comprobantes fiscales. | `pos:sell`, `pos:session:manage`, `payments:charge`, `payments:read`, `catalog:read`, `inventory:read`, `fiscal:issue`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `stock_keeper` | Almacenista | Recepción de mercadería, recuentos físicos y traslados de inventario. | `inventory:read`, `inventory:adjust`, `inventory:purchase:manage`, `inventory:receive`, `catalog:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `courier` | Repartidor | Conducción, reparto de pedidos y confirmación de entrega en ruta. | `logistics:deliver`, `logistics:read`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `accountant` | Contador | Fiscalidad, conciliaciones bancarias, liquidaciones, exportación analítica y prenómina. | `fiscal:read`, `fiscal:issue`, `fiscal:note:issue`, `settlement:read`, `settlement:reconcile`, `payments:read`, `analytics:read`, `analytics:export`, `payroll:run:create`, `payroll:attendance:record`, `payroll:payslip:read:self` |
| `viewer` | Solo lectura | Auditoría, socios pasivos o inspectores externos sin facultades de mutación. | `catalog:read`, `inventory:read`, `orders:read`, `logistics:read`, `payments:read`, `settlement:read`, `fiscal:read`, `payroll:attendance:read`, `analytics:read` |

### 5.2 Plantillas sectoriales

Se presentan en el catálogo de creación de roles únicamente si la vertical del comercio las soporta:
- **Restaurantes y cafeterías**: `waiter` (Mesero), `host` (Anfitrión), `kitchen` (Cocinero/Barra), `bartender` (Barman).
- **Salones y barberías**: `stylist` (Profesional/Estilista/Barbero), `receptionist` (Recepción), `salon_manager` (Encargado de salón).
- **Mayoristas y distribución**: `sales_rep` (Vendedor de campo), `credit_officer` (Analista de crédito), `warehouse_lead` (Jefe de bodega), `dispatcher` (Despachador).
- **Transportistas y logística**: `fleet_manager` (Jefe de flota), `billing_clerk` (Facturador de carga).
- **Comercio detallista / retail**: `sales_associate` (Asesor de ventas en piso).

---

## 6. Gobierno, delegación y reglas anti-escalada

Cualquier mutación sobre roles (`CreateRole`, `UpdateRole`) o membresías (`InviteStaff`, `UpdateMembership`) debe satisfacer tres invariantes inviolables:

```text
[Operación sobre Rol o Miembro]
               │
               ▼
      ¿A1: Concede solo lo que posee? ──── No ───► RECHAZAR: PERMISSION_NOT_HELD
               │ Sí
               ▼
      ¿A2: Intenta auto-ampliarse? ─────── Sí ───► RECHAZAR: SELF_ASSIGNMENT_FORBIDDEN
               │ No
               ▼
      ¿A3: Intenta crecer de alcance? ──── Sí ───► RECHAZAR: BRANCH_OUT_OF_SCOPE
               │ No
               ▼
         [APLICAR MUTACIÓN]
```

- **A1 (Nadie concede lo que no tiene)**: Todo permiso asignado a un rol o usuario debe formar parte de los permisos efectivos del actor autenticado. Excepción: el dueño del negocio (`BUSINESS_OWNER`), quien por definición ostenta la plenitud de permisos del tenant.
- **A2 (Nadie se amplía a sí mismo)**: Ningún usuario puede modificar su propio rol, los permisos del rol que actualmente tiene asignado, ni el alcance de su propia membresía.
- **A3 (El alcance no crece al delegar)**: Quien posee alcance `BRANCHES` solo puede asignar membresías cuyo alcance sea un subconjunto de sus sucursales asignadas. Jamás puede otorgar alcance `TENANT` ni sucursales ajenas.

### Separación de funciones (SoD - Segregation of Duties)
El sistema audita e implementa controles frente a la acumulación de privilegios críticos en una misma persona:
1. `payroll:run:create` + `payroll:run:approve`: riesgo de nómina fraudulenta. Se bloquea de forma mandatoria en equipos de tamaño ≥ umbral de `infra-management` (`access.sod.enforce_min_members`).
2. `pos:sell` + `pos:void` / `pos:refund`: riesgo de anulación de ventas propias. Requiere step-up obligatorio al ejecutarse sobre operaciones registradas por el mismo actor y emite alerta de auditoría.
3. `payments:charge` + `payments:refund`: riesgo análogo fuera de la caja registradora.
4. `inventory:adjust` + `inventory:receive`: riesgo de encubrir faltantes de mercadería en recepciones de proveedores.

---

## 7. Alcance por sucursal (`Branch Scope`)

1. **Propiedad en `identity`**: El agregado `Branch` es propiedad exclusiva de `identity`. Todo comercio nace con al menos una sucursal matriz (`code = "0000"`, tipo `STORE` o `VIRTUAL`).
2. **Propagación en contexto**:
   - `TENANT` se propaga en metadatos gRPC como `x-pp-branch-scope: *`.
   - `BRANCHES` se propaga como lista de UUIDs: `x-pp-branch-scope: 018d...,018e...`.
3. **Defensa por contenedor**:
   - Cada contenedor que persiste `branch_id` valida en cada mutación que el `branch_id` del registro pertenezca a la lista de `x-pp-branch-scope`. Si está fuera, rechaza con `PERMISSION_DENIED` y `reason: BRANCH_OUT_OF_SCOPE`.
   - En lecturas (`List*`, `Get*`), los filtros aplican automáticamente el alcance del usuario sin retornar registros ajenos (`NOT_FOUND` si se consulta un ID puntual fuera de alcance).

---

## 8. Resolución determinista del permiso efectivo

La función pura de resolución de permisos en `identity` opera de acuerdo con el siguiente algoritmo formal:

```text
Entrada: Usuario (u), Membresía activa (m), Negocio (t), Plan (p)

1. base ← permisos de CUSTOMER (billetera y marketplace propio)
2. Si u.role = PLATFORM_ADMIN:
     Retornar: base ∪ platform:* ∪ lecturas_auditoría_soporte, alcance: "*"
3. Si m es nula o m.status != ACTIVE:
     Retornar: base, alcance: ""
4. Si m.base_role = BUSINESS_OWNER:
     rol_perms ← CatálogoCompleto − platform:*
   Sino (BUSINESS_STAFF):
     Si m.role_id es no nulo:
       rol_perms ← store.Role(m.role_id).permissions
     Sino:
       rol_perms ← Ø   // Deny-by-default (P1)
5. capacidades_activas ← capacidades(t.perfil) ∩ capacidades(p) ∪ t.overrides_activados − t.overrides_desactivados
6. negocio_perms ← { p ∈ rol_perms | capacidad_asociada(p) ∈ capacidades_activas ∨ es_permiso_núcleo(p) }
7. efectivos ← base ∪ negocio_perms
8. módulos ← ModulesForPermissions(efectivos)
9. Si m.scope = TENANT:
     alcance ← "*"
   Sino:
     alcance ← IDs de sucursales activas en m.branch_ids

Salida: { role: m.base_role, permissions: efectivos, enabled_modules: módulos, branch_scope: alcance, capabilities: capacidades_activas }
```

### Vectores de prueba normativos (V1–V9)
- **V1 (`TestR10_CustomerOnly`)**: Persona sin negocio ni membresía activa. Recibe solo `wallet:*`, `catalog:read`, `orders:read:self`, `orders:create:self`, `notifications:read:self`; módulos: `wallet`, `marketplace`.
- **V2 (`TestR21_OwnerLimitedByCapabilities`)**: Dueño de comercio con inventario y logística apagados. Recibe los permisos del negocio excepto `inventory:*` y `logistics:*`.
- **V3 (`TestR24_StylistBranchScope`)**: Barbero con plantilla `stylist` y alcance acotado a la sucursal "Costa del Este". Su `x-pp-branch-scope` contiene únicamente el UUID de dicha sucursal.
- **V4 (`TestR21_DisabledCapabilityDropsPermission`)**: Rol personalizado con `inventory:adjust` en un comercio que desactiva la capacidad `inventory.stock`. El permiso desaparece de sus efectivos pero permanece almacenado en el rol; al reactivar la capacidad, el permiso se restituye sin reconfiguración.
- **V5 (`TestR11_PendingTenantKeepsPermissions`)**: Cajero en un comercio en estado `PENDING_REVIEW`. Mantiene `payments:charge` en sus permisos efectivos, pero `payments-core` deniega la transacción en tiempo de ejecución con `TENANT_NOT_ACTIVE`.
- **V6 (`TestR22_AssignedCustomRoleResolves`)**: Staff con rol personalizado recibe exactamente sus permisos asignados más la base `CUSTOMER`, sin caer jamás en presets por omisión.
- **V7 (`TestR23_ScopeCannotGrow`)**: Miembro con alcance acotado a una sucursal intenta invitar a un usuario con alcance `TENANT` o asignar una sucursal distinta. Se rechaza con `BRANCH_OUT_OF_SCOPE`.
- **V8 (`TestR23_CannotGrantUnheldPermission`)**: Actor intenta crear o editar un rol incluyendo un permiso que no posee en sus efectivos. Se rechaza con `PERMISSION_NOT_HELD`.
- **V9 (`TestR23_NoSelfEscalation`)**: Actor intenta modificar el rol que tiene asignado o editar su propia membresía. Se rechaza con `SELF_ASSIGNMENT_FORBIDDEN`.

---

## 9. Decisiones de integración

Esta sección formaliza las desviaciones y adaptaciones realizadas respecto al documento preliminar de propuesta (`docs/proposals/business-profiles-and-access.md`):

1. **Resolución de permisos de staff y eliminación de fallback (H1)**:
   - *Propuesta*: Señaló que `PermissionsForUser` usaba el rol base y devolvía el preset de cajero por omisión.
   - *Decisión ejecutada*: Se implementó deny-by-default estricto. Si un `BUSINESS_STAFF` no tiene un rol asignado en `user_roles` (o membresía), recibe **únicamente la base `CUSTOMER`**. No hay fallback a cajero.

2. **Unificación de presets y limpieza de semillas SQL (H2)**:
   - *Propuesta*: Señaló inconsistencias entre los presets de `security-standards.md`, `permissions.go` y la migración `0005`.
   - *Decisión ejecutada*: Se unificaron los 7 presets universales (`manager`, `supervisor`, `cashier`, `stock_keeper`, `courier`, `accountant`, `viewer`). Se mantuvieron los UUIDs originales en la migración `0005` mediante actualización idempotente para no romper asignaciones previas. Se eliminaron de raíz `payroll:read` y `logistics:proof:capture` por no existir en el catálogo de contratos.

3. **Supervisor sin venta directa (`pos:sell`)**:
   - *Propuesta*: La propuesta original incluía permisos de caja general.
   - *Decisión ejecutada*: Se omitió explícitamente `pos:sell` de la plantilla universal `supervisor` para garantizar el principio de separación de funciones (evitar que el supervisor anule o devuelva sus propias ventas).

4. **Tratamiento de errores en Outbox de Invitaciones (H10)**:
   - *Propuesta*: No identificó el descarte de error `_ = s.sessions.WriteOutboxEvent(...)` en `InviteStaff`.
   - *Decisión ejecutada*: Se corrigió la violación de la regla inviolable 14 de `AGENTS.md`. Cualquier fallo al persistir en el outbox se envuelve y propaga como error, reportándolo como defecto al reporter de observabilidad.

5. **Propagación contextual de capacidades (`x-pp-capabilities`)**:
   - *Propuesta*: Sugería verificación indirecta de capacidades en servicios.
   - *Decisión ejecutada*: El gateway propaga la lista de capacidades habilitadas del tenant en el header `x-pp-capabilities` junto a `x-pp-branch-scope`. Esto permite a los servicios rechazar con `CAPABILITY_DISABLED` capacidades funcionales que no poseen un permiso único diferenciado (ej. `pos.tips`, `catalog.variants`, `inventory.lots`).

6. **Creación atómica de negocio y sucursales**:
   - *Propuesta*: Sugería endpoints separados para crear perfil y sucursal.
   - *Decisión ejecutada*: `CreateBusiness` crea de forma atómica en una única transacción de base de datos el tenant, la membresía del dueño con alcance `TENANT`, la sucursal matriz (`code: "0000"`) y el conjunto de capacidades predeterminadas según los rasgos seleccionados.
