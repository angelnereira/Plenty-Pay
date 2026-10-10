/**
 * item-categories.ts
 * Defines product categories for delivery order items and their
 * specific capture fields. Used by the item form UI and PDF templates.
 */

// ─── Category type ────────────────────────────────────────────────────────────

export type ItemCategory =
  | 'GENERAL'
  | 'ROPA'
  | 'CALZADO'
  | 'MUEBLES'
  | 'ELECTRODOMESTICOS'
  | 'ELECTRONICA'
  | 'ALIMENTOS'
  | 'INSUMOS'
  | 'SERVICIOS'
  | 'SOFTWARE'

// ─── Field config ─────────────────────────────────────────────────────────────

export interface CategoryFieldConfig {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'url'
  placeholder?: string
  options?: string[]
  fullWidth?: boolean   // span both columns in the 2-col grid
}

// ─── Category list (for selector) ────────────────────────────────────────────

export const ITEM_CATEGORIES: { value: ItemCategory; label: string; emoji: string }[] = [
  { value: 'GENERAL',          label: 'General',                emoji: '📦' },
  { value: 'ROPA',             label: 'Ropa / Textiles',        emoji: '👕' },
  { value: 'CALZADO',          label: 'Calzado',                emoji: '👟' },
  { value: 'MUEBLES',          label: 'Muebles',                emoji: '🪑' },
  { value: 'ELECTRODOMESTICOS',label: 'Electrodomésticos',      emoji: '🏠' },
  { value: 'ELECTRONICA',      label: 'Electrónica',            emoji: '📱' },
  { value: 'ALIMENTOS',        label: 'Alimentos / Bebidas',    emoji: '🍎' },
  { value: 'INSUMOS',          label: 'Insumos / Ferretería',   emoji: '🔧' },
  { value: 'SERVICIOS',        label: 'Servicios (intangibles)',emoji: '📋' },
  { value: 'SOFTWARE',         label: 'Software / Digital',     emoji: '💻' },
]

// ─── Fields per category ──────────────────────────────────────────────────────

