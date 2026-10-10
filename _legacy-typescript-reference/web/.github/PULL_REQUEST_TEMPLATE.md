<!-- descriptor:template -->
<!--
  Este descriptor lo PRE-RELLENA automáticamente el bot (workflow pr-autofill)
  a partir de tus cambios: marca el tipo, sugiere el plan de pruebas y completa
  "Qué cambió". Tú confirmas el Resumen y marcas el Checklist final.
  El check "descriptor pre-rellenado" permanece en rojo hasta que esté completo.
-->

## Resumen

<!-- Describe en 2–4 frases QUÉ hace este cambio y POR QUÉ. -->
_Pendiente: completar el resumen._

## Tipo de cambio

- [ ] Funcionalidad (feat)
- [ ] Corrección de bug (fix)
- [ ] Documentación (docs)
- [ ] Pruebas (test)
- [ ] Refactor (refactor)
- [ ] Rendimiento (perf)
- [ ] Build / CI / Tareas (build, ci, chore)
- [ ] Cambio incompatible (breaking change)

## Qué cambió

<!-- BEGIN:auto-changed -->
_El bot completará esta sección automáticamente al abrir/actualizar el PR._
<!-- END:auto-changed -->

## Plan de pruebas

<!-- El bot marca lo sugerido según las áreas tocadas; ajústalo y ejecútalo. -->
- [ ] `npm test` — unitarios y de componentes
- [ ] `npm run test:db` — integración con Postgres/Redis (si aplica)
- [ ] `npm run test:e2e` — E2E con Playwright (si aplica)
- [ ] `npm run build` — build de producción (verify-env + next build)
- [ ] `npm run lint`

## Checklist final

<!-- Estos son los requisitos de calidad del repo. Márcalos solo cuando se cumplan. -->
- [ ] La rama de trabajo es `Development/preview` o `Hotfix` (modelo de 3 ramas).
- [ ] Ningún entorno no productivo apunta a la base de datos de producción.
- [ ] Los 4 jobs de CI están en verde (lint+unit, integración, E2E, build).
- [ ] No se exponen secretos ni credenciales en el código ni en los commits.
- [ ] La documentación se actualizó junto con el cambio que describe.
- [ ] El esquema de Prisma es compatible (migraciones aplicadas si cambió la DB).
