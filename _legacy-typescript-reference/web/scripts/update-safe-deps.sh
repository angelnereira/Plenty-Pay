#!/bin/bash

# Script de actualización segura de dependencias
# PlentyPay - 2025-12-09
#
# Este script actualiza solo las dependencias seguras (sin breaking changes)
# Basado en ANALISIS_DEPENDENCIAS.md

set -e  # Exit on error

echo "🔍 PlentyPay - Actualización Segura de Dependencias"
echo "=================================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encuentra package.json"
    echo "   Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "📦 Paso 1: Backup de package.json y package-lock.json"
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
echo "✅ Backup creado"
echo ""

echo "📦 Paso 2: Actualizar React (19.1.2 → 19.2.1)"
npm install react@19.2.1 react-dom@19.2.1
echo "✅ React actualizado"
echo ""

echo "📦 Paso 3: Actualizar Lucide Icons"
npm install lucide-react@latest
echo "✅ Lucide actualizado"
echo ""

echo "📦 Paso 4: Actualizar Vercel CLI"
npm install vercel@latest
echo "✅ Vercel CLI actualizado"
echo ""

echo "📦 Paso 5: Actualizar next-auth beta"
npm install next-auth@beta
echo "✅ next-auth actualizado"
echo ""

echo "📦 Paso 6: Remover @types innecesarios"
npm uninstall @types/bcryptjs @types/ioredis @types/minimatch @types/qrcode.react @types/soap 2>/dev/null || true
echo "✅ @types innecesarios removidos"
echo ""

echo "📦 Paso 7: Verificar instalación"
npm install
echo "✅ Dependencias verificadas"
echo ""

echo "🧪 Paso 8: Verificar que el proyecto compile"
npm run build > /tmp/build-test.log 2>&1 || {
    echo "❌ Error: El build falló después de las actualizaciones"
    echo "   Restaurando versiones anteriores..."
    mv package.json.backup package.json
    mv package-lock.json.backup package-lock.json
    npm install
    echo "⚠️  Restauración completada. Revisa los logs en /tmp/build-test.log"
    exit 1
}
echo "✅ Build exitoso"
echo ""

echo "✅ Paso 9: Limpiar backups"
rm package.json.backup package-lock.json.backup
echo "✅ Backups eliminados"
echo ""

echo "🎉 ¡Actualización completada exitosamente!"
echo ""
echo "📋 Resumen:"
echo "   - React: 19.2.1"
echo "   - Lucide: última versión"
echo "   - Vercel CLI: última versión"
echo "   - next-auth: última beta"
echo "   - @types removidos: 5 paquetes"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verificar que la app funcione: npm run dev"
echo "   2. Ejecutar tests si los hay: npm test"
echo "   3. Revisar ANALISIS_DEPENDENCIAS.md para actualizaciones futuras"
echo ""
echo "⚠️  Recordatorios:"
echo "   - NO actualizar Next.js a 16 todavía (muy reciente)"
echo "   - NO actualizar Prisma a 7 todavía (breaking changes)"
echo "   - Planear migración de xlsx a exceljs"
echo ""
