/**
 * Tests Unitarios para Validaciones de Importación
 * Pruebas para excel-parser y xml-parser con archivos REALES
 * (generados con ExcelJS), no buffers falsos.
 */

import { describe, it, expect } from '@jest/globals';
import ExcelJS from 'exceljs';
import { InvoiceExcelParser } from '../../lib/utils/excel-parser';
import { InvoiceXMLParser } from '../../lib/utils/xml-parser';

/** Genera un archivo .xlsx real en memoria a partir de filas. */
async function createExcelBuffer(rows: any[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hoja1');
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('Validaciones de Importación', () => {
  describe('InvoiceExcelParser', () => {
    describe('validate()', () => {
      it('debe validar archivo Excel válido', async () => {
        const mockBuffer = await createExcelBuffer([
          ['Cliente', 'Producto', 'Cantidad', 'Precio'],
          ['Juan Pérez', 'Producto A', 2, 10.50],
          ['María García', 'Producto B', 1, 25.00],
        ]);

        const result = await InvoiceExcelParser.validate(mockBuffer);

        expect(result.valid).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('debe rechazar un buffer vacío sin explotar', async () => {
        const result = await InvoiceExcelParser.validate(new ArrayBuffer(0));

        expect(result.valid).toBe(false);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('debe rechazar archivo con menos de 2 filas', async () => {
        const mockBuffer = await createExcelBuffer([['Solo una fila']]);

        const result = await InvoiceExcelParser.validate(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('al menos 2 filas');
      });

      it('debe manejar bytes corruptos (no-xlsx) sin explotar', async () => {
        const garbage = new TextEncoder().encode('esto no es un xlsx válido').buffer;

        const result = await InvoiceExcelParser.validate(garbage as ArrayBuffer);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Error al validar Excel');
      });
    });

    describe('parse()', () => {
      it('debe rechazar contenido corrupto con un error controlado', async () => {
        const parser = new InvoiceExcelParser();
        const garbage = new TextEncoder().encode('contenido corrupto').buffer;

        await expect(parser.parse(garbage as ArrayBuffer)).rejects.toThrow(
          'Error al procesar Excel'
        );
      });
    });
  });

  describe('InvoiceXMLParser', () => {
    describe('validate()', () => {
      it('debe validar XML válido', () => {
        const validXML = `<?xml version="1.0"?>
        <rFE version="1.00">
          <dDatosGenerales>
            <dRuc>123456789</dRuc>
            <dRazonSocial>Empresa Test</dRazonSocial>
          </dDatosGenerales>
        </rFE>`;

        const result = InvoiceXMLParser.validate(validXML);

        expect(result.valid).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('debe aceptar XML sin declaración <?xml?> (comportamiento tolerante)', () => {
        // El parser es deliberadamente tolerante: la declaración XML es
        // opcional siempre que la estructura (rFE/Invoice) sea reconocible.
        const xmlSinDeclaracion = `<rFE version="1.00">
          <dDatosGenerales>
            <dRuc>123456789</dRuc>
            <dRazonSocial>Empresa Test</dRazonSocial>
          </dDatosGenerales>
        </rFE>`;

        const result = InvoiceXMLParser.validate(xmlSinDeclaracion);

        expect(result.valid).toBe(true);
      });

      it('debe rechazar contenido que no es XML', () => {
        const result = InvoiceXMLParser.validate('esto no es xml, es texto plano');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('debe rechazar XML con estructura desconocida', () => {
        const result = InvoiceXMLParser.validate('<otraCosa><x>1</x></otraCosa>');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('debe manejar XML vacío', () => {
        const result = InvoiceXMLParser.validate('');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('vacío');
      });
    });
  });

  describe('Validaciones Defensivas', () => {
    describe('Manejo de Arrays Undefined', () => {
      it.each([
        ['undefined', undefined],
        ['null', null],
        ['array vacío', []],
      ])('debe manejar validation.errors %s', (_label, errors) => {
        const validation: any = { valid: false, errors };

        const errorMsg =
          validation.errors && Array.isArray(validation.errors) && validation.errors.length > 0
            ? validation.errors.join(', ')
            : 'Error de validación desconocido';

        expect(errorMsg).toBe('Error de validación desconocido');
      });

      it('debe manejar validation.errors con errores válidos', () => {
        const validation = { valid: false, errors: ['Error 1', 'Error 2'] };

        const errorMsg =
          validation.errors && Array.isArray(validation.errors) && validation.errors.length > 0
            ? validation.errors.join(', ')
            : 'Error de validación desconocido';

        expect(errorMsg).toBe('Error 1, Error 2');
      });
    });
  });

  describe('Casos Edge de Importación', () => {
    it('debe manejar archivo Excel con caracteres especiales', async () => {
      const mockBuffer = await createExcelBuffer([
        ['Cliente', 'Producto', 'Cantidad', 'Precio'],
        ['José María', 'Producto & Servicio', 1, 15.50],
        ['María José', 'Producto "Especial"', 2, 20.00],
      ]);

      const result = await InvoiceExcelParser.validate(mockBuffer);

      expect(result.valid).toBe(true);
    });

    it('debe manejar archivo Excel con números como texto', async () => {
      const mockBuffer = await createExcelBuffer([
        ['Cliente', 'Producto', 'Cantidad', 'Precio'],
        ['Juan', 'Producto A', '2', '10.50'],
        ['María', 'Producto B', '1', '25.00'],
      ]);

      const result = await InvoiceExcelParser.validate(mockBuffer);

      expect(result.valid).toBe(true);
    });

    it('debe manejar archivo Excel con celdas vacías', async () => {
      const mockBuffer = await createExcelBuffer([
        ['Cliente', 'Producto', 'Cantidad', 'Precio'],
        ['Juan', '', 2, 10.50],
        ['', 'Producto B', 1, 25.00],
      ]);

      const result = await InvoiceExcelParser.validate(mockBuffer);

      expect(result.valid).toBe(true);
    });
  });
});
