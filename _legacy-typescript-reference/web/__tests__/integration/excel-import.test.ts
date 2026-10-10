/**
 * Tests de Integración - Importación Excel
 *
 * Ejercitan el pipeline completo validate() → parse() de InvoiceExcelParser
 * con archivos .xlsx REALES generados con ExcelJS (sin mocks).
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import ExcelJS from 'exceljs';
import { InvoiceExcelParser } from '../../lib/utils/excel-parser';

/** Genera un archivo .xlsx real en memoria a partir de filas. */
async function createExcelBuffer(rows: any[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hoja1');
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('Tests de Integración - Importación Excel', () => {
  let parser: InvoiceExcelParser;

  beforeAll(() => {
    parser = new InvoiceExcelParser();
  });

  describe('Formatos de Excel Soportados', () => {
    it('debe procesar Excel con headers de cliente e items', async () => {
      const buffer = await createExcelBuffer([
        ['Cliente', 'RUC', 'Descripción', 'Cantidad', 'Precio', 'ITBMS'],
        ['Juan Pérez', '8-123-456', 'Producto A', 2, 10.5, 7],
        ['Juan Pérez', '8-123-456', 'Producto B', 1, 25, 7],
      ]);

      const validation = await InvoiceExcelParser.validate(buffer);
      expect(validation.valid).toBe(true);

      const result = await parser.parse(buffer);

      expect(result.client.name).toBe('Juan Pérez');
      expect(result.client.taxId).toBe('8-123-456');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        description: 'Producto A',
        quantity: 2,
        unitPrice: 10.5,
        taxRate: 7,
      });
      expect(result.items[1]).toMatchObject({
        description: 'Producto B',
        quantity: 1,
        unitPrice: 25,
      });
    });

    it('debe usar cliente genérico cuando el Excel solo trae items', async () => {
      const buffer = await createExcelBuffer([
        ['Descripción', 'Cantidad', 'Precio'],
        ['Servicio X', 3, 15],
      ]);

      const result = await parser.parse(buffer);

      expect(result.client.name).toBe('Cliente Genérico');
      expect(result.client.taxId).toBe('000000000');
      expect(result.client.country).toBe('PA');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe('Servicio X');
    });
  });

  describe('Normalización de Números', () => {
    it('debe parsear números que vienen como texto con símbolos ($ y coma decimal)', async () => {
      const buffer = await createExcelBuffer([
        ['Descripción', 'Cantidad', 'Precio'],
        ['Producto A', '2', '$10,50'],
      ]);

      const result = await parser.parse(buffer);

      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].unitPrice).toBe(10.5);
    });
  });

  describe('Manejo de Errores', () => {
    it('debe lanzar error controlado con bytes corruptos', async () => {
      const garbage = new TextEncoder().encode('no soy un xlsx').buffer;

      await expect(parser.parse(garbage as ArrayBuffer)).rejects.toThrow(
        'Error al procesar Excel'
      );
    });

    it('debe lanzar error controlado con workbook sin hojas', async () => {
      const workbook = new ExcelJS.Workbook();
      const empty = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

      await expect(parser.parse(empty)).rejects.toThrow('Error al procesar Excel');
    });

    it('validate() y parse() son consistentes: lo válido se puede parsear', async () => {
      const buffer = await createExcelBuffer([
        ['Descripción', 'Cantidad', 'Precio'],
        ['Producto A', 1, 9.99],
      ]);

      const validation = await InvoiceExcelParser.validate(buffer);
      expect(validation.valid).toBe(true);

      await expect(parser.parse(buffer)).resolves.toBeDefined();
    });
  });

  describe('Valores por defecto de items', () => {
    it('aplica taxRate 7% (ITBMS estándar Panamá) y discount 0 por defecto', async () => {
      const buffer = await createExcelBuffer([
        ['Descripción', 'Cantidad', 'Precio'],
        ['Producto A', 1, 100],
      ]);

      const result = await parser.parse(buffer);

      expect(result.items[0].taxRate).toBe(7);
      expect(result.items[0].discount).toBe(0);
    });
  });
});
