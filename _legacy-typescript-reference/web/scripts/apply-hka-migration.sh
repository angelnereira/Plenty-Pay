#!/bin/bash

# Script para aplicar migración de catálogos HKA usando Neon REST API
# Fecha: 2025-12-07

# Variables
NEON_API_URL="https://ep-divine-field-ad26eaav.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1"

# Leer el SQL de migración
SQL_FILE="prisma/migrations/add_hka_catalogs.sql"

echo "🚀 Aplicando migración de catálogos HKA..."
echo "📁 Archivo: $SQL_FILE"
echo "🌐 API: $NEON_API_URL"
echo ""

# Leer el SQL
SQL_CONTENT=$(cat "$SQL_FILE")

# Aplicar migración vía REST API
curl -X POST "$NEON_API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": $(echo "$SQL_CONTENT" | jq -Rs .)
  }"

echo ""
echo "✅ Migración aplicada"
