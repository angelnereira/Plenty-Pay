# Estrategia de Pruebas — PlentyPay

El objetivo es impedir que llegue código roto a `main`/producción y garantizar
que las **integraciones vivas** (Neon/PostgreSQL, Upstash Redis, NextAuth,
HKA/DGI, parsing de archivos) sigan funcionando. Las pruebas se ejecutan en
GitHub Actions (`.github/workflows/ci.yml`) en cada push y PR hacia `main`,
`Development/preview` y `Hotfix`.

## Pirámide de pruebas

| Capa | Carpeta | Servicios | Config Jest/PW | Comando |
|------|---------|-----------|----------------|---------|
| Unitarias + componentes | `__tests__/**`, `features/**/*.test.ts` | Ninguno (DB/Redis mockeados) | `jest.config.js` (jsdom) | `npm test` |
| Integración de parsing | `__tests__/integration/` | Ninguno (archivos reales en memoria) | `jest.config.js` | `npm run test:integration` |
| Integración con DB/Redis | `__tests__/db-integration/` | PostgreSQL + Redis (vía SRH) reales | `jest.integration.config.js` (node) | `npm run test:db` |
| End-to-End | `e2e/` | App Next.js real + PostgreSQL | `playwright.config.ts` | `npm run test:e2e` |

## Qué cubre cada capa

### Unitarias / componentes (`npm test`)
- Lógica fiscal (ITBMS, redondeo, validadores RUC/DV, mapeos HKA, CPBS).
- Servicios con repositorios y Prisma **mockeados** (OCC, descuentos POS,
  nómina, logística, cafetería, WebAuthn).
- Render de componentes React críticos (página de facturas).
- `jest.polyfills.js` inyecta `TextEncoder/TextDecoder`, WebCrypto y variables
  de entorno mínimas para que módulos como `@neondatabase/serverless` y NextAuth
  puedan importarse en jsdom sin tocar servicios reales.

### Integración con base de datos y Redis (`npm run test:db`)
Corren contra servicios reales — sin mocks — y verifican el comportamiento que
los mocks no pueden garantizar:
- **AuthService**: registro/login reales, hashing bcrypt persistido (nunca
  contraseña en claro), unicidad de email.
- **ClientService**: alta de clientes, RUC duplicado y aislamiento multi-tenant.
- **InvoiceService**: creación de borradores con items y totales persistidos,
  validaciones de negocio.
- **Inventario OCC**: control de concurrencia optimista bajo **carrera real**
  (8 reservas concurrentes sobre stock limitado → nunca sobrevende ni deja
  stock negativo).
- **Redis/Upstash + Rate limiting**: set/get/incr/expire/del por REST y
  ventanas deslizantes de `@upstash/ratelimit`. Se omiten automáticamente si
  no hay `UPSTASH_REDIS_REST_URL`/`TOKEN`.

### End-to-End (`npm run test:e2e`)
Levantan la app real (`next build && next start`) y la manejan con un navegador:
- Smoke: la landing carga y se navega al login.
- Autenticación: credenciales inválidas **no** conceden acceso; las rutas del
  dashboard redirigen sin sesión.
- Health: `/api/health/db` y `/api/health/acid` confirman, de punta a punta,
  que el servidor desplegado conecta con la base de datos.

## Guard-rails de seguridad
- `scripts/verify-env.js` corre antes de cada build y **falla** si un entorno
  no productivo apunta a la base de datos de producción.
- `__tests__/db-integration/helpers.ts` aborta si `DATABASE_URL` parece de
  producción, así los tests destructivos jamás tocan datos reales.

## Correr localmente

```bash
# Unitarias / componentes (rápido, sin servicios)
npm test

# Integración con DB (requiere PostgreSQL; Redis es opcional)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/plentypay_test"
npm run test:db:setup     # aplica el schema de Prisma a la base de prueba
npm run test:db

# Para incluir los tests de Redis, exporta además:
#   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (un proxy SRH o Upstash dev)

# End-to-End (Playwright build+start automático)
npm run test:e2e:install  # una sola vez: descarga Chromium
npm run test:e2e
```

## CI: jobs en `ci.yml`
1. **lint-and-unit** — lint + `npm test`.
2. **integration-db** — PostgreSQL 16 + Redis 7 + SRH (proxy REST Upstash);
   aplica el schema y corre `npm run test:db`.
3. **e2e** — PostgreSQL 16; instala Chromium, construye y corre Playwright;
   sube el reporte HTML como artefacto.
4. **build** — `npm run build` (verify-env + `next build`), igual que Vercel.

Todos los jobs deben pasar para poder mergear a `main`.
