export type CountryCode =
  | 'AF'
  | 'AL'
  | 'DE'
  | 'DZ'
  | 'AD'
  | 'AO'
  | 'AI'
  | 'AQ'
  | 'AG'
  | 'AN'
  | 'SA'
  | 'AR'
  | 'AM'
  | 'AW'
  | 'AU'
  | 'AT'
  | 'AZ'
  | 'BE'
  | 'BS'
  | 'BH'
  | 'BD'
  | 'BB'
  | 'BZ'
  | 'BT'
  | 'BY'
  | 'MM'
  | 'BO'
  | 'BA'
  | 'BW'
  | 'BR'
  | 'BN'
  | 'BG'
  | 'BF'
  | 'BI'
  | 'CV'
  | 'KH'
  | 'CM'
  | 'CA'
  | 'TD'
  | 'CL'
  | 'CN'
  | 'CY'
  | 'VA'
  | 'CO'
  | 'KM'
  | 'CG'
  | 'CD'
  | 'KP'
  | 'KR'
  | 'CI'
  | 'CR'
  | 'HR'
  | 'CU'
  | 'DK'
  | 'DM'
  | 'EC'
  | 'EG'
  | 'SV'
  | 'AE'
  | 'ER'
  | 'SK'
  | 'SI'
  | 'ES'
  | 'US'
  | 'EE'
  | 'ET'
  | 'PH'
  | 'FI'
  | 'FJ'
  | 'FR'
  | 'GA'
  | 'GE'
  | 'GH'
  | 'GI'
  | 'GD'
  | 'GR'
  | 'GL'
  | 'GP'
  | 'GU'
  | 'GT'
  | 'GF'
  | 'GG'
  | 'GN'
  | 'GQ'
  | 'GW'
  | 'GY'
  | 'HT'
  | 'HN'
  | 'HK'
  | 'HU'
  | 'IN'
  | 'ID'
  | 'IR'
  | 'IQ'
  | 'IE'
  | 'BV'
  | 'IM'
  | 'CX'
  | 'NF'
  | 'IS'
  | 'BM'
  | 'KY'
  | 'CC'
  | 'CK'
  | 'AX'
  | 'FO'
  | 'GS'
  | 'HM'
  | 'MP'
  | 'MH'
  | 'PN'
  | 'SB'
  | 'TC'
  | 'UM'
  | 'VG'
  | 'VI'
  | 'IL'
  | 'JM'
  | 'JP'
  | 'JE'
  | 'JO'
  | 'KZ'
  | 'KE'
  | 'KG'
  | 'KI'
  | 'KW'
  | 'LB'
  | 'LA'
  | 'LS'
  | 'LV'
  | 'LR'
  | 'LY'
  | 'LI'
  | 'LT'
  | 'LU'
  | 'MO'
  | 'MK'
  | 'MG'
  | 'MY'
  | 'MW'
  | 'ML'
  | 'MT'
  | 'MA'
  | 'MQ'
  | 'MU'
  | 'MR'
  | 'YT'
  | 'FM'
  | 'MD'
  | 'MN'
  | 'ME'
  | 'MS'
  | 'MZ'
  | 'NA'
  | 'NR'
  | 'NP'
  | 'NI'
  | 'NE'
  | 'NG'
  | 'NU'
  | 'NO'
  | 'NC'
  | 'NZ'
  | 'OM'
  | 'NL'
  | 'PK'
  | 'PW'
  | 'PS'
  | 'PA'
  | 'PG'
  | 'PY'
  | 'PE'
  | 'PF'
  | 'PL'
  | 'PT'
  | 'PR'
  | 'QA'
  | 'GB'
  | 'CF'
  | 'CZ'
  | 'DO'
  | 'RE'
  | 'RO'
  | 'RU'
  | 'RW'
  | 'EH'
  | 'WS'
  | 'AS'
  | 'BL'
  | 'KN'
  | 'SM'
  | 'MF'
  | 'PM'
  | 'VC'
  | 'SH'
  | 'LC'
  | 'ST'
  | 'SN'
  | 'RS'
  | 'SC'
  | 'SL'
  | 'SG'
  | 'SY'
  | 'SO'
  | 'LK'
  | 'ZA'
  | 'SD'
  | 'SE'
  | 'CH'
  | 'SR'
  | 'SJ'
  | 'SZ'
  | 'TH'
  | 'TW'
  | 'TZ'
  | 'IO'
  | 'TF'
  | 'TL'
  | 'TG'
  | 'TK'
  | 'TO'
  | 'TT'
  | 'TN'
  | 'TM'
  | 'TR'
  | 'TV'
  | 'UA'
  | 'UG'
  | 'UY'
  | 'UZ'
  | 'VU'
  | 'VE'
  | 'VN'
  | 'WF'
  | 'YE'
  | 'DJ'
  | 'ZM'
  | 'ZW';

