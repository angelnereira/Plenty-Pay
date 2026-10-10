/**
 * Códigos de Ubicación de Panamá (Provincia-Distrito-Corregimiento)
 * Basado en la estructura oficial de la DGI
 */

export interface Corregimiento {
  code: string;
  name: string;
}

export interface Distrito {
  code: string;
  name: string;
  corregimientos: Corregimiento[];
}

export interface Provincia {
  code: string;
  name: string;
  distritos: Distrito[];
}

export const PANAMA_LOCATIONS: Provincia[] = [
  {
    code: '1',
    name: 'Bocas del Toro',
    distritos: [
      {
        code: '1',
        name: 'Bocas del Toro',
        corregimientos: [
          { code: '1', name: 'Bocas del Toro (Cabecera)' },
          { code: '2', name: 'Bastimentos' },
          { code: '3', name: 'Cauchero' },
          { code: '4', name: 'Punta Laurel' },
          { code: '5', name: 'Tierra Oscura' },
        ],
      },
      {
        code: '2',
        name: 'Changuinola',
        corregimientos: [
          { code: '1', name: 'Changuinola (Cabecera)' },
          { code: '2', name: 'Almirante' },
          { code: '3', name: 'Guabito' },
          { code: '4', name: 'Teribe' },
          { code: '5', name: 'Valle del Risco' },
          { code: '6', name: 'El Empalme' },
          { code: '7', name: 'Las Tablas' },
        ],
      },
      {
        code: '3',
        name: 'Chiriquí Grande',
        corregimientos: [
          { code: '1', name: 'Chiriquí Grande (Cabecera)' },
          { code: '2', name: 'Miramar' },
          { code: '3', name: 'Punta Peña' },
          { code: '4', name: 'Punta Robalo' },
          { code: '5', name: 'Rambala' },
        ],
      },
    ],
  },
  {
    code: '2',
    name: 'Coclé',
    distritos: [
      {
        code: '1',
        name: 'Aguadulce',
        corregimientos: [
          { code: '1', name: 'Aguadulce (Cabecera)' },
          { code: '2', name: 'El Cristo' },
          { code: '3', name: 'El Roble' },
          { code: '4', name: 'Pocrí' },
          { code: '5', name: 'Barrios Unidos' },
        ],
      },
      {
        code: '2',
        name: 'Antón',
        corregimientos: [
          { code: '1', name: 'Antón (Cabecera)' },
          { code: '2', name: 'Cabuya' },
          { code: '3', name: 'El Chirú' },
          { code: '4', name: 'El Retiro' },
          { code: '5', name: 'El Valle' },
          { code: '6', name: 'Juan Díaz' },
          { code: '7', name: 'Río Hato' },
          { code: '8', name: 'San Juan de Dios' },
          { code: '9', name: 'Santa Rita' },
          { code: '10', name: 'Caballero' },
        ],
      },
      {
        code: '3',
        name: 'La Pintada',
        corregimientos: [
          { code: '1', name: 'La Pintada (Cabecera)' },
          { code: '2', name: 'El Harino' },
          { code: '3', name: 'El Potrero' },
          { code: '4', name: 'Llano Grande' },
          { code: '5', name: 'Piedras Gordas' },
          { code: '6', name: 'Las Lomas' },
        ],
      },
      {
        code: '4',
        name: 'Natá',
        corregimientos: [
          { code: '1', name: 'Natá (Cabecera)' },
          { code: '2', name: 'Capellanía' },
          { code: '3', name: 'El Caño' },
          { code: '4', name: 'Guzmán' },
          { code: '5', name: 'Las Huacas' },
          { code: '6', name: 'Toza' },
        ],
      },
      {
        code: '5',
        name: 'Olá',
        corregimientos: [
          { code: '1', name: 'Olá (Cabecera)' },
          { code: '2', name: 'El Copé' },
          { code: '3', name: 'El Palmar' },
          { code: '4', name: 'El Picacho' },
          { code: '5', name: 'La Pava' },
        ],
      },
      {
        code: '6',
        name: 'Penonomé',
        corregimientos: [
          { code: '1', name: 'Penonomé (Cabecera)' },
          { code: '2', name: 'Cañaveral' },
          { code: '3', name: 'Coclé' },
          { code: '4', name: 'Chiguirí Arriba' },
          { code: '5', name: 'El Coco' },
          { code: '6', name: 'Pajonal' },
          { code: '7', name: 'Río Grande' },
          { code: '8', name: 'Río Indio' },
          { code: '9', name: 'Toabré' },
          { code: '10', name: 'Tulú' },
        ],
      },
    ],
  },
  {
    code: '3',
    name: 'Colón',
    distritos: [
      {
        code: '1',
        name: 'Colón',
        corregimientos: [
          { code: '1', name: 'Barrio Norte' },
          { code: '2', name: 'Barrio Sur' },
          { code: '3', name: 'Buena Vista' },
          { code: '4', name: 'Cativá' },
          { code: '5', name: 'Ciricito' },
          { code: '6', name: 'Cristóbal' },
          { code: '7', name: 'Escobal' },
          { code: '8', name: 'Limón' },
          { code: '9', name: 'Nueva Providencia' },
          { code: '10', name: 'Puerto Pilón' },
          { code: '11', name: 'Sabanitas' },
          { code: '12', name: 'Salamanca' },
          { code: '13', name: 'San Juan' },
          { code: '14', name: 'Santa Rosa' },
        ],
      },
      {
        code: '2',
        name: 'Chagres',
        corregimientos: [
          { code: '1', name: 'Nuevo Chagres (Cabecera)' },
          { code: '2', name: 'Achiote' },
          { code: '3', name: 'El Guabo' },
          { code: '4', name: 'La Encantada' },
          { code: '5', name: 'Palmas Bellas' },
          { code: '6', name: 'Piña' },
          { code: '7', name: 'Salud' },
        ],
      },
      {
        code: '3',
        name: 'Donoso',
        corregimientos: [
          { code: '1', name: 'Miguel de la Borda (Cabecera)' },
          { code: '2', name: 'Coclé del Norte' },
          { code: '3', name: 'El Guásimo' },
          { code: '4', name: 'Gobea' },
          { code: '5', name: 'Río Indio' },
          { code: '6', name: 'San José del General' },
        ],
      },
      {
        code: '4',
        name: 'Portobelo',
        corregimientos: [
          { code: '1', name: 'Portobelo (Cabecera)' },
          { code: '2', name: 'Cacique' },
          { code: '3', name: 'Garrote' },
          { code: '4', name: 'Isla Grande' },
          { code: '5', name: 'María Chiquita' },
        ],
      },
      {
        code: '5',
        name: 'Santa Isabel',
        corregimientos: [
          { code: '1', name: 'Palenque (Cabecera)' },
          { code: '2', name: 'Cuango' },
          { code: '3', name: 'Miramar' },
          { code: '4', name: 'Nombre de Dios' },
          { code: '5', name: 'Palmira' },
          { code: '6', name: 'Playa Chiquita' },
          { code: '7', name: 'Santa Isabel' },
          { code: '8', name: 'Viento Frío' },
        ],
      },
    ],
  },
  {
    code: '4',
    name: 'Chiriquí',
    distritos: [
      {
        code: '1',
        name: 'Alanje',
        corregimientos: [
          { code: '1', name: 'Alanje (Cabecera)' },
          { code: '2', name: 'Divalá' },
          { code: '3', name: 'El Tejar' },
          { code: '4', name: 'Guarumal' },
          { code: '5', name: 'Palo Grande' },
          { code: '6', name: 'Querévalo' },
          { code: '7', name: 'Santo Tomás' },
          { code: '8', name: 'Canta Gallo' },
          { code: '9', name: 'Nuevo México' },
        ],
      },
      {
        code: '2',
        name: 'Barú',
        corregimientos: [
          { code: '1', name: 'Puerto Armuelles (Cabecera)' },
          { code: '2', name: 'Limones' },
          { code: '3', name: 'Progreso' },
          { code: '4', name: 'Baco' },
          { code: '5', name: 'Rodolfo Aguilar Delgado' },
        ],
      },
      {
        code: '3',
        name: 'Boquerón',
        corregimientos: [
          { code: '1', name: 'Boquerón (Cabecera)' },
          { code: '2', name: 'Bagalá' },
          { code: '3', name: 'Cordillera' },
          { code: '4', name: 'Guabal' },
          { code: '5', name: 'Guayabal' },
          { code: '6', name: 'Paraíso' },
          { code: '7', name: 'Pedregal' },
          { code: '8', name: 'Tijeras' },
        ],
      },
      {
        code: '4',
        name: 'Boquete',
        corregimientos: [
          { code: '1', name: 'Bajo Boquete (Cabecera)' },
          { code: '2', name: 'Caldera' },
          { code: '3', name: 'Palmira' },
          { code: '4', name: 'Alto Boquete' },
          { code: '5', name: 'Jaramillo' },
          { code: '6', name: 'Los Naranjos' },
        ],
      },
      {
        code: '5',
        name: 'Bugaba',
        corregimientos: [
          { code: '1', name: 'La Concepción (Cabecera)' },
          { code: '2', name: 'Aserrío de Gariché' },
          { code: '3', name: 'Bugaba' },
          { code: '4', name: 'Cerro Punta' },
          { code: '5', name: 'Gómez' },
          { code: '6', name: 'La Estrella' },
          { code: '7', name: 'San Andrés' },
          { code: '8', name: 'Santa Marta' },
          { code: '9', name: 'Santa Rosa' },
          { code: '10', name: 'Santo Domingo' },
          { code: '11', name: 'Sortová' },
          { code: '12', name: 'Volcán' },
          { code: '13', name: 'El Bongo' },
        ],
      },
      {
        code: '6',
        name: 'David',
        corregimientos: [
          { code: '1', name: 'David (Cabecera)' },
          { code: '2', name: 'Bijagual' },
          { code: '3', name: 'Cochea' },
          { code: '4', name: 'Chiriquí' },
          { code: '5', name: 'Guacá' },
          { code: '6', name: 'Las Lomas' },
          { code: '7', name: 'Pedregal' },
          { code: '8', name: 'San Carlos' },
          { code: '9', name: 'San Pablo Nuevo' },
          { code: '10', name: 'San Pablo Viejo' },
        ],
      },
      {
        code: '7',
        name: 'Dolega',
        corregimientos: [
          { code: '1', name: 'Dolega (Cabecera)' },
          { code: '2', name: 'Dos Ríos' },
          { code: '3', name: 'Los Anastacios' },
          { code: '4', name: 'Potrerillos' },
          { code: '5', name: 'Potrerillos Abajo' },
          { code: '6', name: 'Rovira' },
          { code: '7', name: 'Tinajas' },
          { code: '8', name: 'Los Algarrobos' },
        ],
      },
      {
        code: '8',
        name: 'Gualaca',
        corregimientos: [
          { code: '1', name: 'Gualaca (Cabecera)' },
          { code: '2', name: 'Hornito' },
          { code: '3', name: 'Los Ángeles' },
          { code: '4', name: 'Paja de Sombrero' },
          { code: '5', name: 'Rincón' },
        ],
      },
      {
        code: '9',
        name: 'Remedios',
        corregimientos: [
          { code: '1', name: 'Remedios (Cabecera)' },
          { code: '2', name: 'El Nancito' },
          { code: '3', name: 'El Porvenir' },
          { code: '4', name: 'El Puerto' },
          { code: '5', name: 'Santa Lucía' },
        ],
      },
      {
        code: '10',
        name: 'Renacimiento',
        corregimientos: [
          { code: '1', name: 'Río Sereno (Cabecera)' },
          { code: '2', name: 'Breñón' },
          { code: '3', name: 'Cañas Gordas' },
          { code: '4', name: 'Monte Lirio' },
          { code: '5', name: 'Plaza Caisán' },
          { code: '6', name: 'Santa Cruz' },
          { code: '7', name: 'Dominical' },
          { code: '8', name: 'Santa Clara' },
        ],
      },
      {
        code: '11',
        name: 'San Félix',
        corregimientos: [
          { code: '1', name: 'Las Lajas (Cabecera)' },
          { code: '2', name: 'Juay' },
          { code: '3', name: 'Lajas Adentro' },
          { code: '4', name: 'San Félix' },
          { code: '5', name: 'Santa Cruz' },
        ],
      },
      {
        code: '12',
        name: 'San Lorenzo',
        corregimientos: [
          { code: '1', name: 'Horconcitos (Cabecera)' },
          { code: '2', name: 'Boca Chica' },
          { code: '3', name: 'Boca del Monte' },
          { code: '4', name: 'San Juan' },
          { code: '5', name: 'San Lorenzo' },
        ],
      },
      {
        code: '13',
        name: 'Tolé',
        corregimientos: [
          { code: '1', name: 'Tolé (Cabecera)' },
          { code: '2', name: 'Bella Vista' },
          { code: '3', name: 'Cerro Viejo' },
          { code: '4', name: 'El Cristo' },
          { code: '5', name: 'Justo Fidel Palacios' },
          { code: '6', name: 'Lajas de Tolé' },
          { code: '7', name: 'Potrero de Caña' },
          { code: '8', name: 'Quebrada de Piedra' },
          { code: '9', name: 'Veladero' },
        ],
      },
    ],
  },
  {
    code: '8',
    name: 'Panamá',
    distritos: [
      {
        code: '8',
        name: 'Panamá',
        corregimientos: [
          { code: '1', name: 'San Felipe' },
          { code: '2', name: 'El Chorrillo' },
          { code: '3', name: 'Santa Ana' },
          { code: '4', name: 'La Exposición o Calidonia' },
          { code: '5', name: 'Curundú' },
          { code: '6', name: 'Betania' },
          { code: '7', name: 'Bella Vista' },
          { code: '8', name: 'Pueblo Nuevo' },
          { code: '9', name: 'San Francisco' },
          { code: '10', name: 'Parque Lefevre' },
          { code: '11', name: 'Río Abajo' },
          { code: '12', name: 'Juan Díaz' },
          { code: '13', name: 'Pedregal' },
          { code: '14', name: 'Ancón' },
          { code: '15', name: 'Chilibre' },
          { code: '16', name: 'Las Cumbres' },
          { code: '17', name: 'Pacora' },
          { code: '18', name: 'San Martín' },
          { code: '19', name: 'Tocumen' },
          { code: '20', name: 'Las Mañanitas' },
          { code: '21', name: '24 de Diciembre' },
          { code: '22', name: 'Ernesto Córdoba Campos' },
          { code: '23', name: 'Alcalde Díaz' },
          { code: '24', name: 'Caimitillo' },
          { code: '25', name: 'Don Bosco' },
          { code: '26', name: 'Las Garzas' },
        ],
      },
      {
        code: '10',
        name: 'San Miguelito',
        corregimientos: [
          { code: '1', name: 'Amelia Denis de Icaza' },
          { code: '2', name: 'Belisario Porras' },
          { code: '3', name: 'José Domingo Espinar' },
          { code: '4', name: 'Mateo Iturralde' },
          { code: '5', name: 'Victoriano Lorenzo' },
          { code: '6', name: 'Arnulfo Arias' },
          { code: '7', name: 'Belisario Frías' },
          { code: '8', name: 'Omar Torrijos' },
          { code: '9', name: 'Rufina Alfaro' },
        ],
      },
    ],
  },
  {
    code: '5',
    name: 'Darién',
    distritos: [
      {
        code: '1',
        name: 'Chepigana',
        corregimientos: [
          { code: '1', name: 'La Palma (Cabecera)' },
          { code: '2', name: 'Camoganti' },
          { code: '3', name: 'Chepigana' },
          { code: '4', name: 'Garachiné' },
          { code: '5', name: 'Jaqué' },
          { code: '6', name: 'Puerto Piña' },
          { code: '7', name: 'Río Congo' },
          { code: '8', name: 'Río Iglesias' },
          { code: '9', name: 'Sambú' },
          { code: '10', name: 'Setegantí' },
          { code: '11', name: 'Taimatí' },
          { code: '12', name: 'Tucutí' },
          { code: '13', name: 'Agua Fría' },
          { code: '14', name: 'Cucunatí' },
          { code: '15', name: 'Río Congo Arriba' },
          { code: '16', name: 'Santa Fe' },
        ],
      },
      {
        code: '2',
        name: 'Pinogana',
        corregimientos: [
          { code: '1', name: 'El Real de Santa María (Cabecera)' },
          { code: '2', name: 'Boca de Cupe' },
          { code: '3', name: 'Paya' },
          { code: '4', name: 'Pinogana' },
          { code: '5', name: 'Pucuro' },
          { code: '6', name: 'Yape' },
          { code: '7', name: 'Yaviza' },
          { code: '8', name: 'Metetí' },
          { code: '9', name: 'Comarca Kuna de Wargandí' },
        ],
      },
    ],
  },
  {
    code: '6',
    name: 'Herrera',
    distritos: [
      {
        code: '1',
        name: 'Chitré',
        corregimientos: [
          { code: '1', name: 'Chitré (Cabecera)' },
          { code: '2', name: 'La Arena' },
          { code: '3', name: 'Monagrillo' },
          { code: '4', name: 'Llano Bonito' },
          { code: '5', name: 'San Juan Bautista' },
        ],
      },
      {
        code: '2',
        name: 'Las Minas',
        corregimientos: [
          { code: '1', name: 'Las Minas (Cabecera)' },
          { code: '2', name: 'Chepo' },
          { code: '3', name: 'Chumical' },
          { code: '4', name: 'El Toro' },
          { code: '5', name: 'Leones' },
          { code: '6', name: 'Quebrada del Rosario' },
          { code: '7', name: 'Quebrada El Ciprián' },
        ],
      },
      {
        code: '3',
        name: 'Los Pozos',
        corregimientos: [
          { code: '1', name: 'Los Pozos (Cabecera)' },
          { code: '2', name: 'Capurí' },
          { code: '3', name: 'El Calabacito' },
          { code: '4', name: 'El Cedro' },
          { code: '5', name: 'La Arena' },
          { code: '6', name: 'La Pitalosa' },
          { code: '7', name: 'Los Cerritos' },
          { code: '8', name: 'Los Cerros de Paja' },
          { code: '9', name: 'Las Llanas' },
        ],
      },
      {
        code: '4',
        name: 'Ocú',
        corregimientos: [
          { code: '1', name: 'Ocú (Cabecera)' },
          { code: '2', name: 'Cerro Largo' },
          { code: '3', name: 'Los Llanos' },
          { code: '4', name: 'Llano Grande' },
          { code: '5', name: 'Peñas Chatas' },
          { code: '6', name: 'El Tijera' },
          { code: '7', name: 'Menchaca' },
        ],
      },
      {
        code: '5',
        name: 'Parita',
        corregimientos: [
          { code: '1', name: 'Parita (Cabecera)' },
          { code: '2', name: 'Cabuya' },
          { code: '3', name: 'Los Castillos' },
          { code: '4', name: 'Llano de la Cruz' },
          { code: '5', name: 'París' },
          { code: '6', name: 'Portobelillo' },
          { code: '7', name: 'Potuga' },
        ],
      },
      {
        code: '6',
        name: 'Pesé',
        corregimientos: [
          { code: '1', name: 'Pesé (Cabecera)' },
          { code: '2', name: 'Las Cabras' },
          { code: '3', name: 'El Pájaro' },
          { code: '4', name: 'El Barrero' },
          { code: '5', name: 'El Pedregoso' },
          { code: '6', name: 'El Ciruelo' },
          { code: '7', name: 'Sabanagrande' },
          { code: '8', name: 'Rincón Hondo' },
        ],
      },
      {
        code: '7',
        name: 'Santa María',
        corregimientos: [
          { code: '1', name: 'Santa María (Cabecera)' },
          { code: '2', name: 'Chupampa' },
          { code: '3', name: 'El Rincón' },
          { code: '4', name: 'El Limón' },
          { code: '5', name: 'Los Canelos' },
        ],
      },
    ],
  },
  {
    code: '7',
    name: 'Los Santos',
    distritos: [
      {
        code: '1',
        name: 'Guararé',
        corregimientos: [
          { code: '1', name: 'Guararé (Cabecera)' },
          { code: '2', name: 'El Espinal' },
          { code: '3', name: 'El Macano' },
          { code: '4', name: 'Guararé Arriba' },
          { code: '5', name: 'La Enea' },
          { code: '6', name: 'La Pasera' },
          { code: '7', name: 'Las Trancas' },
          { code: '8', name: 'Llano Abajo' },
          { code: '9', name: 'El Hato' },
          { code: '10', name: 'Perales' },
        ],
      },
      {
        code: '2',
        name: 'Las Tablas',
        corregimientos: [
          { code: '1', name: 'Las Tablas (Cabecera)' },
          { code: '2', name: 'Bajo Corral' },
          { code: '3', name: 'Bayano' },
          { code: '4', name: 'El Carate' },
          { code: '5', name: 'El Cocal' },
          { code: '6', name: 'El Manantial' },
          { code: '7', name: 'El Muñoz' },
          { code: '8', name: 'El Pedregoso' },
          { code: '9', name: 'La Laja' },
          { code: '10', name: 'La Miel' },
          { code: '11', name: 'La Palma' },
          { code: '12', name: 'La Tiza' },
          { code: '13', name: 'Las Palmitas' },
          { code: '14', name: 'Las Tablas Abajo' },
          { code: '15', name: 'Nuario' },
          { code: '16', name: 'Palmira' },
          { code: '17', name: 'Peña Blanca' },
          { code: '18', name: 'Río Hondo' },
          { code: '19', name: 'San José' },
          { code: '20', name: 'San Miguel' },
          { code: '21', name: 'Santo Domingo' },
          { code: '22', name: 'Sesteadero' },
          { code: '23', name: 'Valle Rico' },
          { code: '24', name: 'Valleriquito' },
        ],
      },
      {
        code: '3',
        name: 'Los Santos',
        corregimientos: [
          { code: '1', name: 'La Villa de Los Santos (Cabecera)' },
          { code: '2', name: 'El Guásimo' },
          { code: '3', name: 'La Colorada' },
          { code: '4', name: 'La Espigadilla' },
          { code: '5', name: 'Las Cruces' },
          { code: '6', name: 'Las Guabas' },
          { code: '7', name: 'Los Ángeles' },
          { code: '8', name: 'Los Olivos' },
          { code: '9', name: 'Llano Largo' },
          { code: '10', name: 'Sabanagrande' },
          { code: '11', name: 'Santa Ana' },
          { code: '12', name: 'Tres Quebradas' },
          { code: '13', name: 'Agua Buena' },
          { code: '14', name: 'Villa Lourdes' },
        ],
      },
      {
        code: '4',
        name: 'Macaracas',
        corregimientos: [
          { code: '1', name: 'Macaracas (Cabecera)' },
          { code: '2', name: 'Bahía Honda' },
          { code: '3', name: 'Bajos de Güera' },
          { code: '4', name: 'Corozal' },
          { code: '5', name: 'Chupa' },
          { code: '6', name: 'El Cedro' },
          { code: '7', name: 'Espino Amarillo' },
          { code: '8', name: 'La Mesa' },
          { code: '9', name: 'Las Palmas' },
          { code: '10', name: 'Llano de Piedra' },
          { code: '11', name: 'Mogollón' },
        ],
      },
      {
        code: '5',
        name: 'Pedasí',
        corregimientos: [
          { code: '1', name: 'Pedasí (Cabecera)' },
          { code: '2', name: 'Los Asientos' },
          { code: '3', name: 'Mariabé' },
          { code: '4', name: 'Purio' },
          { code: '5', name: 'Oria Arriba' },
        ],
      },
      {
        code: '6',
        name: 'Pocrí',
        corregimientos: [
          { code: '1', name: 'Pocrí' },
          { code: '2', name: 'El Cañafístulo' },
          { code: '3', name: 'Lajamina' },
          { code: '4', name: 'Paraíso' },
          { code: '5', name: 'Paritilla' },
        ],
      },
      {
        code: '7',
        name: 'Tonosí',
        corregimientos: [
          { code: '1', name: 'Tonosí (Cabecera)' },
          { code: '2', name: 'Altos de Güera' },
          { code: '3', name: 'Cañas' },
          { code: '4', name: 'El Bebedero' },
          { code: '5', name: 'El Cacao' },
          { code: '6', name: 'El Cortezo' },
          { code: '7', name: 'Flores' },
          { code: '8', name: 'Guánico' },
          { code: '9', name: 'La Tronosa' },
          { code: '10', name: 'Cambutal' },
          { code: '11', name: 'Isla de Cañas' },
        ],
      },
    ],
  },
  {
    code: '9',
    name: 'Veraguas',
    distritos: [
      {
        code: '10',
        name: 'Santiago',
        corregimientos: [
          { code: '1', name: 'Santiago (Cabecera)' },
          { code: '2', name: 'La Colorada' },
          { code: '3', name: 'La Peña' },
          { code: '4', name: 'La Raya de Santa María' },
          { code: '5', name: 'Ponuga' },
          { code: '6', name: 'San Pedro del Espino' },
          { code: '7', name: 'Canto del Llano' },
          { code: '8', name: 'Los Algarrobos' },
          { code: '9', name: 'Carlos Santana Ávila' },
          { code: '10', name: 'Edwin Fábrega' },
          { code: '11', name: 'San Martín de Porres' },
          { code: '12', name: 'Urracá' },
        ],
      },
    ],
  },
  {
    code: '13',
    name: 'Panamá Oeste',
    distritos: [
      {
        code: '1',
        name: 'Arraiján',
        corregimientos: [
          { code: '1', name: 'Arraiján (Cabecera)' },
          { code: '2', name: 'Burunga' },
          { code: '3', name: 'Cerro Silvestre' },
          { code: '4', name: 'Juan Demóstenes Arosemena' },
          { code: '5', name: 'Nuevo Emperador' },
          { code: '6', name: 'Santa Clara' },
          { code: '7', name: 'Veracruz' },
          { code: '8', name: 'Vista Alegre' },
        ],
      },
      {
        code: '2',
        name: 'Capira',
        corregimientos: [
          { code: '1', name: 'Capira (Cabecera)' },
          { code: '2', name: 'Caimito' },
          { code: '3', name: 'Campana' },
          { code: '4', name: 'Cermeño' },
          { code: '5', name: 'Cirí de Los Sotos' },
          { code: '6', name: 'Cirí Grande' },
          { code: '7', name: 'El Cacao' },
          { code: '8', name: 'La Trinidad' },
          { code: '9', name: 'Las Ollas Arriba' },
          { code: '10', name: 'Lídice' },
          { code: '11', name: 'Villa Carmen' },
          { code: '12', name: 'Villa Rosario' },
          { code: '13', name: 'Santa Rosa' },
        ],
      },
      {
        code: '3',
        name: 'Chame',
        corregimientos: [
          { code: '1', name: 'Chame (Cabecera)' },
          { code: '2', name: 'Bejuco' },
          { code: '3', name: 'Buenos Aires' },
          { code: '4', name: 'Cabuya' },
          { code: '5', name: 'Chicá' },
          { code: '6', name: 'El Líbano' },
          { code: '7', name: 'Las Lajas' },
          { code: '8', name: 'Nueva Gorgona' },
          { code: '9', name: 'Punta Chame' },
          { code: '10', name: 'Sajalices' },
          { code: '11', name: 'Sorá' },
        ],
      },
      {
        code: '4',
        name: 'La Chorrera',
        corregimientos: [
          { code: '1', name: 'Barrio Balboa' },
          { code: '2', name: 'Barrio Colón' },
          { code: '3', name: 'Amador' },
          { code: '4', name: 'Arosemena' },
          { code: '5', name: 'El Arado' },
          { code: '6', name: 'El Coco' },
          { code: '7', name: 'Feuillet' },
          { code: '8', name: 'Guadalupe' },
          { code: '9', name: 'Herrera' },
          { code: '10', name: 'Hurtado' },
          { code: '11', name: 'Iturralde' },
          { code: '12', name: 'La Represa' },
          { code: '13', name: 'Los Díaz' },
          { code: '14', name: 'Mendoza' },
          { code: '15', name: 'Obaldía' },
          { code: '16', name: 'Playa Leona' },
          { code: '17', name: 'Puerto Caimito' },
          { code: '18', name: 'Santa Rita' },
        ],
      },
      {
        code: '5',
        name: 'San Carlos',
        corregimientos: [
          { code: '1', name: 'San Carlos (Cabecera)' },
          { code: '2', name: 'El Espino' },
          { code: '3', name: 'El Higo' },
          { code: '4', name: 'Guayabito' },
          { code: '5', name: 'La Ermita' },
          { code: '6', name: 'La Laguna' },
          { code: '7', name: 'Las Uvas' },
          { code: '8', name: 'Los Llanitos' },
          { code: '9', name: 'San José' },
        ],
      },
    ],
  },
];

