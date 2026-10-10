import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de países - ISO 3166-1 alpha-2
 * Top 50 países más relevantes para comercio en Panamá
 */

const countries = [
    // Países de América
    { code: 'PA', name: 'Panama', nameEs: 'Panamá' },
    { code: 'US', name: 'United States of America', nameEs: 'Estados Unidos de América' },
    { code: 'CA', name: 'Canada', nameEs: 'Canadá' },
    { code: 'MX', name: 'Mexico', nameEs: 'México' },
    { code: 'BR', name: 'Brazil', nameEs: 'Brasil' },
    { code: 'AR', name: 'Argentina', nameEs: 'Argentina' },
    { code: 'CO', name: 'Colombia', nameEs: 'Colombia' },
    { code: 'CL', name: 'Chile', nameEs: 'Chile' },
    { code: 'PE', name: 'Peru', nameEs: 'Perú' },
    { code: 'CR', name: 'Costa Rica', nameEs: 'Costa Rica' },
    { code: 'DO', name: 'Dominican Republic', nameEs: 'República Dominicana' },
    { code: 'GT', name: 'Guatemala', nameEs: 'Guatemala' },
    { code: 'HN', name: 'Honduras', nameEs: 'Honduras' },
    { code: 'NI', name: 'Nicaragua', nameEs: 'Nicaragua' },
    { code: 'SV', name: 'El Salvador', nameEs: 'El Salvador' },
    { code: 'VE', name: 'Venezuela', nameEs: 'Venezuela' },
    { code: 'EC', name: 'Ecuador', nameEs: 'Ecuador' },
    { code: 'BO', name: 'Bolivia', nameEs: 'Bolivia' },
    { code: 'PY', name: 'Paraguay', nameEs: 'Paraguay' },
    { code: 'UY', name: 'Uruguay', nameEs: 'Uruguay' },

    // Europa
    { code: 'ES', name: 'Spain', nameEs: 'España' },
    { code: 'GB', name: 'United Kingdom', nameEs: 'Reino Unido' },
    { code: 'FR', name: 'France', nameEs: 'Francia' },
    { code: 'DE', name: 'Germany', nameEs: 'Alemania' },
    { code: 'IT', name: 'Italy', nameEs: 'Italia' },
    { code: 'PT', name: 'Portugal', nameEs: 'Portugal' },
    { code: 'NL', name: 'Netherlands', nameEs: 'Países Bajos' },
    { code: 'BE', name: 'Belgium', nameEs: 'Bélgica' },
    { code: 'CH', name: 'Switzerland', nameEs: 'Suiza' },
    { code: 'SE', name: 'Sweden', nameEs: 'Suecia' },

    // Asia
    { code: 'CN', name: 'China', nameEs: 'China' },
    { code: 'JP', name: 'Japan', nameEs: 'Japón' },
    { code: 'KR', name: 'South Korea', nameEs: 'Corea del Sur' },
    { code: 'IN', name: 'India', nameEs: 'India' },
    { code: 'SG', name: 'Singapore', nameEs: 'Singapur' },
    { code: 'HK', name: 'Hong Kong', nameEs: 'Hong Kong' },
    { code: 'TW', name: 'Taiwan', nameEs: 'Taiwán' },
    { code: 'TH', name: 'Thailand', nameEs: 'Tailandia' },
    { code: 'MY', name: 'Malaysia', nameEs: 'Malasia' },
    { code: 'PH', name: 'Philippines', nameEs: 'Filipinas' },

    // Oceanía
    { code: 'AU', name: 'Australia', nameEs: 'Australia' },
    { code: 'NZ', name: 'New Zealand', nameEs: 'Nueva Zelanda' },

    // Medio Oriente
    { code: 'AE', name: 'United Arab Emirates', nameEs: 'Emiratos Árabes Unidos' },
    { code: 'SA', name: 'Saudi Arabia', nameEs: 'Arabia Saudita' },
    { code: 'IL', name: 'Israel', nameEs: 'Israel' },

    // África
    { code: 'ZA', name: 'South Africa', nameEs: 'Sudáfrica' },
    { code: 'EG', name: 'Egypt', nameEs: 'Egipto' },

    // Otros importantes
    { code: 'RU', name: 'Russia', nameEs: 'Rusia' },
    { code: 'TR', name: 'Turkey', nameEs: 'Turquía' },
    { code: 'NO', name: 'Norway', nameEs: 'Noruega' },
];

async function seedCountries() {
    console.log('🌍 Seeding países...');

    try {
        let created = 0;
        let skipped = 0;

        for (const country of countries) {
            try {
                await prisma.hKACountry.create({
                    data: {
                        id: `CTR_${country.code}`,
                        ...country,
                    },
                });
                created++;
                process.stdout.write(`\r✅ Creados: ${created}, Omitidos: ${skipped}`);
            } catch (error: any) {
                if (error.code === 'P2002') {
                    // Ya existe
                    skipped++;
                    process.stdout.write(`\r[SUCCESS] Creados: ${created}, Omitidos: ${skipped}`);
                } else {
                    throw error;
                }
            }
        }

        console.log(`\n\n[SUCCESS] Seed de países completado!`);
        console.log(`   Total: ${countries.length}`);
        console.log(`   Creados: ${created}`);
        console.log(`   Omitidos: ${skipped}`);

    } catch (error) {
        console.error('\n❌ Error seeding países:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    seedCountries()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}

export { seedCountries };
