# Flujo de Trabajo — Ambiente Unificado `Development/preview`

> **Actualización (junio 2026):** las ramas `staging`, `develop`, `fix`,
> `kayak-203` y las ramas `claude/*` fueron consolidadas en una única rama
> de desarrollo: **`Development/preview`**. El modelo final es de 3 ramas.

## Ramas

| Rama | Propósito | Ambiente Vercel | Base de Datos |
|------|-----------|-----------------|---------------|
| `main` | Producción | Production (plentypay.com) | Neon `production` |
| `Development/preview` | Desarrollo, staging, QA y pruebas | Preview | Neon `preview/Development/preview` (hija CoW de `production`, creada por la integración Neon↔Vercel) |
| `Hotfix` | Emergencias/incidentes de producción | Preview | Neon `preview/Hotfix` (la crea la integración) o hija efímera de `production` |

## Flujo de Trabajo

```
Development/preview ───────── PR ─────────► main
   │                                          │
   │ • Todo el desarrollo                     │ • Solo código probado
   │ • Testing / QA                           │ • Deploy automático a producción
   │ • Vercel Preview                         │
   └──────────────────────────────────────────┘

Hotfix (creada desde main) ── PR ──► main   (emergencias)
   └─ después del fix, mergear main de vuelta a Development/preview
```

Reglas:

1. **Nunca** hacer push directo a `main`: siempre vía PR desde
   `Development/preview` (o `Hotfix` en emergencias).
2. `Hotfix` parte siempre de `main` y vuelve a `main` por PR. Tras el
   merge, sincronizar `Development/preview` con `main`.
3. No crear ramas de larga vida adicionales; las ramas de feature de corta
   vida deben nacer de `Development/preview` y mergearse de vuelta vía PR
   lo antes posible.

## Configuración Local

```bash
# Generar .env.staging apuntando a la rama Neon de desarrollo:
./scripts/setup-neon-child-branch.sh "preview/Development/preview"

# Cargar y arrancar:
set -a; source .env.staging; set +a
npm run dev
```

## Variables de Entorno por Ambiente

### Development/preview (Vercel Preview + local)
- `DATABASE_URL`: rama Neon `preview/Development/preview` (scope **Preview** en Vercel; la integración Neon↔Vercel la inyecta por rama)
- `HKA_ENV`: `demo`
- `SENTRY_ENVIRONMENT`: `development-preview`

### Production (Vercel Production)
- `DATABASE_URL`: rama Neon `production` (scope **Production** en Vercel)
- Configurada SOLO en Vercel; nunca en archivos locales.

> 🔒 `scripts/verify-env.js` corre antes de cada build y **falla** si un
> entorno no productivo apunta a la base de datos de producción.

## Sincronización de Base de Datos

La rama Neon `preview/Development/preview` es hija (Copy-on-Write) de `production`.
Para refrescar los datos de prueba con una copia limpia de producción:

1. Neon Console → Branches → `preview/Development/preview`
2. Click **Reset from parent**

(Esto NO afecta a `production`; solo reconstruye la rama hija.)

```bash
# O via Neon CLI
neon branches reset "preview/Development/preview" --parent production
```

## Checklist antes de Merge a Main

- [ ] Build sin errores: `npm run build`
- [ ] Tests pasan (si aplica)
- [ ] Probado manualmente en el preview de `Development/preview`
- [ ] Schema de DB compatible (migraciones aplicadas)
- [ ] HKA funciona en modo demo
- [ ] No hay console.log de debug

## Comandos Útiles

```bash
# Cambiar a la rama de desarrollo
git checkout Development/preview

# Crear PR de Development/preview a main
gh pr create --base main --head Development/preview

# Ver diferencias con main
git diff main...Development/preview --stat

# Sincronizar Development/preview con main (traer cambios de prod)
git checkout Development/preview
git merge main

# Crear una rama de hotfix desde producción
git fetch origin main
git checkout -b Hotfix origin/main
```
