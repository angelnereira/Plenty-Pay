/**
 * Plantillas de Excel predefinidas para importación de facturas
 * Usuario puede descargar estas plantillas como guía
 */

import ExcelJS from 'exceljs';

export interface ExcelTemplate {
    id: string;
    name: string;
    description: string;
    filename: string;
}

export const EXCEL_TEMPLATES: ExcelTemplate[] = [
    {
        id: 'simple',
        name: 'Factura Simple',
        description: 'Plantilla básica con cliente y productos',
        filename: 'plantilla_factura_simple.xlsx'
    },
    {
        id: 'detailed',
        name: 'Factura Detallada',
        description: 'Plantilla completa con todos los campos opcionales',
        filename: 'plantilla_factura_detallada.xlsx'
    },
    {
        id: 'services',
        name: 'Factura de Servicios',
        description: 'Plantilla optimizada para facturación de servicios',
        filename: 'plantilla_factura_servicios.xlsx'
    }
];

/**
 * Genera plantilla simple de factura
 */
export async function generateSimpleTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Factura');

    // Configurar estilos
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4F46E5' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
    };

    const instructionStyle = {
        font: { italic: true, color: { argb: 'FF6B7280' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } }
    };

    // Sección: Datos del Cliente
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').value = 'DATOS DEL CLIENTE';
    worksheet.getCell('A1').style = headerStyle;

    worksheet.getCell('A2').value = 'Campo';
    worksheet.getCell('B2').value = 'Valor';
    worksheet.getRow(2).font = { bold: true };

    worksheet.getCell('A3').value = 'Razón Social *';
    worksheet.getCell('B3').value = 'Nombre del Cliente';
    worksheet.getCell('B3').style = instructionStyle;

    worksheet.getCell('A4').value = 'RUC';
    worksheet.getCell('B4').value = '123456789';
    worksheet.getCell('B4').style = instructionStyle;

    worksheet.getCell('A5').value = 'Dígito Verificador';
    worksheet.getCell('B5').value = '12';
    worksheet.getCell('B5').style = instructionStyle;

    worksheet.getCell('A6').value = 'Dirección';
    worksheet.getCell('B6').value = 'Ciudad de Panamá';
    worksheet.getCell('B6').style = instructionStyle;

    worksheet.getCell('A7').value = 'Teléfono';
    worksheet.getCell('B7').value = '+507 6000-0000';
    worksheet.getCell('B7').style = instructionStyle;

    worksheet.getCell('A8').value = 'Email';
    worksheet.getCell('B8').value = 'cliente@example.com';
    worksheet.getCell('B8').style = instructionStyle;

    // Espacio
    worksheet.getRow(9).height = 5;

    // Sección: Items/Productos
    worksheet.mergeCells('A10:F10');
    worksheet.getCell('A10').value = 'ITEMS / PRODUCTOS';
    worksheet.getCell('A10').style = headerStyle;

    // Headers de items
    const itemHeaders = ['Descripción *', 'Cantidad *', 'Precio Unitario *', 'Descuento', 'ITBMS (%)', 'Notas'];
    itemHeaders.forEach((header, index) => {
        const cell = worksheet.getCell(11, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Ejemplos de items
    const exampleItems = [
        ['Producto o Servicio 1', 1, 100.00, 0, 7, 'Descripción adicional'],
        ['Producto o Servicio 2', 2, 50.00, 0, 7, ''],
        ['Producto o Servicio 3', 1, 75.00, 5, 7, '']
    ];

    exampleItems.forEach((item, index) => {
        item.forEach((value, colIndex) => {
            const cell = worksheet.getCell(12 + index, colIndex + 1);
            cell.value = value;
            cell.style = instructionStyle;
        });
    });

    // Ajustar anchos de columna
    worksheet.getColumn(1).width = 35;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 18;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 30;

    // Agregar instrucciones
    worksheet.mergeCells('A16:F16');
    const instructionsCell = worksheet.getCell('A16');
    instructionsCell.value = 'INSTRUCCIONES: Los campos marcados con * son obligatorios. Elimine las filas de ejemplo y agregue sus propios datos. ITBMS: 0=Exento, 7=7%, 10=10%, 15=15%';
    instructionsCell.font = { italic: true, size: 10, color: { argb: 'FF059669' } };
    instructionsCell.alignment = { wrapText: true };
    worksheet.getRow(16).height = 30;

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * Genera plantilla detallada de factura
 */
export async function generateDetailedTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Factura Detallada');

    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF059669' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
    };

    // Similar estructura pero con más campos
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'PLANTILLA FACTURA DETALLADA';
    worksheet.getCell('A1').style = headerStyle;

    // Cliente con más detalles
    const clientFields = [
        ['Razón Social *', 'Empresa S.A.'],
        ['RUC *', '123456789-1-2020'],
        ['DV *', '12'],
        ['Tipo Cliente', '01 (Contribuyente)'],
        ['Dirección', 'Ave. Principal, Ciudad'],
        ['Provincia', 'Panamá'],
        ['Distrito', 'Panamá'],
        ['Corregimiento', 'San Francisco'],
        ['Teléfono', '+507 6000-0000'],
        ['Email *', 'cliente@empresa.com']
    ];

    let row = 2;
    clientFields.forEach(([label, example]) => {
        worksheet.getCell(row, 1).value = label;
        worksheet.getCell(row, 1).font = { bold: true };
        worksheet.getCell(row, 2).value = example;
        row++;
    });

    // Items header
    row++;
    worksheet.mergeCells(`A${row}:G${row}`);
    worksheet.getCell(`A${row}`).value = 'ITEMS';
    worksheet.getCell(`A${row}`).style = headerStyle;

    row++;
    const headers = ['Código', 'Descripción *', 'Cantidad *', 'Precio Unit *', 'Descuento', 'ITBMS', 'Unidad'];
    headers.forEach((h, i) => {
        worksheet.getCell(row, i + 1).value = h;
        worksheet.getCell(row, i + 1).font = { bold: true };
    });

    // Forma de pago y notas
    row += 5;
    worksheet.getCell(row, 1).value = 'Forma de Pago';
    worksheet.getCell(row, 1).font = { bold: true };
    worksheet.getCell(row, 2).value = 'Efectivo / Tarjeta / Transferencia / Otro';

    row++;
    worksheet.getCell(row, 1).value = 'Notas / Información Adicional';
    worksheet.getCell(row, 1).font = { bold: true };
    worksheet.mergeCells(`B${row}:G${row}`);

    // Ajustar columnas
    worksheet.columns.forEach(col => col.width = 20);
    worksheet.getColumn(2).width = 35;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * Genera plantilla de servicios
 */
export async function generateServicesTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Servicios');

    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDB2777' } }
    };

    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = 'FACTURACIÓN DE SERVICIOS';
    worksheet.getCell('A1').style = headerStyle;

    // Headers para servicios (más simples)
    const headers = ['Servicio *', 'Horas/Unidades *', 'Tarifa *', 'ITBMS %', 'Total'];
    const row = 3;
    headers.forEach((h, i) => {
        worksheet.getCell(row, i + 1).value = h;
        worksheet.getCell(row, i + 1).font = { bold: true };
    });

    // Ejemplos
    const examples = [
        ['Consultoría Técnica', 10, 50.00, 7, '=B4*C4*(1+D4/100)'],
        ['Desarrollo Software', 20, 75.00, 7, '=B5*C5*(1+D5/100)'],
        ['Soporte Mensual', 1, 200.00, 7, '=B6*C6*(1+D6/100)']
    ];

    examples.forEach((ex, index) => {
        ex.forEach((val, colIndex) => {
            worksheet.getCell(row + 1 + index, colIndex + 1).value = val;
        });
    });

    worksheet.columns.forEach(col => col.width = 20);
    worksheet.getColumn(1).width = 35;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
