export interface PrinterProfile {
  id: string;
  label: string;
  width: number;       // characters per line
  paperMm: number;     // paper width in mm
  cutCommand: boolean; // supports paper cut
}

export const PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: 'generic-58',
    label: 'Genérica 58mm (32 col)',
    width: 32,
    paperMm: 58,
    cutCommand: true,
  },
  {
    id: 'generic-80',
    label: 'Genérica 80mm (48 col)',
    width: 48,
    paperMm: 80,
    cutCommand: true,
  },
  {
    id: 'epson-tm',
    label: 'Epson TM Series',
    width: 48,
    paperMm: 80,
    cutCommand: true,
  },
  {
    id: 'star-tsp',
    label: 'Star TSP Series',
    width: 42,
    paperMm: 80,
    cutCommand: true,
  },
];

export const DEFAULT_PROFILE = PRINTER_PROFILES[0];
