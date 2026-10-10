'use client';

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { ScrollArea } from '@shared/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

// ─── Full CPBS catalog (Tabla 28 DGI) ────────────────────────────────
interface CPBSFamily {
    code: string;   // 4-digit family code
    name: string;   // family description
}

interface CPBSSegment {
    code: string;   // 2-digit segment code
    name: string;   // segment description
    families: CPBSFamily[];
}

const CPBS_CATALOG: CPBSSegment[] = [
    { code: '10', name: 'Material Vivo Vegetal y Animal', families: [
        { code: '1010', name: 'Animales vivos' },
        { code: '1011', name: 'Productos para animales domésticos' },
        { code: '1012', name: 'Comida de animales' },
        { code: '1013', name: 'Recipientes y hábitat para animales' },
        { code: '1014', name: 'Productos de talabartería y arreo' },
        { code: '1015', name: 'Semillas, bulbos, plántulas y esquejes' },
        { code: '1016', name: 'Productos de floricultura y silvicultura' },
        { code: '1017', name: 'Fertilizantes y nutrientes para plantas' },
        { code: '1019', name: 'Productos para el control de plagas' },
    ]},
    { code: '11', name: 'Materiales Minerales, Textiles y No Comestibles', families: [
        { code: '1110', name: 'Minerales, metales y materiales de mina' },
        { code: '1111', name: 'Tierra, arena, piedra y agregados' },
        { code: '1112', name: 'Materiales no comestibles de origen vegetal/animal' },
        { code: '1113', name: 'Materiales de tela, pieles y cuero' },
        { code: '1114', name: 'Fibras no tejidas' },
        { code: '1115', name: 'Hilos, cordeles, sogas' },
    ]},
    { code: '12', name: 'Materiales Químicos', families: [
        { code: '1210', name: 'Explosivos, pirotecnia' },
        { code: '1211', name: 'Elementos y gases químicos' },
        { code: '1212', name: 'Materiales de ácidos, bases y sales' },
        { code: '1213', name: 'Materiales aditivos' },
        { code: '1214', name: 'Materiales colorantes' },
        { code: '1216', name: 'Solventes' },
    ]},
    { code: '13', name: 'Resina, Caucho, Espuma y Película', families: [
        { code: '1311', name: 'Resinas y materiales derivados' },
        { code: '1312', name: 'Caucho y elastómero' },
    ]},
    { code: '14', name: 'Materiales y Productos de Papel', families: [
        { code: '1410', name: 'Materiales de papel' },
        { code: '1411', name: 'Productos de papel' },
    ]},
    { code: '15', name: 'Materiales Combustibles', families: [
        { code: '1510', name: 'Combustibles' },
        { code: '1511', name: 'Combustibles gaseosos y aditivos' },
        { code: '1512', name: 'Lubricantes, aceites, grasas y anticorrosivos' },
    ]},
    { code: '20', name: 'Maquinaria de Minería y Perforación', families: [
        { code: '2010', name: 'Maquinaria de minería y canteras' },
        { code: '2011', name: 'Equipo de perforación de pozos' },
        { code: '2012', name: 'Equipo de producción de pozos' },
        { code: '2013', name: 'Maquinaria de refinación de petróleo' },
        { code: '2014', name: 'Procesamiento de minerales y gas' },
    ]},
    { code: '21', name: 'Maquinaria Agrícola, Pesquera y Forestal', families: [
        { code: '2110', name: 'Maquinaria y equipo agrícola' },
        { code: '2111', name: 'Maquinaria pesquera y de acuicultura' },
        { code: '2112', name: 'Maquinaria y equipo forestal' },
    ]},
    { code: '22', name: 'Maquinaria y Equipo de Construcción', families: [
        { code: '2210', name: 'Maquinaria pesada de construcción' },
        { code: '2211', name: 'Equipo de construcción' },
    ]},
    { code: '23', name: 'Maquinaria y Equipo Industrial', families: [
        { code: '2310', name: 'Maquinaria de transformación de materiales' },
        { code: '2311', name: 'Maquinaria de fabricación industrial' },
        { code: '2312', name: 'Equipo de corte y conformado industrial' },
        { code: '2313', name: 'Maquinaria textil y de confección' },
        { code: '2314', name: 'Procesamiento de piedras y minerales' },
        { code: '2315', name: 'Procesamiento de madera y papel' },
        { code: '2316', name: 'Maquinaria de impresión y publicación' },
    ]},
    { code: '24', name: 'Equipo de Manejo de Material', families: [
        { code: '2410', name: 'Equipo de manejo y acondicionamiento' },
        { code: '2411', name: 'Equipo de almacenaje y bodega' },
        { code: '2412', name: 'Embalaje y contenedores' },
    ]},
    { code: '25', name: 'Vehículos', families: [
        { code: '2510', name: 'Vehículos de motor' },
        { code: '2511', name: 'Equipo marino' },
        { code: '2512', name: 'Aeronaves' },
        { code: '2513', name: 'Vehículos no motorizados' },
        { code: '2514', name: 'Bicicletas' },
        { code: '2517', name: 'Componentes y sistemas de vehículos' },
        { code: '2518', name: 'Mantenimiento y reparación de vehículos' },
    ]},
    { code: '26', name: 'Generación y Distribución de Energía', families: [
        { code: '2610', name: 'Generación de energía' },
        { code: '2611', name: 'Distribución y acondicionamiento de energía' },
        { code: '2612', name: 'Equipo de energía atómica y nuclear' },
        { code: '2613', name: 'Baterías, pilas y accesorios' },
    ]},
    { code: '27', name: 'Herramientas y Maquinaria General', families: [
        { code: '2710', name: 'Herramientas manuales' },
        { code: '2711', name: 'Herramientas automotrices' },
        { code: '2712', name: 'Herramientas eléctricas' },
    ]},
    { code: '30', name: 'Estructuras y Materiales de Construcción', families: [
        { code: '3010', name: 'Estructuras y componentes prefabricados' },
        { code: '3011', name: 'Materiales de concreto y cemento' },
        { code: '3012', name: 'Materiales para vías' },
        { code: '3013', name: 'Materiales de aislamiento' },
        { code: '3014', name: 'Cerrajería y ferretería' },
        { code: '3015', name: 'Pinturas, sellantes y adhesivos' },
        { code: '3016', name: 'Material de plomería' },
        { code: '3017', name: 'Calefacción, ventilación y aire' },
    ]},
    { code: '31', name: 'Componentes y Suministros Electrónicos', families: [
        { code: '3110', name: 'Circuitos impresos y componentes' },
        { code: '3111', name: 'Semiconductores y dispositivos electrónicos' },
        { code: '3112', name: 'Componentes pasivos' },
        { code: '3113', name: 'Dispositivos electromecánicos' },
        { code: '3114', name: 'Equipo de prueba electrónico' },
        { code: '3115', name: 'Iluminación y accesorios' },
        { code: '3116', name: 'Cable, alambre y arneses eléctricos' },
    ]},
    { code: '32', name: 'Circuitos y Componentes Eléctricos', families: [
        { code: '3210', name: 'Circuitos eléctricos' },
        { code: '3211', name: 'Equipo eléctrico' },
    ]},
    { code: '39', name: 'Luminarias y Lámparas', families: [
        { code: '3910', name: 'Lámparas y bombillas' },
        { code: '3911', name: 'Accesorios de iluminación' },
        { code: '3912', name: 'Iluminación exterior' },
    ]},
    { code: '40', name: 'Equipo de Calefacción, Ventilación y AC', families: [
        { code: '4010', name: 'Equipo de calefacción' },
        { code: '4011', name: 'Equipo de refrigeración' },
        { code: '4012', name: 'Equipo de ventilación' },
    ]},
    { code: '41', name: 'Equipos de Laboratorio y Científicos', families: [
        { code: '4110', name: 'Equipos de laboratorio' },
        { code: '4111', name: 'Instrumentos de medición y prueba' },
        { code: '4112', name: 'Óptica y equipo fotónico' },
    ]},
    { code: '42', name: 'Equipo Médico y Suministros', families: [
        { code: '4210', name: 'Equipo de hospital' },
        { code: '4211', name: 'Suministros médicos' },
        { code: '4212', name: 'Instrumentos quirúrgicos' },
        { code: '4213', name: 'Equipo y mobiliario odontológico' },
        { code: '4214', name: 'Equipo ortopédico y prótesis' },
        { code: '4215', name: 'Equipos de diálisis' },
        { code: '4216', name: 'Equipo veterinario' },
        { code: '4217', name: 'Productos farmacéuticos' },
        { code: '4218', name: 'Equipo de obstetricia y ginecología' },
        { code: '4219', name: 'Productos de nutrición' },
        { code: '4220', name: 'Equipo e instrumentos clínicos' },
        { code: '4221', name: 'Equipo de análisis de sangre' },
        { code: '4222', name: 'Suministros de botiquín' },
        { code: '4223', name: 'Alternativas y productos terapéuticos' },
    ]},
    { code: '43', name: 'Tecnología de la Información (TI)', families: [
        { code: '4310', name: 'Computadoras y dispositivos' },
        { code: '4311', name: 'Equipos informáticos y accesorios' },
        { code: '4312', name: 'Software' },
        { code: '4320', name: 'Equipo de telecomunicaciones' },
        { code: '4321', name: 'Componentes de telecomunicación' },
        { code: '4322', name: 'Equipo de redes' },
        { code: '4323', name: 'Equipos de almacenamiento de datos' },
    ]},
    { code: '44', name: 'Equipo y Suministros de Oficina', families: [
        { code: '4410', name: 'Máquinas y accesorios de oficina' },
        { code: '4411', name: 'Suministros de oficina' },
        { code: '4412', name: 'Equipos de administración postal' },
    ]},
    { code: '45', name: 'Equipo de Impresión y Publicación', families: [
        { code: '4510', name: 'Equipo de impresión' },
        { code: '4511', name: 'Material de impresión y suministros' },
        { code: '4512', name: 'Equipo de audio y video' },
    ]},
    { code: '46', name: 'Equipo de Defensa y Seguridad', families: [
        { code: '4610', name: 'Armas ligeras y municiones' },
        { code: '4611', name: 'Equipo de seguridad' },
        { code: '4612', name: 'Equipo de defensa contra incendios' },
        { code: '4613', name: 'Equipo de vigilancia y detección' },
        { code: '4614', name: 'Equipo de protección personal' },
        { code: '4615', name: 'Equipo de señalización' },
    ]},
    { code: '47', name: 'Equipo de Limpieza', families: [
        { code: '4710', name: 'Equipo de limpieza' },
        { code: '4711', name: 'Suministros de limpieza' },
        { code: '4712', name: 'Equipo de lavado comercial e industrial' },
    ]},
    { code: '48', name: 'Equipo de Servicio y Hospitalidad', families: [
        { code: '4810', name: 'Equipo de cocina doméstica' },
        { code: '4811', name: 'Equipo de cocina industrial' },
        { code: '4812', name: 'Equipo para servicio de alimentos' },
        { code: '4813', name: 'Vajilla, utensilios y equipo de servir' },
    ]},
    { code: '49', name: 'Equipo Deportivo y Recreativo', families: [
        { code: '4910', name: 'Equipo deportivo' },
        { code: '4911', name: 'Equipo de acondicionamiento físico' },
        { code: '4912', name: 'Equipo de campismo y recreación' },
    ]},
    { code: '50', name: 'Alimentos, Bebidas y Tabaco', families: [
        { code: '5010', name: 'Carne, aves y productos cárnicos' },
        { code: '5011', name: 'Mariscos' },
        { code: '5012', name: 'Lácteos y huevos' },
        { code: '5013', name: 'Frutas y vegetales' },
        { code: '5014', name: 'Aceites y grasas comestibles' },
        { code: '5015', name: 'Chocolate, azúcar y edulcorantes' },
        { code: '5016', name: 'Productos de panadería' },
        { code: '5017', name: 'Bebidas' },
        { code: '5018', name: 'Tabaco' },
        { code: '5019', name: 'Granos, cereales y pastas' },
        { code: '5020', name: 'Nueces y semillas preparadas' },
        { code: '5021', name: 'Alimentos preparados y conservados' },
        { code: '5022', name: 'Condimentos y salsas' },
    ]},
    { code: '51', name: 'Medicamentos y Productos Farmacéuticos', families: [
        { code: '5110', name: 'Medicamentos antiinfecciosos' },
        { code: '5111', name: 'Agentes antineoplásicos' },
        { code: '5112', name: 'Agentes del sistema cardiovascular' },
        { code: '5113', name: 'Agentes hormonales' },
        { code: '5114', name: 'Agentes del sistema nervioso' },
        { code: '5115', name: 'Agentes del aparato respiratorio' },
        { code: '5116', name: 'Agentes del sistema musculoesquelético' },
        { code: '5117', name: 'Agentes del aparato gastrointestinal' },
        { code: '5118', name: 'Agentes hematológicos' },
        { code: '5119', name: 'Agentes del sistema genitourinario' },
        { code: '5120', name: 'Agentes dermatológicos' },
        { code: '5121', name: 'Agentes oftalmológicos' },
        { code: '5126', name: 'Vitaminas y minerales' },
        { code: '5127', name: 'Inmunológicos' },
    ]},
    { code: '52', name: 'Ropa, Equipaje y Artículos Personales', families: [
        { code: '5210', name: 'Ropa' },
        { code: '5211', name: 'Calzado' },
        { code: '5212', name: 'Equipaje y artículos de cuero' },
        { code: '5213', name: 'Productos de aseo personal' },
    ]},
    { code: '53', name: 'Muebles y Textiles para el Hogar', families: [
        { code: '5310', name: 'Muebles domésticos' },
        { code: '5311', name: 'Muebles de oficina' },
        { code: '5312', name: 'Muebles institucionales y escolares' },
        { code: '5313', name: 'Alfombras, cortinas y decoración' },
        { code: '5314', name: 'Textiles para el hogar' },
    ]},
    { code: '54', name: 'Herramientas y Equipo de Jardinería', families: [
        { code: '5410', name: 'Herramientas de jardinería' },
        { code: '5411', name: 'Equipo de riego' },
        { code: '5412', name: 'Equipo de paisajismo' },
    ]},
    { code: '55', name: 'Material Impreso y Publicaciones', families: [
        { code: '5510', name: 'Material impreso' },
        { code: '5511', name: 'Publicaciones electrónicas' },
        { code: '5512', name: 'Etiquetas y letreros' },
    ]},
    { code: '56', name: 'Mobiliario Urbano y Exterior', families: [
        { code: '5610', name: 'Mobiliario urbano' },
        { code: '5611', name: 'Equipo para parques y jardines' },
    ]},
    { code: '60', name: 'Maquinaria y Accesorios de Transporte', families: [
        { code: '6010', name: 'Equipo y accesorios de transporte' },
    ]},
    { code: '70', name: 'Servicios de Consultoría, TI y Telecomunicaciones', families: [
        { code: '7010', name: 'Servicios de consultoría profesional' },
        { code: '7011', name: 'Servicios de tecnología de la información' },
        { code: '7012', name: 'Servicios de telecomunicaciones' },
    ]},
    { code: '71', name: 'Servicios de Minería, Gas y Petróleo', families: [
        { code: '7110', name: 'Servicios de minería' },
        { code: '7111', name: 'Servicios de petróleo y gas' },
    ]},
    { code: '72', name: 'Servicios de Construcción e Ingeniería', families: [
        { code: '7210', name: 'Servicios de construcción' },
        { code: '7211', name: 'Servicios de mantenimiento de edificios' },
        { code: '7212', name: 'Servicios eléctricos' },
        { code: '7213', name: 'Servicios de plomería' },
        { code: '7214', name: 'Servicios de pintura y revestimiento' },
        { code: '7215', name: 'Mantenimiento y reparación de maquinaria' },
    ]},
    { code: '73', name: 'Servicios de Producción Industrial', families: [
        { code: '7310', name: 'Servicios de manufactura' },
        { code: '7311', name: 'Servicios de procesamiento' },
    ]},
    { code: '76', name: 'Servicios de Limpieza y Gestión de Residuos', families: [
        { code: '7610', name: 'Servicios de limpieza' },
        { code: '7611', name: 'Gestión de residuos' },
    ]},
    { code: '77', name: 'Servicios Ambientales', families: [
        { code: '7710', name: 'Servicios de gestión ambiental' },
        { code: '7711', name: 'Servicios de remediación ambiental' },
    ]},
    { code: '78', name: 'Servicios de Transporte y Logística', families: [
        { code: '7810', name: 'Transporte de pasajeros' },
        { code: '7811', name: 'Transporte de carga' },
        { code: '7812', name: 'Servicios de correo y mensajería' },
        { code: '7813', name: 'Servicios de almacenaje' },
    ]},
    { code: '80', name: 'Servicios de Gestión y Administrativos', families: [
        { code: '8010', name: 'Servicios de consultoría de negocios' },
        { code: '8011', name: 'Servicios de recursos humanos' },
        { code: '8012', name: 'Servicios legales' },
        { code: '8013', name: 'Servicios inmobiliarios' },
        { code: '8014', name: 'Servicios de mercadeo y publicidad' },
        { code: '8015', name: 'Servicios de comercio' },
        { code: '8016', name: 'Servicios de gestión de documentos' },
    ]},
    { code: '81', name: 'Servicios Financieros y de Seguros', families: [
        { code: '8110', name: 'Servicios financieros' },
        { code: '8111', name: 'Servicios bancarios' },
        { code: '8112', name: 'Servicios de seguros' },
        { code: '8113', name: 'Servicios contables' },
    ]},
    { code: '82', name: 'Servicios Educativos y de Formación', families: [
        { code: '8210', name: 'Servicios educativos' },
        { code: '8211', name: 'Servicios de formación profesional' },
    ]},
    { code: '83', name: 'Servicios Públicos y Sociales', families: [
        { code: '8310', name: 'Servicios de agua' },
        { code: '8311', name: 'Servicios de electricidad' },
        { code: '8312', name: 'Servicios de gas' },
        { code: '8313', name: 'Servicios de alcantarillado' },
    ]},
    { code: '84', name: 'Servicios de Salud', families: [
        { code: '8410', name: 'Servicios de salud' },
        { code: '8411', name: 'Servicios farmacéuticos' },
    ]},
    { code: '85', name: 'Servicios Editoriales y de Diseño', families: [
        { code: '8510', name: 'Servicios de impresión' },
        { code: '8511', name: 'Servicios de diseño' },
        { code: '8512', name: 'Servicios de publicidad' },
    ]},
    { code: '86', name: 'Servicios de Defensa y Seguridad', families: [
        { code: '8610', name: 'Servicios de defensa nacional' },
        { code: '8611', name: 'Servicios de seguridad pública' },
        { code: '8612', name: 'Servicios de vigilancia' },
    ]},
    { code: '90', name: 'Servicios de Viaje y Hospedaje', families: [
        { code: '9010', name: 'Servicios de restaurantes y catering' },
        { code: '9011', name: 'Servicios de alojamiento' },
        { code: '9012', name: 'Servicios de viaje' },
    ]},
    { code: '91', name: 'Servicios Personales y Domésticos', families: [
        { code: '9110', name: 'Servicios personales' },
        { code: '9111', name: 'Servicios domésticos' },
    ]},
    { code: '92', name: 'Servicios de Defensa Nacional y Orden Público', families: [
        { code: '9210', name: 'Servicios de seguridad militar' },
    ]},
    { code: '93', name: 'Servicios Políticos y de Asuntos Cívicos', families: [
        { code: '9310', name: 'Administración pública' },
    ]},
    { code: '94', name: 'Organizaciones y Clubes', families: [
        { code: '9410', name: 'Organizaciones cívicas' },
    ]},
    { code: '95', name: 'Terrenos, Edificios y Estructuras', families: [
        { code: '9510', name: 'Terrenos' },
        { code: '9511', name: 'Propiedades y edificios' },
    ]},
];

