# 🚀 Ambiente de Staging - PlentyPay

> ⚠️ **DOCUMENTO HISTÓRICO — ACTUALIZADO EN JUNIO 2026**
>
> Los ambientes fueron consolidados. La rama Git `staging` ya no existe:
> todo desarrollo, staging y preview vive ahora en la rama
> **`Development/preview`** (Vercel Preview + rama Neon `development-preview`),
> con `Hotfix` para emergencias y `main` para producción.
>
> 👉 Fuente de verdad actual: [STAGING_WORKFLOW.md](./STAGING_WORKFLOW.md)
>
> Las referencias de este documento a `staging`, `ordenesdeentregaabril`,
> `claude/setup-staging-environment-*` y sus ramas Neon asociadas se
> conservan solo como referencia histórica de IDs/endpoints.

## Descripción General

El ambiente de **Staging** es una réplica exacta del entorno de Producción diseñada para:
- ✅ Pruebas de QA antes de despliegue a producción
- ✅ Debugging con datos reales sin afectar producción
- ✅ Validación de migraciones de base de datos
- ✅ Testing de integraciones con servicios externos

---

## 📊 Arquitectura del Ambiente

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    NEON DATABASE                        │
                    │  ┌──────────────────┐      ┌──────────────────────────┐ │
                    │  │   production     │ ───▶ │       staging            │ │
                    │  │ (br-lively-hat)  │ CoW  │ (br-soft-night-ah24z3hq) │ │
                    │  └──────────────────┘      └──────────────────────────┘ │
                    └─────────────────────────────────────────────────────────┘
                                    │                          │
                    ┌───────────────┴───────────┐  ┌───────────┴────────────┐
                    │        VERCEL             │  │        VERCEL          │
                    │     Production            │  │       Staging          │
                    │  plentypay.com              │  │  staging.plentypay.com   │
                    │  (rama: main)             │  │  (rama: staging)       │
                    └───────────────────────────┘  └────────────────────────┘
```

---

## 🔗 Información de Conexión

### Base de Datos Neon

| Ambiente | Branch ID | Branch Name | Endpoint |
|----------|-----------|-------------|----------|
| **Production** | `br-lively-hat-ah058e5t` | `production` | `ep-lingering-band-ahk37dwj-pooler` |
| **Staging** | `br-soft-night-ah24z3hq` | `staging` | `ep-noisy-pine-ahcr3xiz-pooler` |
| **Órdenes Entrega Abril** | *(ver Neon console)* | `ordenesdeentregaabril` | `ep-misty-bonus-ah5mtnrx-pooler` |

### Connection Strings (Pooled)

```bash
# PRODUCCIÓN (main branch de Git)
DATABASE_URL="postgresql://neondb_owner:***@ep-lingering-band-ahk37dwj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# STAGING (staging branch de Git)
DATABASE_URL="postgresql://neondb_owner:***@ep-noisy-pine-ahcr3xiz-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

> ⚠️ **IMPORTANTE**: Las passwords completas están en el dashboard de Neon y Vercel. Nunca commitear credenciales.

---

## 🔄 Flujo de Trabajo Git

### Ramas

| Rama | Propósito | Ambiente Vercel | Base de Datos |
|------|-----------|-----------------|---------------|
| `main` | Producción | Production | Neon `production` |
| `Development/preview` | Desarrollo, staging, QA y pruebas (ambiente unificado) | Preview | Neon `preview/Development/preview` |
| `Hotfix` | Emergencias/incidentes de producción | Preview | Neon `preview/Development/preview` |

> Modelo anterior (histórico): `staging`, `feature/*`, `claude/*`,
> `ordenesdeentregaabril`, `claude/setup-staging-environment-*` — todas
> consolidadas en `Development/preview` y eliminadas.

### Flujo de PRs

```
┌──────────────┐     PR      ┌──────────────┐     PR      ┌──────────────┐
│  feature/*   │ ──────────▶ │   staging    │ ──────────▶ │     main     │
│  (Developer) │             │    (QA)      │             │ (Production) │
└──────────────┘             └──────────────┘             └──────────────┘
       │                            │                            │
       ▼                            ▼                            ▼
  Local Dev                  Staging Deploy              Production Deploy
  (localhost)           (staging.plentypay.com)            (plentypay.com)
```

---

## ⚙️ Configuración de Vercel

### Variables de Entorno por Scope

Ir a **Vercel Dashboard** → **Project Settings** → **Environment Variables**

#### Opción A: Proyecto único con Environment Scoping (Recomendado)

