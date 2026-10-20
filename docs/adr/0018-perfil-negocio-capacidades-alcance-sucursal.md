# ADR 0018 — Perfil de negocio, capacidades y alcance por sucursal

- **Estado**: Aceptada
- **Fecha**: 2026-10-19
- **Decisores**: Arquitectura PlentyPay

## Contexto
En el modelo inicial de PlentyPay (commit `6d25a0d`), todos los comercios visualizaban los mismos módulos y capacidades con independencia de su actividad económica (un salón de belleza o barbería recibía 11 módulos incluyendo compras de inventario a proveedores y logística pesada). Asimismo, se diagnosticaron limitaciones estructurales:
1. El rol asignado a un empleado (`user_roles`) no se evaluaba al resolver permisos en tiempo de ejecución, asignando por omisión el preset de cajero a cualquier `BUSINESS_STAFF` (H1).
2. Los presets de roles divergían entre documentación, código y semillas SQL (H2).
3. El concepto de sucursal (`branch_id`) era referenciado por múltiples subsistemas (POS, inventario, logística, facturación), pero no existía un agregado formal dueño del ciclo de vida de las sucursales (H3).
4. El personal no contaba con delimitación de alcance geográfico/operativo por sucursal (H4).
5. No existía categorización de negocio por vertical ni activación modular orientada a capacidades de producto (H5, H6).
6. Faltaban capacidades operativas demandadas por sectores de servicios y gastronomía (citas, comandas, mesas, recetas) (H7).
7. La invitación a usuarios con cuenta previa colisionaba con `EMAIL_TAKEN` (H8).

Se requiere un modelo ortogonal y coherente que responda de forma independiente tres preguntas: **qué puede usar el negocio** (capacidades), **qué puede hacer la persona** (rol y permisos) y **dónde puede hacerlo** (alcance por sucursal).

## Decisión

1. **Ortogonalidad de tres capas**:
   - **Capacidades del negocio (`capabilities`)**: determinan qué funciones y módulos están habilitados para el comercio a partir de su perfil de negocio (vertical principal, secundarias y rasgos operativos) y de su plan contratado. El código de los contenedores evalúa capacidades (`CAPABILITY_DISABLED`), jamás el nombre textual de la vertical.
   - **Roles y permisos de la persona (`permissions`)**: determinan qué acciones atómicas (`<módulo>:<acción>[:<calificador>]`) puede ejecutar la persona. Los roles describen responsabilidades operativas, nunca puestos de trabajo (que se expresan en el metadato laboral `job_title`).
   - **Alcance por sucursal (`scope`)**: delimita dónde aplica el rol de la persona. Puede ser `TENANT` (todo el comercio, actual y futuro) o `BRANCHES` (lista explícita de identificadores de sucursal).

2. **Agregados `Branch` y `Membership` en `identity`**:
   - `identity` asume la propiedad del agregado `Branch`, gestionando su código fiscal DGI de 4 dígitos (`branch_code`), nombre, tipo (`STORE`, `WAREHOUSE_ONLY`, `KITCHEN`, `SALON`, `DEPOT`, `VIRTUAL`), geolocalización, horario y vigencia.
   - Se introduce la entidad `Membership` como relación explícita usuario ↔ negocio, desacoplando la identidad personal (`users`) de la pertenencia comercial y permitiendo a futuro membresías múltiples (H9). Para el MVP se mantiene el invariante de una única membresía activa por usuario.
   - Todo nuevo negocio crea en una única transacción: el registro del tenant, la membresía del dueño con alcance `TENANT`, la sucursal matriz (`0000`) y las capacidades base.

3. **Propagación en el borde (Gateway y Metadatos gRPC)**:
   - `api-gateway` valida el token de sesión y propaga hacia los servicios internos los metadatos contextuales:
     - `x-pp-branch-scope`: `*` para alcance `TENANT`, o lista separada por comas de UUIDs de sucursales para `BRANCHES`.
     - `x-pp-capabilities`: lista separada por comas de las capacidades activas del negocio.
   - Cada contenedor valida localmente que los recursos accedidos pertenezcan al alcance del usuario; cualquier infracción responde `PERMISSION_DENIED` con el `reason` canónico `BRANCH_OUT_OF_SCOPE` en mutaciones o `NOT_FOUND` en consultas de lectura.
   - Una invocación a una función cuya capacidad esté inactiva responde `FAILED_PRECONDITION` con `reason` canónico `CAPABILITY_DISABLED`.

4. **Reglas de gobierno anti-escalada (A1–A3)**:
   - **A1 (No conceder lo que no se posee)**: Un actor solo puede crear roles o invitar staff con permisos que estén estrictamente contenidos en sus propios permisos efectivos (`PERMISSION_NOT_HELD`).
   - **A2 (No auto-ampliación)**: Un actor no puede modificar su propio rol, autoasignarse permisos ni alterar su propia membresía (`SELF_ASSIGNMENT_FORBIDDEN`).
   - **A3 (No crecimiento de alcance)**: Un actor con alcance delimitado a `BRANCHES` solo puede delegar roles sobre el subconjunto de sus sucursales asignadas; nunca puede conceder alcance `TENANT` ni sucursales ajenas (`BRANCH_OUT_OF_SCOPE`).

5. **Principio Deny-by-Default para staff**:
   - Un usuario con rol base `BUSINESS_STAFF` sin rol personalizado asignado recibe únicamente los permisos de la base `CUSTOMER` (billetera propia y compras en marketplace). Se elimina el fallback automático al rol de cajero.

6. **Catálogo unificado de plantillas universales y presets**:
   - Se unifican los roles base de sistema bajo identificadores estables y sincronizados: `manager`, `supervisor`, `cashier`, `stock_keeper`, `courier`, `accountant` y `viewer`.
   - `supervisor` excluye explícitamente `pos:sell` para evitar el conflicto de separación de funciones (anular y devolver sus propias ventas).

7. **Separación de funciones (SoD)**:
   - Se establecen advertencias automáticas en la definición de roles para pares de alto riesgo (`payroll:run:create` + `payroll:run:approve`, `pos:sell` + `pos:refund`/`void`, etc.), bloqueando combinaciones críticas en equipos mayores al umbral parametrizado en `infra-management` (`access.sod.enforce_min_members`).

## Consecuencias
- **Positivas (+)**:
  - Personalización instantánea de la experiencia de usuario según el giro comercial sin bifurcar código.
  - Seguridad reforzada con defensa en profundidad (gateway + RLS + verificación de capacidad en cada contenedor).
  - Eliminación de defectos críticos (H1, H2, H8, H10) y soporte formal para multi-sucursal y gobierno delegado.
- **Negativas (−)**:
  - Mayor tamaño de metadatos en peticiones internas gRPC (`x-pp-branch-scope`, `x-pp-capabilities`).
  - Necesidad de invalidación de caché en el gateway ante eventos de outbox (`pp.identity.role.changed.v1`, `pp.identity.membership.changed.v1`, `pp.identity.capabilities.changed.v1`).

## Alternativas consideradas
1. *Bifurcación de lógica con condicionales por vertical en el código*: Descartada por violar ADR 0009 y generar acoplamiento severo y duplicación.
2. *Control de acceso exclusivamente en la interfaz gráfica Flutter*: Descartada por violar la regla inviolable 14 y el principio de defensa en profundidad; el servidor debe aplicar deny-by-default en cada RPC.
3. *Microservicio independiente para gestión de sucursales*: Descartada por sobrecarga operativa y acoplamiento íntimo con el ciclo de vida de usuarios y membresías en `identity`.
