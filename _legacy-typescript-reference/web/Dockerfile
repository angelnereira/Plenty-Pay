# syntax=docker/dockerfile:1
# Imagen de producción de PlentyPay (Next.js 15, salida "standalone").
# Sustituye el despliegue serverless de Vercel por una imagen portable para Kubernetes.
#
# Antes del primer build:
#   1) `npm install` en /web para que package-lock.json esté sincronizado (este Dockerfile usa `npm ci`).
#   2) `scripts/sync-protos.sh` en la raíz del repo (copia los .proto a web/proto).

# ---------- 1. Dependencias ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Build ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `npm run build` ejecuta scripts/verify-env.js, que EXIGE una DATABASE_URL válida. Aquí va un
# valor de relleno que solo existe en esta etapa (no llega a la imagen final): el build no se
# conecta a la base de datos. Las variables reales se inyectan en ejecución (Secret de Kubernetes).
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# Genera Prisma Client contra el schema final (incluye Payment Core / Ledger / Wallet)
# y compila Next. El script `build` ya incluye `prisma generate`.
RUN npm run build

# ---------- 3. Runtime ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Contratos gRPC que lee el cliente del orquestador en tiempo de ejecución (lib/payments/orchestrator-client.ts)
COPY --from=builder --chown=nextjs:nodejs /app/proto ./proto
# Motor de Prisma (defensivo: el tracing de Next a veces no copia .prisma/client en modo standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

# Los crons de Vercel ya no existen en este runtime: ver infra/k8s/25-cronjobs.yaml.
CMD ["node", "server.js"]

# ---------- 4. Migraciones (imagen aparte, solo para el Job de Kubernetes) ----------
# docker build --target migrate -t ghcr.io/OWNER/plentypay-migrate:TAG .
# El runtime "standalone" no trae la CLI de Prisma; esta imagen sí, y nada más.
FROM node:22-alpine AS migrate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-audit --no-fund prisma@^6.19.2 @prisma/client@^6.19.2 @prisma/config
COPY prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]
