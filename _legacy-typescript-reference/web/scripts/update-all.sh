#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "🚀 PlentyPay - Actualización Completa del Stack"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar nvm
echo "${YELLOW}📦 Paso 1/8: Verificando nvm...${NC}"
if command -v nvm &> /dev/null; then
    echo "${GREEN}✅ nvm está instalado${NC}"
else
    echo "${YELLOW}⚠️  nvm no encontrado. Instalando...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 2. Instalar Node.js 20
echo ""
echo "${YELLOW}📦 Paso 2/8: Instalando Node.js 20 LTS...${NC}"
nvm install 20
nvm use 20
nvm alias default 20

# 3. Verificar versiones
echo ""
echo "${YELLOW}✅  Paso 3/8: Verificando versiones...${NC}"
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "Node.js: ${GREEN}$NODE_VERSION${NC}"
echo "npm: ${GREEN}$NPM_VERSION${NC}"

# 4. Navegar al proyecto
echo ""
echo "${YELLOW}📁 Paso 4/8: Navegando al proyecto...${NC}"
cd "$(dirname "$0")/.." || exit 1
echo "Directorio: ${GREEN}$(pwd)${NC}"

# 5. Limpiar proyecto
echo ""
echo "${YELLOW}🧹 Paso 5/8: Limpiando proyecto...${NC}"
echo "Eliminando node_modules..."
rm -rf node_modules
echo "Eliminando package-lock.json..."
rm -f package-lock.json
echo "Limpiando caché de npm..."
npm cache clean --force

# 6. Configurar npm
echo ""
echo "${YELLOW}⚙️  Paso 6/8: Configurando npm...${NC}"
npm config set fetch-timeout 60000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
echo "${GREEN}✅ Timeouts configurados${NC}"

# 7. Reinstalar dependencias
echo ""
echo "${YELLOW}📥 Paso 7/8: Instalando dependencias...${NC}"
echo "Esto puede tomar varios minutos..."
npm install

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Dependencias instaladas correctamente${NC}"
else
    echo "${RED}❌ Error al instalar dependencias${NC}"
    echo "${YELLOW}💡 Intenta ejecutar manualmente: npm install --legacy-peer-deps${NC}"
    exit 1
fi

# 8. Instalar Sentry
echo ""
echo "${YELLOW}🔍 Paso 8/8: Instalando Sentry...${NC}"
npm install --save @sentry/nextjs

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Sentry instalado correctamente${NC}"
else
    echo "${RED}❌ Error al instalar Sentry${NC}"
    echo "${YELLOW}💡 Intenta ejecutar manualmente: npm install --save @sentry/nextjs --legacy-peer-deps${NC}"
fi

# Resumen final
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "${GREEN}🎉 ¡Actualización Completada!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Resumen:"
echo "  Node.js: $NODE_VERSION"
echo "  npm: $NPM_VERSION"
echo "  Dependencias: ✅ Instaladas"
echo "  Sentry: ✅ Instalado"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Configurar Sentry DSN en .env.local:"
echo "     ${YELLOW}NEXT_PUBLIC_SENTRY_DSN=https://...${NC}"
echo ""
echo "  2. Iniciar servidor de desarrollo:"
echo "     ${YELLOW}npm run dev${NC}"
echo ""
echo "  3. Probar Sentry:"
echo "     ${YELLOW}http://localhost:3000/sentry-example-page${NC}"
echo ""
echo "  4. Verificar build:"
echo "     ${YELLOW}npm run build${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════"