// Build a flat lookup map for resolving selected value labels
const FAMILY_LOOKUP = new Map<string, { familyName: string; segmentName: string }>();
for (const seg of CPBS_CATALOG) {
    for (const fam of seg.families) {
        FAMILY_LOOKUP.set(fam.code, { familyName: fam.name, segmentName: seg.name });
    }
}

// Popular / most-used CPBS categories shown first when no search active
const POPULAR_CODES = [
    '8010', // Consultoría de negocios
    '8012', // Servicios legales
    '8013', // Servicios inmobiliarios
    '8113', // Servicios contables
    '7010', // Consultoría profesional
    '7011', // Servicios de TI
    '4411', // Suministros de oficina
    '4310', // Computadoras y dispositivos
    '7210', // Servicios de construcción
    '7610', // Servicios de limpieza
    '9010', // Restaurantes y catering
    '8014', // Mercadeo y publicidad
    '8011', // Recursos humanos
    '4312', // Software
    '7810', // Transporte de pasajeros
];

// Synonym map: common search terms → CPBS family terms they should match
const SYNONYMS: Record<string, string[]> = {
    'alquiler': ['inmobiliarios', 'inmobiliario', 'terrenos', 'propiedades', 'edificios'],
    'renta': ['inmobiliarios', 'inmobiliario', 'terrenos', 'propiedades'],
    'arriendo': ['inmobiliarios', 'inmobiliario'],
    'abogado': ['legales', 'legal'],
    'abogados': ['legales', 'legal'],
    'ley': ['legales', 'legal'],
    'contador': ['contables', 'contabilidad', 'financieros'],
    'contabilidad': ['contables', 'financieros'],
    'impuestos': ['contables', 'financieros'],
    'pc': ['computadoras', 'dispositivos', 'informáticos'],
    'computadora': ['computadoras', 'dispositivos', 'informáticos'],
    'laptop': ['computadoras', 'dispositivos', 'informáticos'],
    'tecnologia': ['tecnología', 'informáticos', 'software', 'computadoras'],
    'internet': ['telecomunicaciones', 'telecomunicación', 'redes'],
    'telefono': ['telecomunicaciones', 'telecomunicación'],
    'celular': ['telecomunicaciones', 'telecomunicación'],
    'comida': ['restaurantes', 'catering', 'alimentos', 'cárnicos'],
    'restaurante': ['restaurantes', 'catering'],
    'hotel': ['alojamiento', 'hospedaje'],
    'hospedaje': ['alojamiento', 'viaje'],
    'viaje': ['viaje', 'transporte', 'pasajeros'],
    'transporte': ['transporte', 'pasajeros', 'carga'],
    'envio': ['correo', 'mensajería', 'carga'],
    'mensajeria': ['correo', 'mensajería'],
    'publicidad': ['publicidad', 'mercadeo'],
    'marketing': ['mercadeo', 'publicidad'],
    'propaganda': ['mercadeo', 'publicidad'],
    'aseo': ['limpieza', 'residuos'],
    'limpieza': ['limpieza', 'residuos'],
    'seguridad': ['seguridad', 'vigilancia', 'defensa'],
    'guardia': ['seguridad', 'vigilancia'],
    'medicina': ['médicos', 'salud', 'hospital', 'farmacéuticos'],
    'medico': ['médicos', 'salud', 'hospital'],
    'doctor': ['médicos', 'salud', 'hospital'],
    'farmacia': ['farmacéuticos', 'farmacéuticas', 'medicamentos'],
    'medicinas': ['farmacéuticos', 'medicamentos'],
    'construccion': ['construcción', 'edificios', 'concreto', 'cemento'],
    'obra': ['construcción', 'edificios', 'materiales'],
    'pintura': ['pintura', 'pinturas', 'revestimiento', 'colorantes'],
    'electricidad': ['eléctricos', 'electricidad', 'energía'],
    'plomero': ['plomería', 'plomería'],
    'plomeria': ['plomería'],
    'muebles': ['muebles', 'mobiliario'],
    'oficina': ['oficina', 'suministros de oficina'],
    'papeleria': ['papel', 'suministros de oficina', 'impresión'],
    'educacion': ['educativos', 'formación'],
    'capacitacion': ['formación', 'educativos'],
    'entrenamiento': ['formación', 'educativos'],
    'agua': ['agua', 'plomería'],
    'luz': ['electricidad', 'eléctricos', 'energía'],
    'gas': ['gas', 'combustibles', 'gaseosos'],
    'gasolina': ['combustibles', 'combustible'],
    'carro': ['vehículos', 'motor', 'automotrices'],
    'auto': ['vehículos', 'motor', 'automotrices'],
    'vehiculo': ['vehículos', 'motor'],
    'ropa': ['ropa', 'tela', 'confección'],
    'uniforme': ['ropa', 'tela', 'confección'],
    'zapatos': ['calzado'],
    'software': ['software'],
    'programa': ['software'],
    'app': ['software', 'tecnología'],
    'consultoria': ['consultoría', 'consultoría'],
    'asesoria': ['consultoría', 'profesional'],
};

