# Deployment & Configuration

## Required Services

| Servicio | Propósito | URL |
|----------|-----------|-----|
| **Neon** | PostgreSQL serverless | [console.neon.tech](https://console.neon.tech) |
| **Vercel** | Hosting, deploy y crons nativos | [vercel.com](https://vercel.com) |
| **Upstash** | Redis (rate limiting, locking, cache) | [upstash.com](https://upstash.com) |
| **HKA** | Facturación electrónica | Contactar comercialmente |

---

## Variables de Entorno

### Obligatorias

```bash
# Base de datos
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Autenticación
NEXTAUTH_URL="https://plentypay.com"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Encriptación
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# Aplicación
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://plentypay.com"
NEXT_PUBLIC_APP_NAME="PlentyPay"
```

### HKA (Configurado en la App)
El ambiente (demo/prod) se determina automáticamente por las credenciales configuradas en el sistema.

### Upstash Redis

```bash
UPSTASH_REDIS_REST_URL="https://<id>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<token>"
```

### Super Admin

```bash
SUPER_ADMIN_EMAIL="admin@plentypay.com"
SUPER_ADMIN_PASSWORD="password_seguro"
```

---

## Configuración de Neon

1. Crear proyecto en [console.neon.tech](https://console.neon.tech)
2. Copiar Connection String → `DATABASE_URL`
3. Ejecutar migraciones:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

---

## Configuración de Vercel

### 1. Conectar Repositorio

- Importar desde GitHub
- Framework: Next.js
- Build Command: `npm run build`

### 2. Variables de Entorno

Agregar todas las variables en **Settings → Environment Variables**

### 3. Deploy

```bash
# Manual
npx vercel --prod

# Automático (GitHub Actions configurado)
git push origin main
```

---

## GitHub Actions (CI/CD)

El workflow `.github/workflows/deploy.yml` despliega automáticamente a Vercel en cada push a `main`.

### Secrets Requeridos

| Secret | Valor |
|--------|-------|
| `VERCEL_TOKEN` | Token de Vercel |
| `VERCEL_ORG_ID` | ID de organización |
| `VERCEL_PROJECT_ID` | ID del proyecto |

---

## Base de Datos

### Comandos Prisma

```bash
npm run db:generate    # Genera cliente Prisma
npm run db:push        # Aplica schema a DB
npm run db:seed        # Inserta datos iniciales
npm run db:studio      # UI para ver datos
```

### Backup/Restore

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## Checklist de Deploy

### Pre-Deploy

- [ ] Variables de entorno configuradas
- [ ] `DATABASE_URL` apunta a Neon
- [ ] `NEXTAUTH_URL` = dominio de producción
- [ ] Build local exitoso (`npm run build`)

### Post-Deploy

- [ ] App carga correctamente
- [ ] Login funciona
- [ ] Rate limiting funciona (Upstash Redis conectado)
- [ ] Conexión a HKA OK
- [ ] Emisión de factura de prueba OK
- [ ] Módulo de logística accesible (crear orden de entrega)
- [ ] Generación de PDF de orden de entrega OK
- [ ] Asistente de soporte AI responde correctamente

---

## Troubleshooting

### Build falla en Vercel

```bash
# Verificar localmente
npm run build
```

### Error: NEXTAUTH_URL missing

Agregar variable en Vercel → Settings → Environment Variables

### Error: Database connection

- Verificar `DATABASE_URL` tiene `?sslmode=require`
- Proyecto Neon está activo

---

*Última actualización: Abril 2026*
