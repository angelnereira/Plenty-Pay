#!/bin/bash

# 🌿 Setup Neon Child Branch - PlentyPay
#
# Crea una rama hija de "production" en Neon para trabajar de forma aislada
# (preview/staging) sin afectar la base de datos de producción.
#
# Requisitos:
#   - Neon CLI instalado: npm i -g neonctl
#       (o exportar NEON_API_KEY y usar la API REST)
#   - Estar autenticado: neonctl auth
#   - Variable NEON_PROJECT_ID o flag --project-id
#
# Uso:
#   ./scripts/setup-neon-child-branch.sh <nombre-rama-neon> [rama-padre]
#
# Ejemplos:
#   ./scripts/setup-neon-child-branch.sh claude/setup-staging-environment-FncSF
#   ./scripts/setup-neon-child-branch.sh feature/nueva-funcionalidad production
#
# La rama creada es Copy-on-Write desde production: contiene los mismos datos
# en el momento de creación, pero los cambios NO se propagan a production.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${NEON_PROJECT_ID:-rough-math-63773989}"
PARENT_BRANCH="${2:-production}"
BRANCH_NAME="${1:-}"

if [ -z "$BRANCH_NAME" ]; then
    BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
fi

if [ -z "$BRANCH_NAME" ]; then
    echo -e "${RED}❌ Debes pasar el nombre de la rama Neon o estar dentro de un repo git.${NC}"
    echo "Uso: $0 <nombre-rama-neon> [rama-padre]"
    exit 1
fi

echo -e "${BLUE}🌿 PlentyPay - Setup de rama Neon hija de '${PARENT_BRANCH}'${NC}"
echo "============================================================"
echo -e "Project ID:    ${YELLOW}${PROJECT_ID}${NC}"
echo -e "Rama padre:    ${YELLOW}${PARENT_BRANCH}${NC}"
echo -e "Rama hija:     ${YELLOW}${BRANCH_NAME}${NC}"
echo ""

if ! command -v neonctl >/dev/null 2>&1 && ! command -v neon >/dev/null 2>&1; then
    echo -e "${RED}❌ Neon CLI no está instalado.${NC}"
    echo "Instálalo con: npm i -g neonctl"
    echo "Y autentícate:  neonctl auth"
    exit 1
fi

NEON_BIN="$(command -v neonctl || command -v neon)"

echo -e "${BLUE}🔍 Verificando si la rama '${BRANCH_NAME}' ya existe...${NC}"
if "$NEON_BIN" branches list --project-id "$PROJECT_ID" --output json \
    | grep -q "\"name\": \"${BRANCH_NAME}\""; then
    echo -e "${YELLOW}⚠️  La rama '${BRANCH_NAME}' ya existe en Neon.${NC}"
    read -p "¿Quieres resetearla desde '${PARENT_BRANCH}'? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔄 Reseteando rama desde '${PARENT_BRANCH}'...${NC}"
        "$NEON_BIN" branches reset "$BRANCH_NAME" \
            --parent "$PARENT_BRANCH" \
            --project-id "$PROJECT_ID"
        echo -e "${GREEN}✅ Rama reseteada.${NC}"
    else
        echo -e "${YELLOW}↩️  Reset omitido. Continuando...${NC}"
    fi
else
    echo -e "${BLUE}➕ Creando rama '${BRANCH_NAME}' desde '${PARENT_BRANCH}'...${NC}"
    "$NEON_BIN" branches create \
        --name "$BRANCH_NAME" \
        --parent "$PARENT_BRANCH" \
        --project-id "$PROJECT_ID"
    echo -e "${GREEN}✅ Rama creada.${NC}"
fi

echo ""
echo -e "${BLUE}🔗 Obteniendo connection string (pooled) de la rama hija...${NC}"
CONN_POOLED="$("$NEON_BIN" connection-string "$BRANCH_NAME" \
    --project-id "$PROJECT_ID" \
    --pooled)"
CONN_DIRECT="$("$NEON_BIN" connection-string "$BRANCH_NAME" \
    --project-id "$PROJECT_ID")"

# Sanity check: garantizar que el endpoint NO es el de producción
PROD_ENDPOINT="ep-lingering-band-ahk37dwj"
if echo "$CONN_POOLED" | grep -q "$PROD_ENDPOINT"; then
    echo -e "${RED}❌ ALERTA DE SEGURIDAD: el connection string apunta al endpoint de PRODUCCIÓN.${NC}"
    echo -e "${RED}   No se escribirá nada en disco. Revisa la configuración en Neon.${NC}"
    exit 2
fi

echo -e "${GREEN}✅ Endpoint distinto al de producción confirmado.${NC}"
echo ""

ENV_FILE=".env.staging"
echo -e "${BLUE}📝 Generando ${ENV_FILE} con la URL de la rama hija...${NC}"

cat > "$ENV_FILE" <<EOF
# ===== Generado por scripts/setup-neon-child-branch.sh =====
# Rama Neon: ${BRANCH_NAME} (hija de ${PARENT_BRANCH})
# Generado:  $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# ⚠️  Este archivo apunta a una rama AISLADA de Neon.
#     Los cambios NO afectan producción. NO commitear este archivo.

DATABASE_URL="${CONN_POOLED}"

NODE_ENV="development"
NEXT_PUBLIC_APP_NAME="PlentyPay (Dev/Preview)"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# HKA en modo demo para no emitir documentos fiscales reales
HKA_ENV="demo"

SENTRY_ENVIRONMENT="development-preview"
EOF

chmod 600 "$ENV_FILE"

echo -e "${GREEN}✅ ${ENV_FILE} creado (permisos 600).${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos pasos:${NC}"
echo "  1) Cargar variables: export \$(grep -v '^#' ${ENV_FILE} | xargs)"
echo "  2) Verificar conexión:    npx tsx scripts/verify-staging-isolation.ts"
echo "  3) Aplicar migraciones:   npx prisma migrate deploy"
echo "  4) En Vercel: añadir DATABASE_URL en scope Preview con filtro Git Branch = ${BRANCH_NAME}"
echo ""
echo -e "${GREEN}🎉 Listo. Tu rama hija de Neon está disponible para trabajar de forma segura.${NC}"