| Variable | Production | Preview (Git Branch: staging) |
|----------|------------|-------------------------------|
| `DATABASE_URL` | `postgresql://...ahk37dwj-pooler...` | `postgresql://...ahlo5c6n-pooler...` |
| `NEXTAUTH_URL` | `https://plentypay.com/` | `https://plentypay-app-env-staging-plentypay.vercel.app/` |
| `NODE_ENV` | `production` | `production` |

**Para configurar con filtro de Git Branch:**
1. Añadir variable `DATABASE_URL`
2. Seleccionar scope "Preview"
3. Expandir "Git Branch"
4. Escribir `staging` en el filtro de ramas
5. Guardar

#### Opción B: Proyecto Vercel separado para Staging

Si prefieres aislamiento completo:
1. Crear nuevo proyecto Vercel: `plentypay-staging`
2. Conectar al mismo repo pero configurar:
   - **Production Branch**: `staging`
   - **Environment Variables**: Usar valores de staging

### Verificación con Vercel CLI

```bash
# Instalar Vercel CLI si no está instalado
npm i -g vercel

# Verificar configuración
vercel env pull --environment=preview

# Ver todas las variables
vercel env ls
```

---

## 🔁 Sincronización de Datos

### Estrategia de Refresh

La rama `staging` de Neon inicia como copia exacta de `production`. Para mantenerla actualizada:

#### Refresh Manual (Recomendado para control)

```bash
# Usando Neon CLI
neon branches reset staging --parent production --project-id rough-math-63773989
```

**O desde el Dashboard de Neon:**
1. Ir a **Branches** → `staging`
2. Click **"Reset from parent"**
3. Confirmar que quieres sincronizar con `production`

#### Cuándo Sincronizar

| Escenario | Acción |
|-----------|--------|
| Después de cambios significativos de schema en producción | Reset inmediato |
| Mensualmente | Reset programado |
| Antes de iniciar QA de release mayor | Reset |
| Durante desarrollo activo de features | Mantener datos de staging |

> ⚠️ **ADVERTENCIA**: El reset eliminará todos los cambios de datos realizados en staging desde el último sync.

---

## 🧪 Migraciones de Base de Datos

### Flujo de Migraciones

```
Local Dev          Staging              Production
    │                  │                     │
    │  1. prisma       │                     │
    │     migrate dev  │                     │
    │     (local)      │                     │
    │                  │                     │
    ├─────────────────▶│  2. Deploy PR       │
    │                  │     to staging      │
    │                  │                     │
    │                  │  3. vercel build    │
    │                  │     runs prisma     │
    │                  │     migrate deploy  │
    │                  │                     │
    │                  │  4. QA Validation   │
    │                  │                     │
    │                  ├────────────────────▶│  5. Merge to main
    │                  │                     │
    │                  │                     │  6. prisma migrate
    │                  │                     │     deploy (prod)
```

### Ejecutar Migraciones

```bash
# Desarrollo local
npx prisma migrate dev --name descripcion_del_cambio

# Staging (automático en Vercel, o manual):
DATABASE_URL="<staging-url>" npx prisma migrate deploy

# Producción (automático en Vercel build)
# Se ejecuta vía vercel-build.sh
```

### Verificar Estado de Migraciones

```bash
# Staging
DATABASE_URL="<staging-url>" npx prisma migrate status

# Producción
DATABASE_URL="<production-url>" npx prisma migrate status
```

---

## 🔙 Procedimientos de Rollback

### Escenario 1: Migración corrupta en Staging

```bash
# Opción A: Reset completo desde production
neon branches reset staging --parent production --project-id rough-math-63773989

# Opción B: Point-in-time restore (si disponible en tu plan)
# Ir a Neon Dashboard → Branches → staging → Restore
```

### Escenario 2: Código problemático en Staging

```bash
# Revert al último commit estable
git checkout staging
git revert HEAD
git push origin staging
# Vercel re-desplegará automáticamente
```

### Escenario 3: Crear rama limpia

```bash
# Desde Neon CLI
neon branches delete staging --project-id rough-math-63773989
neon branches create --name staging --parent production --project-id rough-math-63773989
```

---

## 🔐 Servicios Externos y Autenticación

### NextAuth / Neon Auth

| Ambiente | Configuración |
|----------|---------------|
| Production | `NEXTAUTH_URL=https://plentypay.com` |
| Staging | `NEXTAUTH_URL=https://staging.plentypay.com` |

> **Nota**: Si usas OAuth providers (Google, GitHub), considera crear credenciales OAuth separadas para staging con redirect URIs apropiados.

### HKA (Facturación Electrónica)

El ambiente HKA (demo o producción) se determina **automáticamente** por las credenciales configuradas — el sistema detecta el ambiente al guardar las credenciales mediante una prueba de conexión. Ya no existen variables de entorno separadas para el ambiente HKA.

