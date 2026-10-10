/**
 * verify-staging-isolation.ts
 *
 * Verifica que el entorno cargado (.env.staging) está aislado de producción:
 *   - DATABASE_URL no apunta al endpoint productivo
 *   - HKA está en modo demo
 *   - NEXTAUTH_URL no apunta al dominio productivo
 *   - El cluster responde y es una rama distinta
 *
 * Uso:
 *   npx tsx scripts/verify-staging-isolation.ts
 *   (carga .env.staging y luego .env como fallback)
 */

import { config } from 'dotenv';
import path from 'path';
import { Client } from 'pg';

config({ path: path.resolve(__dirname, '../.env.staging') });
config({ path: path.resolve(__dirname, '../.env') });

const PROD_ENDPOINT_FRAGMENT = 'ep-lingering-band-ahk37dwj';
const PROD_HOST_FRAGMENT = 'plentypay.com';

const checks: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
    checks.push({ name, ok, detail });
}

async function main() {
    const dbUrl = process.env.DATABASE_URL ?? '';
    const nextAuthUrl = process.env.NEXTAUTH_URL ?? '';
    const hkaEnv = (process.env.HKA_ENV ?? process.env.HKA_ENVIRONMENT ?? '').toLowerCase();
    const nodeEnv = process.env.NODE_ENV ?? '';

    record(
        'DATABASE_URL definido',
        Boolean(dbUrl),
        dbUrl ? dbUrl.replace(/:[^:@]*@/, ':****@') : 'no definido'
    );

    record(
        'DATABASE_URL NO apunta a producción',
        Boolean(dbUrl) && !dbUrl.includes(PROD_ENDPOINT_FRAGMENT),
        dbUrl.includes(PROD_ENDPOINT_FRAGMENT)
            ? `❌ Contiene endpoint productivo "${PROD_ENDPOINT_FRAGMENT}"`
            : 'endpoint distinto al productivo'
    );

    record(
        'HKA en modo demo',
        hkaEnv === 'demo' || hkaEnv === '',
        hkaEnv === 'prod'
            ? '❌ HKA_ENV=prod en staging es peligroso'
            : `HKA_ENV="${hkaEnv || '(sin definir)'}"`
    );

    record(
        'NEXTAUTH_URL no apunta al dominio productivo',
        !nextAuthUrl.includes(PROD_HOST_FRAGMENT) || nextAuthUrl.includes('staging'),
        nextAuthUrl || '(sin definir)'
    );

    record(
        'NODE_ENV no es production estricto',
        nodeEnv !== 'production' || dbUrl !== '' && !dbUrl.includes(PROD_ENDPOINT_FRAGMENT),
        `NODE_ENV="${nodeEnv}"`
    );

    if (dbUrl && !dbUrl.includes(PROD_ENDPOINT_FRAGMENT)) {
        const client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
            const r = await client.query(
                "SELECT current_database() AS db, inet_server_addr()::text AS host, version() AS version"
            );
            record(
                'Conexión a la rama hija OK',
                true,
                `db=${r.rows[0].db} host=${r.rows[0].host}`
            );
            await client.end();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            record('Conexión a la rama hija OK', false, message);
        }
    } else {
        record('Conexión a la rama hija OK', false, 'omitido por validación previa');
    }

    let allOk = true;
    console.log('');
    console.log('🛡️  Verificación de aislamiento de staging');
    console.log('==========================================');
    for (const c of checks) {
        const icon = c.ok ? '✅' : '❌';
        if (!c.ok) allOk = false;
        console.log(`${icon} ${c.name}`);
        console.log(`   ${c.detail}`);
    }
    console.log('');
    if (allOk) {
        console.log('🎉 Entorno staging aislado correctamente. Puedes trabajar con seguridad.');
        process.exit(0);
    } else {
        console.error('🚨 Hay verificaciones fallidas. Corrige antes de seguir.');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
