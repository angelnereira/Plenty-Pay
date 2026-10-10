# 🌿 Setup de rama hija (Git + Neon) para trabajar sin afectar producción

Esta guía describe cómo preparar un entorno seguro para trabajar:

1. Una **rama Git hija de `main`** donde harás los cambios.
2. Una **rama Neon hija de `production`** (Copy-on-Write) que apunta al
   ambiente Preview/Staging y nunca a la base productiva.

> 🔐 Objetivo: poder iterar libremente — incluyendo migraciones, seeds y
> pruebas destructivas — sin riesgo de tocar los datos reales de
> producción.

---

## 1. Rama Git hija de `main`

La rama de desarrollo unificada es **`Development/preview`**. Para
emergencias se usa `Hotfix` (creada desde `main`):

Si necesitas crear otra rama hija desde cero:

```bash
git fetch origin main
git checkout -b mi-rama-de-trabajo origin/main
git push -u origin mi-rama-de-trabajo
```

---

## 2. Rama Neon hija de `production`

### Opción A — usando el script incluido (recomendado)

```bash
# Asegúrate de tener Neon CLI y de estar autenticado
npm i -g neonctl
neonctl auth

# Crea (o resetea) la rama hija. Si omites el nombre, usa la rama git actual.
./scripts/setup-neon-child-branch.sh development-preview
```

El script:

- Crea la rama Neon hija de `production` (Copy-on-Write).
- Genera `.env.staging` con la `DATABASE_URL` de la rama hija.
- Verifica que el endpoint **no** sea el de producción (`ep-lingering-band-ahk37dwj`).
- Aplica permisos `600` al archivo generado.

### Opción B — desde el dashboard de Neon

1. Ir a **Branches → Create branch**.
2. **Parent**: `production`.
3. **Branch name**: el mismo nombre que tu rama Git (recomendado).
4. Copiar el connection string *pooled* y guardarlo en `.env.staging`
   usando como base `env.staging.template`.

### Opción C — vía API REST de Neon

```bash
curl -X POST https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "development-preview",
      "parent_id": "br-lively-hat-ah058e5t"
    },
    "endpoints": [{ "type": "read_write" }]
  }'
```

---

## 3. Configuración local

```bash
# 1) A partir del template:
cp env.staging.template .env.staging
# rellenar DATABASE_URL con el endpoint que devuelve Neon

# 2) Verificar aislamiento:
npx tsx scripts/verify-staging-isolation.ts

# 3) Aplicar migraciones a la rama hija:
DATABASE_URL="$(grep DATABASE_URL .env.staging | cut -d= -f2- | tr -d '\"')" \
  npx prisma migrate deploy

# 4) Ejecutar la app contra la rama hija:
set -a; source .env.staging; set +a
npm run dev
```

> ⚠️ `.env.staging` está cubierto por el patrón `.env*` de `.gitignore`.
> Nunca lo subas al repo.

---

## 4. Configuración de Vercel (Preview)

Para que los deploys de la rama Git apunten a la rama Neon hija:

1. **Vercel Dashboard → Project → Settings → Environment Variables**
2. Crear `DATABASE_URL` con scope **Preview**.
3. Expandir **Git Branch** y poner el nombre exacto de la rama
   (`Development/preview`).
4. Pegar el connection string *pooled* de la rama Neon hija.
5. Repetir para `NEXTAUTH_URL`, `HKA_ENV=demo`, `SENTRY_ENVIRONMENT=staging`.

Verificar:

```bash
vercel env ls
vercel env pull --environment=preview --git-branch=Development/preview
```

---

## 5. Reglas de seguridad

| Regla | ¿Por qué? |
|-------|-----------|
| Endpoint **distinto** a `ep-lingering-band-ahk37dwj-pooler` | Es el endpoint productivo. Nunca debe aparecer en `.env.staging`. |
| `HKA_ENV=demo` siempre | Evita emitir documentos fiscales reales. |
| API keys separadas (Resend, Sentry, etc.) | Aísla notificaciones y métricas. |
| `NEXTAUTH_SECRET` distinto al de producción | Invalida tokens si hay leak en staging. |
| Reset desde production en lugar de drop/recreate | Mantiene migraciones consistentes. |

---

## 6. Reset y limpieza

```bash
# Refrescar la rama hija con datos actuales de producción (CoW)
neonctl branches reset development-preview \
  --parent production --project-id rough-math-63773989

# Eliminar la rama cuando ya no se necesite
neonctl branches delete <rama-efimera> \
  --project-id rough-math-63773989
```

---

## 7. Checklist final

- [ ] Rama Git de trabajo correcta (`Development/preview`, o `Hotfix` desde `main`).
- [ ] Rama Neon homónima creada como hija de `production`.
- [ ] `.env.staging` generado y con permisos 600.
- [ ] `npx tsx scripts/verify-staging-isolation.ts` pasa.
- [ ] `prisma migrate deploy` ejecutado sobre la rama hija.
- [ ] Variables de Vercel en scope Preview con filtro de Git Branch.
- [ ] HKA en modo demo confirmado.

Una vez completado, puedes iterar con tranquilidad: cualquier cambio
queda contenido en la rama hija de Neon y se puede descartar haciendo
`reset --parent production` o eliminando la rama.