export const COUNTRIES: Record<CountryCode, string> = {
  'AF': 'Afganistán',
  'AL': 'Albania',
  'DE': 'Alemania',
  'DZ': 'Argelia',
  'AD': 'Andorra',
  'AO': 'Angola',
  'AI': 'Anguila',
  'AQ': 'Antártida',
  'AG': 'Antigua y Barbuda',
  'AN': 'Antillas Neerlandesas',
  'SA': 'Arabia Saudita',
  'AR': 'Argentina',
  'AM': 'Armenia',
  'AW': 'Aruba',
  'AU': 'Australia',
  'AT': 'Austria',
  'AZ': 'Azerbaiyán',
  'BE': 'Bélgica',
  'BS': 'Bahamas',
  'BH': 'Bahréin',
  'BD': 'Bangladesh',
  'BB': 'Barbados',
  'BZ': 'Belice',
  'BT': 'Bután',
  'BY': 'Bielorrusia',
  'MM': 'Birmania',
  'BO': 'Bolivia',
  'BA': 'Bosnia y Herzegovina',
  'BW': 'Botsuana',
  'BR': 'Brasil',
  'BN': 'Brunéi',
  'BG': 'Bulgaria',
  'BF': 'Burkina Faso',
  'BI': 'Burundi',
  'CV': 'Cabo Verde',
  'KH': 'Camboya',
  'CM': 'Camerún',
  'CA': 'Canadá',
  'TD': 'Chad',
  'CL': 'Chile',
  'CN': 'China',
  'CY': 'Chipre',
  'VA': 'Ciudad del Vaticano',
  'CO': 'Colombia',
  'KM': 'Comoras',
  'CG': 'Congo',
  'CD': 'Congo (República Democrática)',
  'KP': 'Corea del Norte',
  'KR': 'Corea del Sur',
  'CI': 'Costa de Marfil',
  'CR': 'Costa Rica',
  'HR': 'Croacia',
  'CU': 'Cuba',
  'DK': 'Dinamarca',
  'DM': 'Dominica',
  'EC': 'Ecuador',
  'EG': 'Egipto',
  'SV': 'El Salvador',
  'AE': 'Emiratos Árabes Unidos',
  'ER': 'Eritrea',
  'SK': 'Eslovaquia',
  'SI': 'Eslovenia',
  'ES': 'España',
  'US': 'Estados Unidos de América',
  'EE': 'Estonia',
  'ET': 'Etiopía',
  'PH': 'Filipinas',
  'FI': 'Finlandia',
  'FJ': 'Fiyi',
  'FR': 'Francia',
  'GA': 'Gabón',
  'GE': 'Georgia',
  'GH': 'Ghana',
  'GI': 'Gibraltar',
  'GD': 'Granada',
  'GR': 'Grecia',
  'GL': 'Groenlandia',
  'GP': 'Guadalupe',
  'GU': 'Guam',
  'GT': 'Guatemala',
  'GF': 'Guayana Francesa',
  'GG': 'Guernsey',
  'GN': 'Guinea',
  'GQ': 'Guinea Ecuatorial',
  'GW': 'Guinea-Bissau',
  'GY': 'Guyana',
  'HT': 'Haití',
  'HN': 'Honduras',
  'HK': 'Hong Kong',
  'HU': 'Hungría',
  'IN': 'India',
  'ID': 'Indonesia',
  'IR': 'Irán',
  'IQ': 'Irak',
  'IE': 'Irlanda',
  'BV': 'Isla Bouvet',
  'IM': 'Isla de Man',
  'CX': 'Isla de Navidad',
  'NF': 'Isla Norfolk',
  'IS': 'Islandia',
  'BM': 'Islas Bermudas',
  'KY': 'Islas Caimán',
  'CC': 'Islas Cocos (Keeling)',
  'CK': 'Islas Cook',
  'AX': 'Islas de Åland',
  'FO': 'Islas Feroe',
  'GS': 'Islas Georgias del Sur y Sandwich del Sur',
  'HM': 'Islas Heard y McDonald',
  'MP': 'Islas Marianas del Norte',
  'MH': 'Islas Marshall',
  'PN': 'Islas Pitcairn',
  'SB': 'Islas Salomón',
  'TC': 'Islas Turcas y Caicos',
  'UM': 'Islas Ultramarinas de Estados Unidos',
  'VG': 'Islas Vírgenes Británicas',
  'VI': 'Islas Vírgenes de los Estados Unidos',
  'IL': 'Israel',
  'JM': 'Jamaica',
  'JP': 'Japón',
  'JE': 'Jersey',
  'JO': 'Jordania',
  'KZ': 'Kazajistán',
  'KE': 'Kenia',
  'KG': 'Kirgizstán',
  'KI': 'Kiribati',
  'KW': 'Kuwait',
  'LB': 'Líbano',
  'LA': 'Laos',
  'LS': 'Lesoto',
  'LV': 'Letonia',
  'LR': 'Liberia',
  'LY': 'Libia',
  'LI': 'Liechtenstein',
  'LT': 'Lituania',
  'LU': 'Luxemburgo',
  'MO': 'Macao',
  'MK': 'Macedônia',
  'MG': 'Madagascar',
  'MY': 'Malasia',
  'MW': 'Malawi',
  'ML': 'Mali',
  'MT': 'Malta',
  'MA': 'Marruecos',
  'MQ': 'Martinica',
  'MU': 'Mauricio',
  'MR': 'Mauritania',
  'YT': 'Mayotte',
  'FM': 'Micronesia',
  'MD': 'Moldavia',
  'MN': 'Mongolia',
  'ME': 'Montenegro',
  'MS': 'Montserrat',
  'MZ': 'Mozambique',
  'NA': 'Namibia',
  'NR': 'Nauru',
  'NP': 'Nepal',
  'NI': 'Nicaragua',
  'NE': 'Níger',
  'NG': 'Nigeria',
  'NU': 'Niue',
  'NO': 'Noruega',
  'NC': 'Nueva Caledonia',
  'NZ': 'Nueva Zelanda',
  'OM': 'Omán',
  'NL': 'Países Bajos',
  'PK': 'Pakistán',
  'PW': 'Palau',
  'PS': 'Palestina',
  'PA': 'Panamá',
  'PG': 'Papúa Nueva Guinea',
  'PY': 'Paraguay',
  'PE': 'Perú',
  'PF': 'Polinesia Francesa',
  'PL': 'Polonia',
  'PT': 'Portugal',
  'PR': 'Puerto Rico',
  'QA': 'Qatar',
  'GB': 'Reino Unido',
  'CF': 'República Centroafricana',
  'CZ': 'República Checa',
  'DO': 'República Dominicana',
  'RE': 'Reunión',
  'RO': 'Rumanía',
  'RU': 'Rusia',
  'RW': 'Ruanda',
  'EH': 'Sahara Occidental',
  'WS': 'Samoa',
  'AS': 'Samoa Americana',
  'BL': 'San Bartolomé',
  'KN': 'San Cristóbal y Nieves',
  'SM': 'San Marino',
  'MF': 'San Martín (Francia)',
  'PM': 'San Pedro y Miquelón',
  'VC': 'San Vicente y las Granadinas',
  'SH': 'Santa Elena',
  'LC': 'Santa Lucía',
  'ST': 'Santo Tomé y Príncipe',
  'SN': 'Senegal',
  'RS': 'Serbia',
  'SC': 'Seychelles',
  'SL': 'Sierra Leona',
  'SG': 'Singapur',
  'SY': 'Siria',
  'SO': 'Somalia',
  'LK': 'Sri Lanka',
  'ZA': 'Sudáfrica',
  'SD': 'Sudán',
  'SE': 'Suecia',
  'CH': 'Suiza',
  'SR': 'Surinam',
  'SJ': 'Svalbard y Jan Mayen',
  'SZ': 'Suazilandia',
  'TH': 'Tailandia',
  'TW': 'Taiwán',
  'TZ': 'Tanzania',
  'IO': 'Territorio Británico del Océano Índico',
  'TF': 'Territorios Australes y Antárticas Franceses',
  'TL': 'Timor Oriental',
  'TG': 'Togo',
  'TK': 'Tokelau',
  'TO': 'Tonga',
  'TT': 'Trinidad y Tobago',
  'TN': 'Túnez',
  'TM': 'Turkmenistán',
  'TR': 'Turquía',
  'TV': 'Tuvalu',
  'UA': 'Ucrania',
  'UG': 'Uganda',
  'UY': 'Uruguay',
  'UZ': 'Uzbekistán',
  'VU': 'Vanuatu',
  'VE': 'Venezuela',
  'VN': 'Vietnam',
  'WF': 'Wallis y Futuna',
  'YE': 'Yemen',
  'DJ': 'Yibuti',
  'ZM': 'Zambia',
  'ZW': 'Zimbabue',
};
