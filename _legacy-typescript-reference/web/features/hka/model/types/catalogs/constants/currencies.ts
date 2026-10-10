export type CurrencyCode =
  | 'AED'
  | 'ANG'
  | 'ARS'
  | 'AUD'
  | 'BBD'
  | 'BDT'
  | 'BHD'
  | 'BGN'
  | 'BOB'
  | 'BRL'
  | 'CAD'
  | 'CHF'
  | 'CLP'
  | 'CNY'
  | 'COP'
  | 'CRC'
  | 'CZK'
  | 'DKK'
  | 'DOP'
  | 'DZD'
  | 'EEK'
  | 'EGP'
  | 'EUR'
  | 'FJD'
  | 'GBP'
  | 'HKD'
  | 'HNL'
  | 'HRK'
  | 'HUF'
  | 'IDR'
  | 'ILS'
  | 'INR'
  | 'ISK'
  | 'JMD'
  | 'JOD'
  | 'JPY'
  | 'KES'
  | 'KRW'
  | 'KWD'
  | 'LBP'
  | 'LKR'
  | 'LTL'
  | 'LVL'
  | 'MAD'
  | 'MDL'
  | 'MKD'
  | 'MTL'
  | 'MUR'
  | 'MVR'
  | 'MXN'
  | 'MYR'
  | 'NAD'
  | 'NGN'
  | 'NIO'
  | 'NOK'
  | 'NPR'
  | 'NZD'
  | 'OMR'
  | 'PAB'
  | 'PEN'
  | 'PGK'
  | 'PHP'
  | 'PKR'
  | 'PLN'
  | 'PYG'
  | 'QAR'
  | 'RON'
  | 'RUB'
  | 'SAR'
  | 'SCR'
  | 'SEK'
  | 'SGD'
  | 'SKK'
  | 'SLL'
  | 'THB'
  | 'TND'
  | 'TRY'
  | 'TTD'
  | 'TWD'
  | 'TZS'
  | 'UAH'
  | 'UGX'
  | 'USD'
  | 'UYU'
  | 'UZS'
  | 'VEF'
  | 'VND'
  | 'XAF'
  | 'XCD'
  | 'XOF'
  | 'YER'
  | 'ZAR'
  | 'ZMK';

export const CURRENCIES: Record<CurrencyCode, string> = {
  'AED': 'Dirham de Emiratos Árabes Unidos',
  'ANG': 'Florín antillano neerlandés',
  'ARS': 'Peso argentino',
  'AUD': 'Dólar australiano',
  'BBD': 'Dólar de Barbados',
  'BDT': 'Taka de Bangladesh',
  'BHD': 'Dinar Bahreiní',
  'BGN': 'Lev búlgaro',
  'BOB': 'Boliviano de Bolivia',
  'BRL': 'Real Brasileño',
  'CAD': 'Dólar canadiense',
  'CHF': 'Franco suizo',
  'CLP': 'Peso chileno',
  'CNY': 'Yuan Chino',
  'COP': 'Peso colombiano',
  'CRC': 'Colón costarricense',
  'CZK': 'Corona Checa',
  'DKK': 'Corona Danesa',
  'DOP': 'Peso dominicano',
  'DZD': 'Dinar algerino',
  'EEK': 'Corona estonia',
  'EGP': 'Libra Egipcia',
  'EUR': 'Euro',
  'FJD': 'Dólar fijiano',
  'GBP': 'Libra Esterlina',
  'HKD': 'Dólar de Hong Kong',
  'HNL': 'Lempira hondureño',
  'HRK': 'Kuna croata',
  'HUF': 'Florín húngaro',
  'IDR': 'Rupia Indonesia',
  'ILS': 'Shekel Israelí',
  'INR': 'Rupia Hindú',
  'ISK': 'Corona Islandesa',
  'JMD': 'Dólar Jamaiquino',
  'JOD': 'Dinar Jordano',
  'JPY': 'Yen Japonés',
  'KES': 'Chelín Keniano',
  'KRW': 'Won surcoreano',
  'KWD': 'Dinar kuwaití',
  'LBP': 'Libra Libanesa',
  'LKR': 'Rupia Esrilanquesa',
  'LTL': 'Litas lituana',
  'LVL': 'Lats Letón',
  'MAD': 'Dirham de Marreucos',
  'MDL': 'Leu moldavo',
  'MKD': 'Denar macedonio',
  'MTL': 'Lira maltesa',
  'MUR': 'Rupia mauricia',
  'MVR': 'Rufiyaa maldiva',
  'MXN': 'Peso mexicano',
  'MYR': 'Ringgit Malayo',
  'NAD': 'Dólar Namibio',
  'NGN': 'Naira Nigeria',
  'NIO': 'Córdoba nicaragüense',
  'NOK': 'Corona noruega',
  'NPR': 'Rupia nepalí',
  'NZD': 'Dólar neozelandés',
  'OMR': 'Rial Omaní',
  'PAB': 'Balboa Panameño',
  'PEN': 'Nuevo sol Perú',
  'PGK': 'Kina de Papúa Nueva Guinea',
  'PHP': 'Peso filipino',
  'PKR': 'Rupia paquistaní',
  'PLN': 'Zloty Polaco',
  'PYG': 'Guaraní paraguayo',
  'QAR': 'Riyal Qatarí',
  'RON': 'Leu Rumano',
  'RUB': 'Rublo ruso',
  'SAR': 'Riyal Saudí',
  'SCR': 'Rupia de Seychelles',
  'SEK': 'Corona sueca',
  'SGD': 'Dólar de Singapur',
  'SKK': 'Corona eslovaca',
  'SLL': 'Leone de Sierra Leona',
  'THB': 'Baht Thailandés',
  'TND': 'Dinar tunecino',
  'TRY': 'Lira turca',
  'TTD': 'Dólar de Trinidad y Tobago',
  'TWD': 'Dólar taiwanés',
  'TZS': 'Chelín tanzano',
  'UAH': 'Grivna Ucrania',
  'UGX': 'Chelín ugandés',
  'USD': 'Dólar americano',
  'UYU': 'Peso uruguayo',
  'UZS': 'Som uzbeko',
  'VEF': 'Bolívar venezolano',
  'VND': 'Dong vietnamita',
  'XAF': 'Franco CFA de África Central',
  'XCD': 'Dólar del Caribe Oriental',
  'XOF': 'Franco CFA de África Occidental',
  'YER': 'Rial yemení (de Yemen)',
  'ZAR': 'Rand sudafricano',
  'ZMK': 'Kwacha zambiano',
};
