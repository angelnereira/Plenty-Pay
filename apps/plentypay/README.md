# apps/plentypay — Cliente Flutter único

La única aplicación: Android, iOS, Windows, Linux (mandato §2/§6; ADR-0003 — macOS diferido). App **dinámica**: el backend resuelve identity→tenant→role→permissions→features y la app pinta solo capacidades autorizadas.

**Estado: BLOCKED-LOCAL (toolchain) — código en CI**

| Bloque | Estado |
|---|---|
| Flutter SDK local | BLOCKED-LOCAL: host arm64; Flutter solo publica Linux x64 (verificado en releases_linux.json); sin qemu binfmt |
| Estrategia | Builds/analyze/test en CI x64; artefactos a `output/` (§19) |
| Design system (grises oscuros/claros + rojo, moderno 2026) | PLANNED — tokens centralizados |
| Shell dinámico por AuthorizationContext | PLANNED |
| Persistencia local offline (POS offline, doc 00 §3.1) | PLANNED — SQLite+Drift SOLO datos locales (ADR-0010: el cliente jamás conecta a la BD del servidor) |

## Pantallas Etapa 1 (mandato §9: reales, no placeholders)

**Auth**: signin · signup (crear cuenta personal o negocio) · recuperar contraseña.
**Shell dinámico**: navegación generada por `GetAuthorizationContext` (features/permissions); estados loading/error/empty/sin-permiso; bottom-nav adaptativa.
**Consumidor (features wallet/payments/history/notifications)**: Wallet (saldo available/held) · Enviar/Recibir · Pagos por QR · Historial de movimientos (desde `ledger.v1`) · Notificaciones · Perfil.
**Empresa (features pos/sales/catalog/inventory/invoicing/employees/payroll/reports/branches/settings)**: Dashboard · POS (venta con estados del charge) · Ventas · Catálogo · Inventario · Facturación · Empleados/Nómina · Reportes · Sucursales · Configuración.
**Kiosco/Quiosco** (feature flag de plataforma, doc 00 §5): pantalla fija de marcaje.

Cada pantalla declara su estado (IMPLEMENTED/PARTIAL/MOCK/BLOCKED) — §22.
