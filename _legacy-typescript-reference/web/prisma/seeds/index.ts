import { seedCountries } from './countries.seed';
import { seedLocations } from './locations.seed';
import { seedCPBS } from './cpbs.seed';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('[INFO] Iniciando seeds de catálogos HKA...\n');
    console.log('═'.repeat(60));

    try {
        // 1. Países
        console.log('\n[INFO] PAÍSES');
        console.log('─'.repeat(60));
        await seedCountries();

        // 2. Ubicaciones
        console.log('\n[INFO] UBICACIONES DE PANAMÁ');
        console.log('─'.repeat(60));
        await seedLocations();

        // 3. Categorías CPBS
        console.log('\n[INFO] CATEGORÍAS CPBS');
        console.log('─'.repeat(60));
        await seedCPBS();

        // Verificar totales
        console.log('\n═'.repeat(60));
        console.log('[INFO] VERIFICACIÓN FINAL');
        console.log('═'.repeat(60));

        const countriesCount = await prisma.hKACountry.count();
        const locationsCount = await prisma.hKALocation.count();
        const cpbsCount = await prisma.hKACPBSCategory.count();

        console.log(`\n[SUCCESS] Países:     ${countriesCount} registros`);
        console.log(`[SUCCESS] Ubicaciones: ${locationsCount} registros`);
        console.log(`[SUCCESS] CPBS:        ${cpbsCount} registros`);
        console.log(`\n[SUCCESS] Total:       ${countriesCount + locationsCount + cpbsCount} registros creados\n`);

        console.log('═'.repeat(60));
        console.log('[SUCCESS] Seeds completados exitosamente!');
        console.log('═'.repeat(60));

    } catch (error) {
        console.error('\n❌ Error ejecutando seeds:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