> ℹ️ Staging puede operar con credenciales PROD si el equipo QA usa tokens reales. Para evitar emisión de documentos fiscales reales en staging, asegúrate de usar credenciales de cuentas de prueba HKA.

### Resend (Email)

Considera crear una API key separada para staging o usar el modo sandbox de Resend para evitar envío de emails reales durante pruebas.

### Cloudinary

Puedes usar el mismo cloud name pero considera crear un folder `/staging/` para assets de prueba.

---

## 🛡️ Seguridad y Privacidad de Datos

### Consideraciones de PII (Información Personal)

⚠️ El ambiente staging contiene **datos reales** copiados de producción. Considera:

1. **Acceso Restringido**: Solo personal autorizado debe tener acceso a staging
2. **No compartir URLs**: Las previews de Vercel pueden ser públicas
3. **Protección de datos sensibles**: Si es necesario, implementar scripts de sanitización

### Script de Sanitización (Opcional)

```sql
-- Ejemplo de sanitización de datos sensibles en staging
-- NUNCA ejecutar en producción

UPDATE users SET 
  email = CONCAT('user_', id, '@staging.test'),
  phone = '000-000-0000'
WHERE email NOT LIKE '%@plentypay.com';

UPDATE clients SET
  ruc = '000-000-000000-00',
  email = CONCAT('client_', id, '@staging.test');
```

---

## 📊 Monitoreo y Alertas

### Configuración Recomendada

| Servicio | Production | Staging |
|----------|------------|---------|
| Sentry | Alertas inmediatas | Alertas agrupadas diarias |
| Logs | Retención 30 días | Retención 7 días |
| Uptime | 99.9% SLA alertas | Opcional/Silenciado |

### Variables de Sentry por Ambiente

```env
# Producción
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/prod-project"
SENTRY_ENVIRONMENT="production"

# Staging
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/prod-project"  # Mismo DSN
SENTRY_ENVIRONMENT="staging"  # Diferente environment tag
```

---

## 💰 Gestión de Costos

### Neon

- **Copy-on-Write**: La rama staging solo consume storage para datos que difieren de production
- **Compute**: Cada rama tiene su propio endpoint que consume compute
- **Recomendación**: Configurar auto-suspend para staging cuando no esté en uso

```bash
# Ver uso actual
neon projects get rough-math-63773989 --output json | jq '.synthetic_storage_size'
```

### Vercel

- **Preview deployments**: Cuentan hacia el límite de tu plan
- **Recomendación**: Limpiar deployments antiguos periódicamente

---

## 🔧 Comandos Útiles

```bash
# === NEON ===
# Listar ramas
neon branches list --project-id rough-math-63773989

# Obtener connection string de staging
neon connection-string staging --project-id rough-math-63773989 --pooled

# Reset staging desde production
neon branches reset staging --parent production --project-id rough-math-63773989

# === VERCEL ===
# Ver deployments de staging
vercel ls --scope=plentypay-app | grep staging

# Logs de staging
vercel logs <deployment-url>

# Forzar redeploy
vercel --prod --force

# === PRISMA ===
# Status de migraciones en staging
DATABASE_URL="<staging-url>" npx prisma migrate status

# Aplicar migraciones pendientes
DATABASE_URL="<staging-url>" npx prisma migrate deploy
```

---

## ✅ Checklist de Verificación Post-Setup

- [ ] Rama `staging` creada en Neon (br-soft-night-ah24z3hq)
- [ ] Rama `staging` pusheada a GitHub
- [ ] Variables de entorno configuradas en Vercel para scope Preview/staging
- [ ] Dominio staging configurado (opcional): `staging.plentypay.com`
- [ ] Primera deploy exitosa de staging
- [ ] Verificar conexión a DB staging desde la app
- [ ] Verificar que HKA usa ambiente demo en staging
- [ ] Documentación compartida con el equipo

---

## 📞 Troubleshooting

### Error: "Database connection failed" en staging

1. Verificar que `DATABASE_URL` en Vercel tenga la URL de staging
2. Confirmar que el endpoint de Neon está activo (no suspendido)
3. Verificar que la branch `staging` existe en Neon

### Error: Migraciones no aplicadas

```bash
# Verificar estado
DATABASE_URL="<staging-url>" npx prisma migrate status

# Aplicar migraciones pendientes
DATABASE_URL="<staging-url>" npx prisma migrate deploy
```

### Deploy de staging apunta a producción

1. Verificar en Vercel que la variable `DATABASE_URL` para Preview tenga filtro de Git Branch = `staging`
2. Redeplegar el branch staging

---

*Documento creado: 2026-02-02*  
*Última actualización: 2026-04-22*
