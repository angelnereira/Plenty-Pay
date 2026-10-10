#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de PlentyPay...\n');

// Verificar archivo .env
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ Archivo .env no encontrado');
  console.log('💡 Ejecuta: npm run setup');
  process.exit(1);
}

// Cargar variables de entorno
require('dotenv').config();

const checks = [
  {
    name: 'DATABASE_URL',
    value: process.env.DATABASE_URL,
    required: true,
    description: 'URL de conexión a PostgreSQL'
  },
  {
    name: 'NEXTAUTH_SECRET',
    value: process.env.NEXTAUTH_SECRET,
    required: true,
    description: 'Secreto para NextAuth.js'
  },
  {
    name: 'NEXTAUTH_URL',
    value: process.env.NEXTAUTH_URL,
    required: true,
    description: 'URL base de la aplicación'
  },
  {
    name: 'HKA_ENV',
    value: process.env.HKA_ENV,
    required: false,
    description: 'Entorno de HKA (opcional, determinado por credenciales en DB)'
  },
  {
    name: 'REDIS_URL',
    value: process.env.REDIS_URL,
    required: true,
    description: 'URL de conexión a Redis'
  },
  {
    name: 'AWS_ACCESS_KEY_ID',
    value: process.env.AWS_ACCESS_KEY_ID,
    required: false,
    description: 'AWS Access Key (opcional)'
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    value: process.env.AWS_SECRET_ACCESS_KEY,
    required: false,
    description: 'AWS Secret Key (opcional)'
  },
  {
    name: 'RESEND_API_KEY',
    value: process.env.RESEND_API_KEY,
    required: false,
    description: 'Resend API Key (opcional)'
  }
];

let allPassed = true;

console.log('📋 Verificando variables de entorno:\n');

checks.forEach(check => {
  const status = check.value ? '✅' : (check.required ? '❌' : '⚠️');
  const required = check.required ? '(REQUERIDA)' : '(OPCIONAL)';

  console.log(`${status} ${check.name} ${required}`);
  console.log(`   ${check.description}`);

  if (!check.value && check.required) {
    allPassed = false;
  }

  console.log('');
});

// La configuración de HKA se maneja ahora a través de la base de datos por cliente/usuario
// Las credenciales de HKA (tokens) determinan intrínsecamente el ambiente (demo o prod).

console.log('\n📊 Resumen:');
if (allPassed) {
  console.log('✅ Todas las configuraciones requeridas están presentes');
  console.log('\n🚀 Próximos pasos:');
  console.log('1. npm run db:generate');
  console.log('2. npm run db:migrate');
  console.log('3. npm run db:seed');
  console.log('4. npm run dev');
} else {
  console.log('❌ Faltan configuraciones requeridas');
  console.log('\n💡 Soluciones:');
  console.log('1. Ejecuta: npm run setup');
  console.log('2. Edita el archivo .env con tus credenciales');
  console.log('3. Vuelve a ejecutar: node scripts/check-config.js');
}

process.exit(allPassed ? 0 : 1);