/**
 * Obtiene el nombre completo de una ubicación dado su código
 * @param locationCode Código en formato "P-D-C" (ej: "8-8-9")
 * @returns Nombre completo "Provincia > Distrito > Corregimiento"
 */
export function getLocationName(locationCode: string): string {
  const [provCode, distCode, corrCode] = locationCode.split('-');

  const provincia = PANAMA_LOCATIONS.find(p => p.code === provCode);
  if (!provincia) return locationCode;

  const distrito = provincia.distritos.find(d => d.code === distCode);
  if (!distrito) return `${provincia.name} > ${locationCode}`;

  const corregimiento = distrito.corregimientos.find(c => c.code === corrCode);
  if (!corregimiento) return `${provincia.name} > ${distrito.name} > ${locationCode}`;

  return `${provincia.name} > ${distrito.name} > ${corregimiento.name}`;
}

/**
 * Busca ubicaciones por nombre (para autocompletado)
 * @param query Texto de búsqueda
 * @returns Array de resultados con código y nombre completo
 */
export function searchLocations(query: string): Array<{ code: string; name: string }> {
  const results: Array<{ code: string; name: string }> = [];
  const lowerQuery = query.toLowerCase();

  PANAMA_LOCATIONS.forEach(provincia => {
    provincia.distritos.forEach(distrito => {
      distrito.corregimientos.forEach(corregimiento => {
        const fullName = `${provincia.name} > ${distrito.name} > ${corregimiento.name}`;
        if (fullName.toLowerCase().includes(lowerQuery)) {
          results.push({
            code: `${provincia.code}-${distrito.code}-${corregimiento.code}`,
            name: fullName,
          });
        }
      });
    });
  });

  return results.slice(0, 50); // Limitar a 50 resultados
}
