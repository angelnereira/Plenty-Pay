# ADR 0001 — Solo tres tecnologías: Rust, Go y Flutter

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
El sistema maneja dinero real a gran escala (objetivo ≥ 500 000 usuarios diarios, millones de transacciones) y debe ser mantenible por un equipo pequeño y por agentes de código. Cada lenguaje adicional multiplica imágenes base, herramientas de CI, estándares y superficie de seguridad. El sistema de origen usaba TypeScript/Next.js/Prisma.

## Decisión
1. **Rust** para el núcleo de dinero: `ledger`, `payments-core`, `settlement`. Motivo: enums exhaustivos para máquinas de estado, aritmética con chequeo de desbordamiento, sin GC, sin condiciones de carrera de datos.
2. **Go** para todos los demás servicios (identity, gateway, catálogo, inventario, POS, logística, etc.). Motivo: productividad, ecosistema gRPC/Kubernetes, binarios estáticos pequeños, concurrencia simple.
3. **Flutter/Dart** para **toda** interfaz (Android, iOS, Linux, Windows, macOS, Web). No hay frontend web separado.
4. Herramientas de desarrollo fuera de la ruta de producción pueden usar otra tecnología si están marcadas (p. ej. `scripts/ledger-tests` en Node).
5. Componentes de plataforma **de terceros OSS** (PostgreSQL, ScyllaDB, NATS, Garage, OpenBao, Prometheus, Grafana...) se usan como imágenes oficiales; no se escriben en otro lenguaje.

## Consecuencias
+ Un solo conjunto de estándares por lenguaje (`go-standards.md`, `rust-standards.md`, `flutter-standards.md`).
+ El legado TypeScript queda en `_legacy-typescript-reference/` solo como referencia de reglas.
− La facturación DGI (antes en TS) se reescribe en Go.
− Rust tiene curva de aprendizaje: se limita a 3 contenedores.

## Alternativas consideradas
TypeScript en backend (descartado: dos runtimes de servidor, flotantes por defecto); Java/Kotlin (JVM pesada para contenedores pequeños); solo Go (perdería garantías en el núcleo de dinero); solo Rust (ralentiza los módulos CRUD).
