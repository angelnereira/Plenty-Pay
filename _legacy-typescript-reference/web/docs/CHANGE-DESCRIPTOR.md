# Descriptor de Cambios (commits y Pull Requests)

Este repo genera **automáticamente** un descriptor estructurado de cada cambio
y lo valida antes de poder mergear, para trabajar de forma organizada y dejar
trazabilidad de qué cambia, cómo se probó y qué requisitos se cumplieron.

Hay dos niveles:

1. **Commits** — un hook pre-rellena el mensaje según los archivos en stage.
2. **Pull Requests** — un bot pre-rellena el descriptor y un check lo valida.

Todo se apoya en un único generador: [`scripts/change-descriptor.mjs`](../scripts/change-descriptor.mjs).

---

## 1. Commits

Al hacer `git commit` (abriendo el editor), el hook
[`.githooks/prepare-commit-msg`](../.githooks/prepare-commit-msg) pre-rellena
el mensaje con:

- Un encabezado `tipo(scope):` adivinado de las áreas en stage.
- La lista de "Qué cambió" (como comentarios de referencia).
- Un checklist de verificación (como comentarios).

Actívalo una sola vez por clon:

```bash
npm run hooks:install     # configura core.hooksPath=.githooks
```

El hook **respeta** `git commit -m "..."`, merges, squashes y amends (no los
toca). Los mensajes siguen [Conventional Commits](https://www.conventionalcommits.org/)
y se validan con `npm run commitlint` ([`commitlint.config.js`](../commitlint.config.js)).

---

## 2. Pull Requests

### Plantilla

Cada PR arranca con [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md),
con estas secciones:

| Sección | Quién la completa |
|---------|-------------------|
| **Resumen** | El bot pone el commit principal; tú lo amplías |
| **Tipo de cambio** | El bot marca según los prefijos de commit |
| **Qué cambió** | El bot la genera del diff (se refresca en cada push) |
| **Plan de pruebas** | El bot sugiere; tú ejecutas y confirmas |
| **Checklist final** | **Tú** lo marcas cuando se cumplen los requisitos |

### Bot de pre-rellenado

El workflow [`pr-autofill`](../.github/workflows/pr-autofill.yml) corre en cada
`opened`/`synchronize`/`reopened` del PR y:

1. Lee el diff contra la rama base (`git merge-base`).
2. Genera el descriptor (`change-descriptor.mjs render`).
3. Actualiza el cuerpo del PR vía `gh pr edit` (aparece como editado por el bot).

Es **idempotente**: en pushes posteriores solo refresca "Qué cambió" y
**preserva** tu Resumen y las casillas que marcaste.

### Check `descriptor pre-rellenado`

El mismo workflow ejecuta `change-descriptor.mjs validate`, que **falla**
(check en rojo) mientras:

- el **Resumen** siga con el texto por defecto,
- no haya **ningún Tipo de cambio** marcado, o
- queden ítems del **Checklist final** sin marcar.

Así el PR no se ve "listo" hasta que una persona confirma el resumen y los
requisitos de calidad. Al editar el cuerpo (marcar casillas), el evento
`edited` re-ejecuta la validación.

> Nota: el bot edita el cuerpo con `GITHUB_TOKEN` (scope `pull-requests: write`).
> Funciona para PRs de ramas internas del repo; en PRs desde forks el token es
> de solo lectura y el auto-rellenado se omite (la validación sigue corriendo).

---

## Uso local del generador

```bash
# Ver el descriptor que generaría el PR de tu rama contra Development/preview
npm run descriptor:render

# Validar un cuerpo de PR guardado en un archivo
node scripts/change-descriptor.mjs validate --body mi-descriptor.md
```

## Requisitos del Checklist final

Son los mismos gates de calidad del repo (ver [docs/TESTING.md](./TESTING.md) y
[docs/STAGING_WORKFLOW.md](./STAGING_WORKFLOW.md)):

- Rama de trabajo `Development/preview` o `Hotfix` (modelo de 3 ramas).
- Ningún entorno no productivo apunta a la base de datos de producción.
- Los 4 jobs de CI en verde (lint+unit, integración, E2E, build).
- Sin secretos ni credenciales en el cambio.
- Documentación actualizada junto con el cambio.
- Esquema de Prisma compatible (migraciones aplicadas si cambió la DB).
