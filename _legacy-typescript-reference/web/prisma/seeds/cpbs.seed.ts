import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de categorías CPBS (Codificación Panameña de Bienes y Servicios)
 * Top 30 categorías más usadas
 * 
 * Formato: Segmento (2 dígitos) - Familia (4 dígitos)
 * Fuente: Anexo Técnico HKA - Tabla 4
 */

const categories = [
    // Segmento 10: Material Vivo Vegetal y Animal
    { segment: '10', family: '1010', segmentName: 'Material Vivo Vegetal y Animal, Accesorios y Suministros', familyName: 'Animales vivos' },
    { segment: '10', family: '1011', segmentName: 'Material Vivo Vegetal y Animal, Accesorios y Suministros', familyName: 'Productos para animales domésticos' },
    { segment: '10', family: '1012', segmentName: 'Material Vivo Vegetal y Animal, Accesorios y Suministros', familyName: 'Comida de animales' },

    // Segmento 11: Material Mineral, Textil y Vegetal y Animal No Comestible
    { segment: '11', family: '1110', segmentName: 'Material Mineral, Textil y Vegetal y Animal No Comestible', familyName: 'Minerales, minerales metálicos y metales' },
    { segment: '11', family: '1115', segmentName: 'Material Mineral, Textil y Vegetal y Animal No Comestible', familyName: 'Fibra, hilos e hilados' },

    // Segmento 14: Materiales y Productos de Papel
    { segment: '14', family: '1400', segmentName: 'Materiales y Productos de Papel', familyName: 'Materiales y Productos de Papel' },
    { segment: '14', family: '1410', segmentName: 'Materiales y Productos de Papel', familyName: 'Materiales de papel' },
    { segment: '14', family: '1411', segmentName: 'Materiales y Productos de Papel', familyName: 'Productos de papel' },

    // Segmento 15: Materiales Combustibles
    { segment: '15', family: '1510', segmentName: 'Materiales Combustibles, Aditivos para Combustibles, Lubricantes y Anticorrosivos', familyName: 'Combustibles' },

    // Segmento 30: Componentes y Suministros para Estructuras
    { segment: '30', family: '3010', segmentName: 'Componentes y Suministros para Estructuras, Edificación, Construcción y Obras Civiles', familyName: 'Componentes estructurales y formas básicas' },
    { segment: '30', family: '3011', segmentName: 'Componentes y Suministros para Estructuras, Edificación, Construcción y Obras Civiles', familyName: 'Hormigón, cemento y yeso' },

    // Segmento 39: Componentes, Accesorios y Suministros de Sistemas Eléctricos e Iluminación
    { segment: '39', family: '3910', segmentName: 'Componentes, Accesorios y Suministros de Sistemas Eléctricos e Iluminación', familyName: 'Lámparas y bombillas y componentes para lámparas' },

    // Segmento 42: Equipo Médico, Accesorios y Suministros
    { segment: '42', family: '4214', segmentName: 'Equipo Médico, Accesorios y Suministros', familyName: 'Suministros, productos de tratamiento y cuidado del enfermo' },

    // Segmento 43: Difusión de Tecnologías de Información y Telecomunicaciones
    { segment: '43', family: '4321', segmentName: 'Difusión de Tecnologías de Información y Telecomunicaciones', familyName: 'Equipo informático y accesorios' },
    { segment: '43', family: '4323', segmentName: 'Difusión de Tecnologías de Información y Telecomunicaciones', familyName: 'Software' },

    // Segmento 44: Equipos de Oficina, Accesorios y Suministros
    { segment: '44', family: '4410', segmentName: 'Equipos de Oficina, Accesorios y Suministros', familyName: 'Maquinaria, suministros y accesorios de oficina' },
    { segment: '44', family: '4412', segmentName: 'Equipos de Oficina, Accesorios y Suministros', familyName: 'Suministros de oficina' },

    // Segmento 50: Alimentos, Bebidas y Tabaco
    { segment: '50', family: '5010', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Frutos secos' },
    { segment: '50', family: '5011', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Productos de carne y aves de corral' },
    { segment: '50', family: '5012', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Pescados y mariscos' },
    { segment: '50', family: '5013', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Productos lácteos y huevos' },
    { segment: '50', family: '5018', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Productos de panadería' },
    { segment: '50', family: '5020', segmentName: 'Alimentos, Bebidas y Tabaco', familyName: 'Bebidas' },

    // Segmento 52: Artículos Domésticos
    { segment: '52', family: '5214', segmentName: 'Artículos Domésticos, Suministros y Productos Electrónicos de Consumo', familyName: 'Aparatos electrodomésticos' },
    { segment: '52', family: '5216', segmentName: 'Artículos Domésticos, Suministros y Productos Electrónicos de Consumo', familyName: 'Electrónica de consumo' },

    // Segmento 53: Ropa, Maletas y Productos de Aseo Personal
    { segment: '53', family: '5310', segmentName: 'Ropa, Maletas y Productos de Aseo Personal', familyName: 'Ropa' },
    { segment: '53', family: '5311', segmentName: 'Ropa, Maletas y Productos de Aseo Personal', familyName: 'Calzado' },
    { segment: '53', family: '5313', segmentName: 'Ropa, Maletas y Productos de Aseo Personal', familyName: 'Artículos de tocador y cuidado personal' },

    // Segmento 56: Muebles, Mobiliario y Decoración
    { segment: '56', family: '5610', segmentName: 'Muebles, Mobiliario y Decoración', familyName: 'Muebles de alojamiento' },
];

async function seedCPBS() {
    console.log('📦 Seeding categorías CPBS...');

    try {
        let created = 0;
        let skipped = 0;

        for (const category of categories) {
            try {
                await prisma.hKACPBSCategory.create({
                    data: {
                        id: `CPBS_${category.segment}_${category.family}`,
                        ...category,
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

        console.log(`\n\n[SUCCESS] Seed de CPBS completado!`);
        console.log(`   Total: ${categories.length}`);
        console.log(`   Creadas: ${created}`);
        console.log(`   Omitidas: ${skipped}`);

    } catch (error) {
        console.error('\n❌ Error seeding CPBS:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    seedCPBS()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}

export { seedCPBS };
