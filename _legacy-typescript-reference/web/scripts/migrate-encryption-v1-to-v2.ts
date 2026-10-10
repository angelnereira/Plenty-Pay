/**
 * Script de Migración: Encriptación V1 → V2
 *
 * Este script migra datos encriptados del formato antiguo (V1: iv:encrypted)
 * al nuevo formato con salt dinámico (V2: salt:iv:encrypted).
 *
 * CAMPOS AFECTADOS:
 * - Client.hkaTokenPassword (credenciales HKA encriptadas)
 *
 * USO:
 *   npx tsx scripts/migrate-encryption-v1-to-v2.ts [--dry-run]
 *
 * OPCIONES:
 *   --dry-run    Simula la migración sin modificar la base de datos
 *   --force      Fuerza la re-encriptación incluso de datos en formato V2
 *
 * IMPORTANTE:
 * 1. Hacer backup de la base de datos ANTES de ejecutar
 * 2. Verificar que ENCRYPTION_KEY está configurada correctamente
 * 3. Ejecutar primero con --dry-run para ver qué se va a migrar
 */

import { PrismaClient } from '@prisma/client';
import { reencrypt, decrypt, isEncrypted } from '../lib/utils/encryption';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  migrated: number;
  alreadyV2: number;
  notEncrypted: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

async function migrateEncryption(options: { dryRun?: boolean; force?: boolean } = {}) {
  const { dryRun = false, force = false } = options;

  console.log('🔒 Encryption Migration V1 → V2');
  console.log('================================');
  console.log('');

  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made');
  } else {
    console.log('⚠️  PRODUCTION MODE - Database will be modified');
  }

  console.log('');

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    alreadyV2: 0,
    notEncrypted: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 1. Buscar todos los clientes con hkaTokenPassword
    const clients = await prisma.client.findMany({
      where: {
        hkaTokenPassword: { not: null },
      },
      select: {
        id: true,
        name: true,
        hkaTokenPassword: true,
      },
    });

    stats.total = clients.length;

    console.log(`📊 Found ${clients.length} clients with encrypted passwords`);
    console.log('');

    if (clients.length === 0) {
      console.log('✅ No data to migrate');
      return stats;
    }

    // 2. Procesar cada cliente
    for (const client of clients) {
      const password = client.hkaTokenPassword!;

      try {
        // Verificar formato actual
        if (!isEncrypted(password)) {
          console.log(`⚠️  Client ${client.id} (${client.name}): Not encrypted`);
          stats.notEncrypted++;
          continue;
        }

        const parts = password.split(':');
        const isV2 = parts.length === 3;

        if (isV2 && !force) {
          console.log(`✓  Client ${client.id} (${client.name}): Already V2 format`);
          stats.alreadyV2++;
          continue;
        }

        // Desencriptar para verificar que funciona
        const decrypted = decrypt(password);

        if (!decrypted) {
          console.log(`⚠️  Client ${client.id} (${client.name}): Empty after decryption`);
          stats.notEncrypted++;
          continue;
        }

        // Re-encriptar con nuevo formato
        const newPassword = reencrypt(password);

        console.log(`🔄 Client ${client.id} (${client.name}): ${isV2 ? 'Re-encrypting' : 'Migrating'} V1 → V2`);

        if (!dryRun) {
          await prisma.client.update({
            where: { id: client.id },
            data: { hkaTokenPassword: newPassword },
          });
        }

        stats.migrated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Client ${client.id} (${client.name}): Migration failed`);
        console.error(`   Error: ${errorMessage}`);

        stats.failed++;
        stats.errors.push({
          clientId: client.id,
          error: errorMessage,
        });
      }
    }

    console.log('');
    console.log('================================');
    console.log('📈 Migration Summary');
    console.log('================================');
    console.log(`Total clients:        ${stats.total}`);
    console.log(`Migrated to V2:       ${stats.migrated}`);
    console.log(`Already V2:           ${stats.alreadyV2}`);
    console.log(`Not encrypted:        ${stats.notEncrypted}`);
    console.log(`Failed:               ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('');
      console.log('❌ Errors:');
      stats.errors.forEach((err) => {
        console.log(`   - Client ${err.clientId}: ${err.error}`);
      });
    }

    console.log('');

    if (dryRun) {
      console.log('🧪 DRY RUN completed - Run without --dry-run to apply changes');
    } else {
      console.log('✅ Migration completed successfully');
    }

    return stats;
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed with error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (!dryRun) {
    console.log('⚠️  WARNING: This will modify the database!');
    console.log('⚠️  Make sure you have a backup before proceeding.');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    console.log('');

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  try {
    await migrateEncryption({ dryRun, force });
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Solo ejecutar si es el script principal
if (require.main === module) {
  main();
}

export { migrateEncryption };
