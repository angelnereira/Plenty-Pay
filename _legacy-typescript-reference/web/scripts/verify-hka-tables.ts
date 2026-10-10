import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log('🔍 Verificando tablas de catálogos HKA...\n');

    try {
        // Verificar cada tabla
        const locations = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "hka_locations"
    `;
        console.log('✅ hka_locations:', locations[0].count, 'registros');

        const countries = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "hka_countries"
    `;
        console.log('✅ hka_countries:', countries[0].count, 'registros');

        const cpbs = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "hka_cpbs_categories"
    `;
        console.log('✅ hka_cpbs_categories:', cpbs[0].count, 'registros');

        console.log('\n🎉 Todas las tablas están creadas correctamente!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
