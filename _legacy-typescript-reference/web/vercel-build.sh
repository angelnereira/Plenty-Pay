#!/bin/bash

# Script de build para Vercel
echo "🚀 Iniciando build para Vercel..."

# Verificar que DATABASE_URL esté configurada
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está configurada"
    exit 1
fi

echo "📋 DATABASE_URL configurada: ${DATABASE_URL:0:30}..."

# Cambiar el proveedor de BD si es necesario
echo "🔄 Verificando proveedor de base de datos..."
node scripts/switch-db-provider.js

# Generar Prisma Client
echo "📦 Generando Prisma Client..."
npx prisma generate

if [ "$VERCEL_ENV" = "production" ]; then
    echo "🔒 Entorno de PRODUCCIÓN detectado."
    echo "⚠️  Saltando 'db push' y seeding destructivo."
    
    echo "🗄️ Aplicando schema a la base de datos (DB Push)..."
    npx prisma db push --accept-data-loss
elif [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then
    # Staging uses db push to sync schema without migrations history requirement
    echo "🔒 Entorno de STAGING detectado (rama: $VERCEL_GIT_COMMIT_REF)"
    echo "⚠️  Usando 'db push' para sincronizar esquema (sin migraciones)."
    
    echo "🗄️ Aplicando schema a la base de datos..."
    npx prisma db push --accept-data-loss
    
    # Opcional: seed de datos de prueba específicos para staging
    # Descomenta si necesitas datos de prueba en staging
    # echo "🌱 Ejecutando seed de staging..."
    # node scripts/seed-staging.js
else
    echo "🧪 Entorno: $VERCEL_ENV (Preview: $VERCEL_GIT_COMMIT_REF)"
    echo "⚠️  Modo REPLICA: Reiniciando base de datos de prueba..."

    # Hacer push del schema a la base de datos
    echo "🗄️ Aplicando schema a la base de datos..."
    npx prisma db push --accept-data-loss

    # Poblar la base de datos con datos de prueba
    echo "🌱 Configurando base de datos..."
    node scripts/setup-db.js
fi

# Aplicar SQL crudo del módulo BI (vistas materializadas + función
# refresh_bi_views) — `prisma db push` sólo sincroniza el schema de
# Prisma y ignora el SQL libre de las migraciones, así que las vistas
# no se crean automáticamente. El script es idempotente: usa
# DROP ... IF EXISTS / CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE
# FUNCTION, por lo que es seguro correrlo en cada build.
#
# El script imprime el detalle de cada statement (cuántos OK, cuántos
# ya existían, cuántos errores) — el output va a los logs de Vercel.
# Si truena con excepción no-manejada, no abortamos el build porque
# las páginas BI son resilientes a vistas faltantes (empty-state).
echo "📊 Aplicando vistas materializadas del módulo BI..."
node scripts/apply-bi-views.js || echo "⚠️ BI bootstrap falló — runtime usará empty-state. Revisa el output anterior."

# Build de Next.js
echo "🏗️ Construyendo aplicación..."
npx next build --no-lint

echo "✅ Build completado exitosamente!"
