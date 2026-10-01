# Master Engineering Instructions — PlentyPay

Doctrina de ingeniería obligatoria del proyecto, codificada desde el mandato del propietario (2026-10-01). Cualquier trabajo en este repo se ejecuta bajo estas reglas; los ADRs en `20-DECISIONES-ARQUITECTURA.md` registran decisiones concretas.

## 0. Prioridad inmutable
1 Corrección · 2 Seguridad · 3 Integridad financiera · 4 Arquitectura modular · 5 Portabilidad · 6 Testabilidad · 7 Observabilidad · 8 Rendimiento · 9 UX · 10 Velocidad.
Nunca sacrificar integridad financiera, seguridad o corrección por velocidad.

## 1. Reglas esenciales (resumen operativo — el texto íntegro rige)

- **Fuente de verdad**: docs producto (00-04). Contradicciones: detener → identificar → decisión más reciente → documentar → una sola regla en código. La documentación evoluciona con el código.
- **Lenguajes**: Flutter/Dart (único cliente: Android, iOS, Windows, Linux — no web, no nativos separados), Rust (camino crítico del dinero: ledger, motor financiero, cripto cuando aplique), Go (servicios de red, gRPC, gateways, adaptadores, identidad, notificaciones). **Prohibido** introducir cualquier otro lenguaje de aplicación (TS, JS, Python, Java, Kotlin, Swift, C#, PHP, Ruby…). Herramientas declarativas de build/deploy no son lenguajes de negocio.
- **Arquitectura**: responsabilidad única por servicio; dependencia solo vía contratos gRPC + Protocol Buffers; prohibido importar código interno de otro servicio, compartir modelos internos, tocar su BD o crear atajos.
- **Autocontención**: cada servicio construible/probable/ejecutable/contenerizable dentro de su límite; eliminable sin perder nada escondido en otros módulos.
- **Root**: `apps/ services/ contracts/ infrastructure/ deployment/ docs/ scripts/ tests/ output/` — evolución progresiva, no copia ciega.
- **Flutter**: capas presentation/application/domain/data/infrastructure; sin lógica financiera en widgets; sin acceso a datos desde widgets; pantallas consumen casos de uso y contratos.
- **App dinámica**: UNA app; el backend resuelve identity→tenant→role→permissions→features→modules→screens→actions. Ocultar en UI ≠ seguridad: autorización real en backend.
- **UI/UX**: grises oscuros/claros, rojo de énfasis, moderna 2026, responsive, accesible; design system centralizado, cero duplicación.
- **Pantallas reales por módulo documentado** (no 3 placeholders y "listo"); estados loading/error/empty/validación/permisos; mocks solo marcados.
- **Backend**: gRPC entre servicios; sin REST interno; REST solo si integración externa lo exige.
- **Payment Core separado**: Intent / Payment / Attempt / Settlement / Ledger; orquestador no toca estructuras del ledger; rieles por adaptador (agregar riel = agregar adaptador).
- **Ledger**: doble partida, invariantes, idempotencia, reversos explícitos, transacciones, dinero exacto; **prohibido float/double**; `SUM(DEBIT)==SUM(CREDIT)` antes de confirmar; nunca editar histórico.
- **Seguridad**: Zero Trust, Least Privilege, Defense in Depth, Fail Secure; passkeys/WebAuthn cuando aplique, RBAC, rate limiting, auditoría, cifrado, secretos gestionados, rotación, validación, idempotencia, anti-replay, trazabilidad. **Cero secretos en Git**.
- **Docker**: un contenedor por servicio; `docker compose up --build` da entorno funcional; multi-stage; imágenes mínimas.
- **Kubernetes**: compatible desde el diseño; escalado independiente (ledger×3, payments×10, notifications×5, identity×4) sin tocar negocio.
- **Infra**: Terraform/OpenTofu, sin acoplarse a proveedor; separar network/compute/database/storage/security/observability/secrets/messaging; dependencias de proveedor aisladas.
- **Observabilidad**: logs estructurados, correlation/request/trace IDs, métricas, health/readiness/liveness, tracing distribuido.
- **Datos**: PostgreSQL principal; propiedad de datos por servicio; cross-domain solo por contratos; NoSQL solo con justificación documentada.
- **output/**: obligatorio, con artefactos compilados de la etapa; no declarar plataforma terminada sin artefacto o limitación documentada.
- **Testing**: unit + integration + contract por servicio; componentes financieros: idempotencia, concurrencia, rollback, errores, duplicación, timeout, retry, consistencia, límites, permisos, autenticación. Nunca borrar tests para pasar el build.
- **Calidad**: SOLID/DRY/KISS/SoC/DI/Fail Fast/Errores explícitos; cero sobreingeniería; abstracciones solo con problema concreto.
- **Anti-mock**: funcionalidad "implementada" solo si es real; estados declarados: `IMPLEMENTED PARTIAL MOCK STUB TODO BLOCKED`.
- **Anti-muerte**: sin código duplicado/abandonado/paralelo/obsoleto; migración verificada ⇒ eliminar lo viejo.
- **Cambios arquitectónicos**: decidir→motivo→impacto→docs→contratos→implementar→tests→build→docker→integración. Nunca silenciosos.
- **Orden**: etapas 1-5 (Foundation, Core, Commerce, Integraciones, Escalabilidad).
- **Ejecución**: tras cada cambio: format/lint/test/build/docker build/compose config/up — equivalentes Rust, Go y Flutter. No asumir que compila: comprobar.
- **Autonomía**: preguntar solo decisiones que cambien materialmente arquitectura/seguridad/modelo financiero/comportamiento/contrato público/infraestructura/compatibilidad.
- **No alucinación**: nunca inventar APIs/SDKs/capacidades/regulatorio; lo externo no verificado se marca `UNVERIFIED`, nunca se finge.
- **Producción**: código pensado para producción; primera implementación pequeña, no desechable.
- **DoD**: código+tests+lint+build+integración+docker+contratos+docs+permisos+errores+observabilidad, sin TODO crítico, sin mocks ocultos, sin secretos, sin dependencias prohibidas.
- **Principio final**: plataforma financiera modular, no monolito disfrazado. Cada componente: una responsabilidad, un contrato, un límite, una implementación, un test, un contenedor. Optimizar por límites claros + contratos estables + integridad financiera + seguridad + observabilidad + portabilidad + capacidad de evolución.
