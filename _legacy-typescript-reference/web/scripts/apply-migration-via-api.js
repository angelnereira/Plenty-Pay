#!/usr/bin/env node

/**
 * Script para aplicar migración de catálogos HKA usando Neon REST API
 * Uso: node scripts/apply-migration-via-api.js
 */

const fs = require('fs');
const path = require('path');

const NEON_API_URL = "https://ep-divine-field-ad26eaav.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1";
const MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/add_hka_catalogs.sql');

async function applyMigration() {
    console.log('🚀 Aplicando migración de catálogos HKA...\n');

    // Leer archivo SQL
    const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');

    // Usar CREATE TABLE IF NOT EXISTS para seguridad
    const safeSql = sqlContent
        .replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "')
        .replace(/CREATE INDEX "/g, 'CREATE INDEX IF NOT EXISTS "')
        .replace(/CREATE UNIQUE INDEX "/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "');

    console.log('📄 SQL a ejecutar:');
    console.log('─'.repeat(60));
    console.log(safeSql.substring(0, 500) + '...\n');

    try {
        const response = await fetch(NEON_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: safeSql
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();

        console.log('✅ Migración aplicada exitosamente!\n');
        console.log('📊 Resultado:');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n🎉 Tablas creadas:');
        console.log('  - hka_locations');
        console.log('  - hka_countries');
        console.log('  - hka_cpbs_categories');

        console.log('\n📝 Próximo paso:');
        console.log('  npx prisma generate');

    } catch (error) {
        console.error('\n❌ Error al aplicar migración:');
        console.error(error.message);
        process.exit(1);
    }
}

// Ejecutar
applyMigration();