export const CATEGORY_FIELDS: Record<ItemCategory, CategoryFieldConfig[]> = {
  GENERAL: [],

  ROPA: [
    { key: 'talla',    label: 'Talla',                type: 'text',   placeholder: 'XS, S, M, L, XL, XXL' },
    { key: 'color',    label: 'Color',                type: 'text',   placeholder: 'Ej: Azul marino' },
    { key: 'genero',   label: 'Género',               type: 'select', options: ['Unisex', 'Masculino', 'Femenino', 'Niño', 'Niña'] },
    { key: 'material', label: 'Material',             type: 'text',   placeholder: '100% algodón' },
    { key: 'coleccion',label: 'Colección / Temporada',type: 'text',   placeholder: 'Verano 2026' },
    { key: 'cuidados', label: 'Cuidados de lavado',   type: 'text',   placeholder: 'Lavar a mano, no centrifugar', fullWidth: true },
  ],

  CALZADO: [
    { key: 'tallaEU',    label: 'Talla EU',        type: 'text',   placeholder: '42' },
    { key: 'tallaUS',    label: 'Talla US',        type: 'text',   placeholder: '9.5' },
    { key: 'color',      label: 'Color',           type: 'text',   placeholder: 'Negro' },
    { key: 'material',   label: 'Material',        type: 'text',   placeholder: 'Cuero genuino' },
    { key: 'marca',      label: 'Marca',           type: 'text',   placeholder: 'Nike' },
    { key: 'tipoSuela',  label: 'Tipo de suela',   type: 'text',   placeholder: 'Caucho vulcanizado' },
  ],

  MUEBLES: [
    { key: 'material',            label: 'Material',             type: 'text',   placeholder: 'MDF / Madera sólida' },
    { key: 'acabado',             label: 'Acabado / Color',      type: 'text',   placeholder: 'Roble natural' },
    { key: 'largo',               label: 'Largo (cm)',           type: 'number', placeholder: '120' },
    { key: 'ancho',               label: 'Ancho (cm)',           type: 'number', placeholder: '60' },
    { key: 'alto',                label: 'Alto (cm)',            type: 'number', placeholder: '75' },
    { key: 'requiereEnsamblaje',  label: 'Requiere ensamblaje',  type: 'select', options: ['No', 'Sí'] },
  ],

  ELECTRODOMESTICOS: [
    { key: 'marca',              label: 'Marca',                  type: 'text',   placeholder: 'Samsung' },
    { key: 'modelo',             label: 'Modelo',                 type: 'text',   placeholder: 'WF45B6300AW' },
    { key: 'nroSerie',           label: 'N° de Serie',            type: 'text',   placeholder: 'SN-00000000' },
    { key: 'voltaje',            label: 'Voltaje',                type: 'text',   placeholder: '110V / 220V' },
    { key: 'garantiaMeses',      label: 'Garantía (meses)',       type: 'number', placeholder: '12' },
    { key: 'consumoEnergetico',  label: 'Consumo energético',     type: 'text',   placeholder: '500W' },
  ],

  ELECTRONICA: [
    { key: 'marca',             label: 'Marca',              type: 'text',   placeholder: 'Apple' },
    { key: 'modelo',            label: 'Modelo',             type: 'text',   placeholder: 'iPhone 16 Pro' },
    { key: 'nroSerie',          label: 'N° Serie / IMEI',    type: 'text',   placeholder: '353xxxxxxx' },
    { key: 'sistemaOperativo',  label: 'Sistema Operativo',  type: 'text',   placeholder: 'iOS 18' },
    { key: 'conectividad',      label: 'Conectividad',       type: 'text',   placeholder: '5G, WiFi 6, Bluetooth 5.3', fullWidth: true },
  ],

  ALIMENTOS: [
    { key: 'fechaVencimiento',  label: 'Fecha de vencimiento',  type: 'date' },
    { key: 'nroLote',           label: 'N° de Lote',            type: 'text',   placeholder: 'LOT-2026-001' },
    { key: 'reqTemperatura',    label: 'Req. temperatura',      type: 'text',   placeholder: '0°C a 4°C' },
    { key: 'registroSanitario', label: 'Registro sanitario',    type: 'text',   placeholder: 'RS-0000' },
    { key: 'alergenos',         label: 'Alérgenos declarados',  type: 'text',   placeholder: 'Gluten, Lácteos', fullWidth: true },
  ],

  INSUMOS: [
    { key: 'nroLote',       label: 'N° de Lote',              type: 'text',   placeholder: 'LOT-0000' },
    { key: 'proveedor',     label: 'Proveedor',               type: 'text',   placeholder: 'Nombre del proveedor' },
    { key: 'peligrosidad',  label: 'Peligrosidad (Hazmat)',   type: 'select', fullWidth: true, options: [
      'No peligroso',
      'Clase 1 — Explosivos',
      'Clase 2 — Gases',
      'Clase 3 — Líquidos inflamables',
      'Clase 4 — Sólidos inflamables',
      'Clase 5 — Oxidantes / Peróxidos',
      'Clase 6 — Tóxicos / Infecciosos',
      'Clase 7 — Radiactivos',
      'Clase 8 — Corrosivos',
      'Clase 9 — Varios peligrosos',
    ]},
    { key: 'fichaTecnica',  label: 'URL Ficha técnica (SDS)',  type: 'url',  placeholder: 'https://...', fullWidth: true },
  ],

  SERVICIOS: [
    { key: 'tipoRetencion', label: 'Tipo de retención', type: 'select', fullWidth: true, options: [
      'Sin retención',
      '10% — Honorarios profesionales',
      '3% — Arrendamiento',
      '5% — Servicios técnicos',
    ]},
    { key: 'frecuenciaFacturacion', label: 'Frecuencia de facturación', type: 'select', options: [
      'Única', 'Mensual', 'Trimestral', 'Anual',
    ]},
    { key: 'duracionEstimada', label: 'Duración estimada', type: 'text', placeholder: 'Ej: 3 meses' },
  ],

  SOFTWARE: [
    { key: 'tipoLicencia', label: 'Tipo de licencia', type: 'select', options: [
      'Perpetua',
      'Suscripción anual',
      'Suscripción mensual',
      'Por usuario (seat)',
      'Sitio',
      'Código abierto',
    ]},
    { key: 'diasValidez',      label: 'Días de validez',      type: 'number', placeholder: '365' },
    { key: 'enlaceDescarga',   label: 'Enlace de descarga',   type: 'url',    placeholder: 'https://...', fullWidth: true },
  ],
}

// ─── ITBMS (Panama VAT) rates ─────────────────────────────────────────────────

export const ITBMS_OPTIONS = [
  { value: '',     label: 'Exento (0%)' },
  { value: '0.07', label: '7% — General' },
  { value: '0.10', label: '10% — Bebidas alcohólicas' },
  { value: '0.15', label: '15% — Tabaco / Cigarrillos' },
]

// ─── DGI Unit of Measure Catalog (UMC) ───────────────────────────────────────

export const UMC_OPTIONS = [
  { value: 'UND', label: 'UND — Unidad' },
  { value: 'KGM', label: 'KGM — Kilogramo' },
  { value: 'GRM', label: 'GRM — Gramo' },
  { value: 'LTR', label: 'LTR — Litro' },
  { value: 'MLT', label: 'MLT — Mililitro' },
  { value: 'MTR', label: 'MTR — Metro' },
  { value: 'MTK', label: 'MTK — Metro cuadrado' },
  { value: 'MTQ', label: 'MTQ — Metro cúbico' },
  { value: 'HUR', label: 'HUR — Hora' },
  { value: 'DAY', label: 'DAY — Día' },
  { value: 'MON', label: 'MON — Mes' },
  { value: 'BOX', label: 'BOX — Caja' },
  { value: 'PAK', label: 'PAK — Paquete' },
  { value: 'BAG', label: 'BAG — Bolsa' },
  { value: 'DZN', label: 'DZN — Docena' },
  { value: 'SET', label: 'SET — Juego / Set' },
]
