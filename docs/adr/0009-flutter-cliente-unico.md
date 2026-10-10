# ADR 0009 — Una sola app Flutter con navegación dinámica por permisos

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Comercios, empleados, clientes y plataforma necesitan interfaces distintas en móvil, escritorio y web.

## Decisión
1. Un solo proyecto `flutter_app/` compila para Android, iOS, Linux, Windows, macOS y Web.
2. Tras el login, el servidor devuelve `modules` y `permissions`; la app muestra solo esos módulos (`ModuleRegistry`), en el orden del registro.
3. Modos especiales (quiosco de marcaje, POS fijo, pantalla del cliente) son rutas de la misma app.
4. Los binarios se publican en `output/` en cada release.

## Consecuencias
+ Una base de código de UI; consistencia visual (`docs/design-system.md`).
− El bundle web es más pesado: carga diferida por módulo.

## Alternativas consideradas
Apps separadas por rol (duplicación); web en otro framework (viola ADR 0001).
