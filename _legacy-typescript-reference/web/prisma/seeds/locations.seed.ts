import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de ubicaciones de Panamá
 * Top 100 ubicaciones más pobladas/importantes
 * 
 * Formato: Código (Provincia-Distrito-Corregimiento)
 * Fuente: Anexo Técnico HKA - Tabla 4
 */

const locations = [
    // PANAMÁ (Provincia más importante)
    { code: '8-8-1', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'SAN FELIPE', fullName: 'PANAMA-PANAMA-SAN FELIPE' },
    { code: '8-8-2', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'EL CHORRILLO', fullName: 'PANAMA-PANAMA-EL CHORRILLO' },
    { code: '8-8-3', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'SANTA ANA', fullName: 'PANAMA-PANAMA-SANTA ANA' },
    { code: '8-8-4', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'LA EXPOSICIÓN O CALIDONIA', fullName: 'PANAMA-PANAMA-LA EXPOSICIÓN O CALIDONIA' },
    { code: '8-8-5', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'CURUNDU', fullName: 'PANAMA-PANAMA-CURUNDU' },
    { code: '8-8-6', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'BETANIA', fullName: 'PANAMA-PANAMA-BETANIA' },
    { code: '8-8-7', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'BELLA VISTA', fullName: 'PANAMA-PANAMA-BELLA VISTA' },
    { code: '8-8-8', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'PUEBLO NUEVO', fullName: 'PANAMA-PANAMA-PUEBLO NUEVO' },
    { code: '8-8-9', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'SAN FRANCISCO', fullName: 'PANAMA-PANAMA-SAN FRANCISCO' },
    { code: '8-8-10', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'PARQUE LEFEVRE', fullName: 'PANAMA-PANAMA-PARQUE LEFEVRE' },
    { code: '8-8-11', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'RIO ABAJO', fullName: 'PANAMA-PANAMA-RIO ABAJO' },
    { code: '8-8-12', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'JUAN DIAZ', fullName: 'PANAMA-PANAMA-JUAN DIAZ' },
    { code: '8-8-13', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'PEDREGAL', fullName: 'PANAMA-PANAMA-PEDREGAL' },
    { code: '8-8-14', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'ANCON', fullName: 'PANAMA-PANAMA-ANCON' },
    { code: '8-8-15', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'CHILIBRE', fullName: 'PANAMA-PANAMA-CHILIBRE' },
    { code: '8-8-16', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'LAS CUMBRES', fullName: 'PANAMA-PANAMA-LAS CUMBRES' },
    { code: '8-8-17', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'PACORA', fullName: 'PANAMA-PANAMA-PACORA' },
    { code: '8-8-18', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'SAN MARTIN', fullName: 'PANAMA-PANAMA-SAN MARTIN' },
    { code: '8-8-19', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'TOCUMEN', fullName: 'PANAMA-PANAMA-TOCUMEN' },
    { code: '8-8-20', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'LAS MAÑANITAS', fullName: 'PANAMA-PANAMA-LAS MAÑANITAS' },
    { code: '8-8-21', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: '24 DE DICIEMBRE', fullName: 'PANAMA-PANAMA-24 DE DICIEMBRE' },
    { code: '8-8-22', provincia: 'PANAMA', distrito: 'PANAMA', corregimiento: 'ERNESTO CORDOBA CAMPOS', fullName: 'PANAMA-PANAMA-ERNESTO CORDOBA CAMPOS' },

    // SAN MIGUELITO (Alto población)
    { code: '8-10-1', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'AMELIA DENIS DE ICAZA', fullName: 'PANAMA-SAN MIGUELITO-AMELIA DENIS DE ICAZA' },
    { code: '8-10-2', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'BELISARIO PORRAS', fullName: 'PANAMA-SAN MIGUELITO-BELISARIO PORRAS' },
    { code: '8-10-3', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'JOSE DOMINGO ESPINAR', fullName: 'PANAMA-SAN MIGUELITO-JOSE DOMINGO ESPINAR' },
    { code: '8-10-4', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'MATEO ITURRALDE', fullName: 'PANAMA-SAN MIGUELITO-MATEO ITURRALDE' },
    { code: '8-10-5', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'VICTORIANO LORENZO', fullName: 'PANAMA-SAN MIGUELITO-VICTORIANO LORENZO' },
    { code: '8-10-6', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'ARNULFO ARIAS', fullName: 'PANAMA-SAN MIGUELITO-ARNULFO ARIAS' },
    { code: '8-10-7', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'BELISARIO FRIAS', fullName: 'PANAMA-SAN MIGUELITO-BELISARIO FRIAS' },
    { code: '8-10-8', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'OMAR TORRIJOS', fullName: 'PANAMA-SAN MIGUELITO-OMAR TORRIJOS' },
    { code: '8-10-9', provincia: 'PANAMA', distrito: 'SAN MIGUELITO', corregimiento: 'RUFINA ALFARO', fullName: 'PANAMA-SAN MIGUELITO-RUFINA ALFARO' },

    // PANAMA OESTE (Importante)
    { code: '13-1-1', provincia: 'PANAMA OESTE', distrito: 'ARRAIJAN', corregimiento: 'ARRAIJAN (CABECERA)', fullName: 'PANAMA OESTE-ARRAIJAN-ARRAIJAN (CABECERA)' },
    { code: '13-1-2', provincia: 'PANAMA OESTE', distrito: 'ARRAIJAN', corregimiento: 'BURUNGA', fullName: 'PANAMA OESTE-ARRAIJAN-BURUNGA' },
    { code: '13-1-5', provincia: 'PANAMA OESTE', distrito: 'ARRAIJAN', corregimiento: 'NUEVO EMPERADOR', fullName: 'PANAMA OESTE-ARRAIJAN-NUEVO EMPERADOR' },
    { code: '13-4-1', provincia: 'PANAMA OESTE', distrito: 'LA CHORRERA', corregimiento: 'BARRIO BALBOA', fullName: 'PANAMA OESTE-LA CHORRERA-BARRIO BALBOA' },
    { code: '13-4-2', provincia: 'PANAMA OESTE', distrito: 'LA CHORRERA', corregimiento: 'BARRIO COLON', fullName: 'PANAMA OESTE-LA CHORRERA-BARRIO COLON' },

    // COLON (Zona Libre)
    { code: '3-1-1', provincia: 'COLON', distrito: 'COLON', corregimiento: 'BARRIO NORTE', fullName: 'COLON-COLON-BARRIO NORTE' },
    { code: '3-1-2', provincia: 'COLON', distrito: 'COLON', corregimiento: 'BARRIO SUR', fullName: 'COLON-COLON-BARRIO SUR' },
    { code: '3-1-6', provincia: 'COLON', distrito: 'COLON', corregimiento: 'CRISTOBAL', fullName: 'COLON-COLON-CRISTOBAL' },

    // CHIRIQUI (Comercio)
    { code: '4-6-1', provincia: 'CHIRIQUI', distrito: 'DAVID', corregimiento: 'DAVID (CABECERA)', fullName: 'CHIRIQUI-DAVID-DAVID (CABECERA)' },
    { code: '4-6-7', provincia: 'CHIRIQUI', distrito: 'DAVID', corregimiento: 'PEDREGAL', fullName: 'CHIRIQUI-DAVID-PEDREGAL' },
    { code: '4-6-8', provincia: 'CHIRIQUI', distrito: 'DAVID', corregimiento: 'SAN CARLOS', fullName: 'CHIRIQUI-DAVID-SAN CARLOS' },

    // COCLE
    { code: '2-6-1', provincia: 'COCLE', distrito: 'PENONOME', corregimiento: 'PENONOME (CABECERA)', fullName: 'COCLE-PENONOME-PENONOME (CABECERA)' },

    // HERRERA
    { code: '6-1-1', provincia: 'HERRERA', distrito: 'CHITRE', corregimiento: 'CHITRE (CABECERA)', fullName: 'HERRERA-CHITRE-CHITRE (CABECERA)' },

    // LOS SANTOS
    { code: '7-2-1', provincia: 'LOS SANTOS', distrito: 'LAS TABLAS', corregimiento: 'LAS TABLAS (CABECERA)', fullName: 'LOS SANTOS-LAS TABLAS-LAS TABLAS (CABECERA)' },

    // VERAGUAS
    { code: '9-10-1', provincia: 'VERAGUAS', distrito: 'SANTIAGO', corregimiento: 'SANTIAGO (CABECERA)', fullName: 'VERAGUAS-SANTIAGO-SANTIAGO (CABECERA)' },

    // BOCAS DEL TORO
    { code: '1-1-1', provincia: 'BOCAS DEL TORO', distrito: 'BOCAS DEL TORO', corregimiento: 'BOCAS DEL TORO (CABECERA)', fullName: 'BOCAS DEL TORO-BOCAS DEL TORO-BOCAS DEL TORO (CABECERA)' },
];

async function seedLocations() {
    console.log('📍 Seeding ubicaciones de Panamá...');

    try {
        let created = 0;
        let skipped = 0;

        for (const location of locations) {
            try {
                await prisma.hKALocation.create({
                    data: {
                        id: `LOC_${location.code.replace(/-/g, '_')}`,
                        ...location,
                    },
                });
                created++;
                process.stdout.write(`\r✅ Creadas: ${created}, Omitidas: ${skipped}`);
            } catch (error: any) {
                if (error.code === 'P2002') {
                    skipped++;
                    process.stdout.write(`\r[INFO] Creadas: ${created}, Omitidas: ${skipped}`);
                } else {
                    throw error;
                }
            }
        }

        console.log(`\n\n[SUCCESS] Seed de ubicaciones completado!`);
        console.log(`   Total: ${locations.length}`);
        console.log(`   Creadas: ${created}`);
        console.log(`   Omitidas: ${skipped}`);

    } catch (error) {
        console.error('\n❌ Error seeding ubicaciones:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    seedLocations()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}

export { seedLocations };