// Expand query words with synonyms
function expandWithSynonyms(word: string): string[] {
    const lower = word.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
    const expanded = [word];
    for (const [key, values] of Object.entries(SYNONYMS)) {
        if (key === lower || lower.includes(key) || key.includes(lower)) {
            expanded.push(...values);
        }
    }
    return expanded;
}

// Multi-word fuzzy match with synonym expansion
function fuzzyMatch(query: string, ...texts: string[]): boolean {
    const combined = texts.join(' ').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return words.every(word => {
        const candidates = expandWithSynonyms(word);
        return candidates.some(candidate => {
            const normalized = candidate.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return combined.includes(normalized);
        });
    });
}

// ─── Component ───────────────────────────────────────────────────────

interface CPBSSelectorProps {
    value: string;
    onSelect: (cpbsCode: string, segmentName: string, familyName: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function CPBSSelector({
    value,
    onSelect,
    placeholder = 'Seleccionar categoría CPBS...',
    disabled = false,
    className,
}: CPBSSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Resolve label for selected value
    const selectedLabel = useMemo(() => {
        if (!value) return '';
        const info = FAMILY_LOOKUP.get(value);
        return info ? `${value} — ${info.familyName}` : value;
    }, [value]);

    // Popular categories as a flat list (shown when no search)
    const popularFamilies = useMemo(() => {
        const items: { family: CPBSFamily; segmentName: string }[] = [];
        for (const code of POPULAR_CODES) {
            const info = FAMILY_LOOKUP.get(code);
            if (info) {
                items.push({
                    family: { code, name: info.familyName },
                    segmentName: info.segmentName,
                });
            }
        }
        return items;
    }, []);

    // Filter catalog locally by search term (multi-word fuzzy)
    const filteredSegments = useMemo(() => {
        if (!search.trim()) return CPBS_CATALOG;

        const q = search.trim();
        const results: CPBSSegment[] = [];

        for (const seg of CPBS_CATALOG) {
            const matchedFamilies = seg.families.filter(fam =>
                fuzzyMatch(q, fam.code, fam.name, seg.code, seg.name)
            );

            if (matchedFamilies.length > 0) {
                results.push({ ...seg, families: matchedFamilies });
            }
        }

        return results;
    }, [search]);

    const totalFamilies = useMemo(() =>
        filteredSegments.reduce((sum, seg) => sum + seg.families.length, 0),
    [filteredSegments]);

    const isSearching = !!search.trim();

    const handleSelect = (family: CPBSFamily, segmentName: string) => {
        onSelect(family.code, segmentName, family.name);
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        'w-full justify-between font-normal text-left h-auto min-h-[36px] py-1.5',
                        !value && 'text-muted-foreground',
                        className
                    )}
                >
                    <span className="truncate text-xs">
                        {value ? selectedLabel : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start" side="bottom" sideOffset={4}>
                {/* Search input */}
                <div className="flex items-center border-b px-3 py-2">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Buscar... ej: &quot;servicios legal&quot; o &quot;computadoras&quot;"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="ml-1 text-muted-foreground hover:text-foreground text-xs whitespace-nowrap"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Results */}
                <ScrollArea className="max-h-[400px]">
                    {isSearching && totalFamilies === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No se encontraron categorías para &quot;{search}&quot;
                        </div>
                    ) : (
                        <div className="py-1">
                            {/* Popular categories first (only when not searching) */}
                            {!isSearching && (
                                <>
                                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-3 py-1.5">
                                        <span className="text-[11px] font-medium text-muted-foreground">
                                            Categorías frecuentes
                                        </span>
                                    </div>
                                    {popularFamilies.map(({ family: fam, segmentName }) => {
                                        const isSelected = value === fam.code;
                                        return (
                                            <button
                                                key={`pop-${fam.code}`}
                                                onClick={() => handleSelect(fam, segmentName)}
                                                className={cn(
                                                    'w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer',
                                                    isSelected && 'bg-accent'
                                                )}
                                            >
                                                <Check
                                                    className={cn(
                                                        'h-3.5 w-3.5 shrink-0',
                                                        isSelected ? 'opacity-100 text-primary' : 'opacity-0'
                                                    )}
                                                />
                                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                    {fam.code}
                                                </span>
                                                <span className="text-xs truncate">
                                                    {fam.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    <div className="border-t my-1" />
                                    <div className="px-3 py-1.5">
                                        <span className="text-[11px] text-muted-foreground">
                                            Todas las categorías
                                        </span>
                                    </div>
                                </>
                            )}
                            {/* All categories (always shown, filtered when searching) */}
                            {filteredSegments.map(seg => (
                                <div key={seg.code}>
                                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5">
                                        <span className="font-mono text-[10px] text-muted-foreground bg-background border rounded px-1 py-0.5">
                                            {seg.code}
                                        </span>
                                        <span className="text-[11px] font-medium text-muted-foreground truncate">
                                            {seg.name}
                                        </span>
                                    </div>
                                    {seg.families.map(fam => {
                                        const isSelected = value === fam.code;
                                        return (
                                            <button
                                                key={fam.code}
                                                onClick={() => handleSelect(fam, seg.name)}
                                                className={cn(
                                                    'w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer',
                                                    isSelected && 'bg-accent'
                                                )}
                                            >
                                                <Check
                                                    className={cn(
                                                        'h-3.5 w-3.5 shrink-0',
                                                        isSelected ? 'opacity-100 text-primary' : 'opacity-0'
                                                    )}
                                                />
                                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                    {fam.code}
                                                </span>
                                                <span className="text-xs truncate">
                                                    {fam.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
