#!/usr/bin/env node

/**
 * Script para verificar y ajustar el proveedor de base de datos en schema.prisma
 * Este script se ejecuta durante el build en Vercel para asegurar que el proveedor
 * correcto (postgresql) esté configurado basado en DATABASE_URL
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

try {
  console.log('🔍 Verificando proveedor de base de datos...');

  // Leer DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL no configurada, asumiendo postgresql');
  }

  // Determinar proveedor basado en DATABASE_URL
  let targetProvider = 'postgresql';

  if (databaseUrl) {
    if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
      targetProvider = 'postgresql';
    } else if (databaseUrl.startsWith('mysql://')) {
      targetProvider = 'mysql';
    } else if (databaseUrl.includes('mongodb')) {
      targetProvider = 'mongodb';
    }
  }

  console.log(`   Proveedor objetivo: ${targetProvider}`);

  // Leer schema.prisma
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Error: schema.prisma no encontrado');
    process.exit(1);
  }

  let schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verificar si ya tiene el proveedor correcto
  const currentProviderMatch = schemaContent.match(/provider\s*=\s*"(\w+)"/);

  if (currentProviderMatch) {
    const currentProvider = currentProviderMatch[1];
    console.log(`   Proveedor actual: ${currentProvider}`);

    if (currentProvider === targetProvider) {
      console.log('✅ Proveedor de base de datos correcto, no se requieren cambios');
      process.exit(0);
    }

    // Reemplazar proveedor
    schemaContent = schemaContent.replace(
      /provider\s*=\s*"\w+"/,
      `provider = "${targetProvider}"`
    );

    // Guardar cambios
    fs.writeFileSync(schemaPath, schemaContent, 'utf8');
    console.log(`✅ Proveedor actualizado de ${currentProvider} a ${targetProvider}`);
  } else {
    console.log('✅ No se encontró declaración de proveedor, asumiendo configuración correcta');
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error al verificar proveedor de base de datos:', error.message);
  process.exit(1);
}
