'use server';

import { auth } from '@core/auth';
import { createExcelParser } from '@/lib/utils/excel-parser';
import { createInvoiceParser } from '@/lib/utils/xml-parser';
import { mapParsedDataToDocumentoElectronico } from '@/lib/utils/parsed-data-mapper';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';

/**
 * Parsea archivos de factura (Excel/XML) y los convierte a formato HKA
 */
export async function parseInvoiceFile(formData: FormData) {
    try {
        // Verificar autenticación
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        // Obtener archivo y tipo
        const file = formData.get('file') as File;
        const type = formData.get('type') as string;

        if (!file) {
            return { success: false, error: 'No se proporcionó archivo' };
        }

        console.log(`[parseInvoiceFile] Processing ${type} file: ${file.name}`);

        // Paso 1: Parsear el archivo con las utilidades existentes
        let parsedData: any;

        if (type === 'xlsx' || type === 'xls') {
            // Procesar Excel
            console.log('[parseInvoiceFile] Using Excel parser...');
            const arrayBuffer = await file.arrayBuffer();
            const excelParser = createExcelParser();
            parsedData = await excelParser.parse(arrayBuffer);
        } else if (type === 'xml') {
            // Procesar XML
            console.log('[parseInvoiceFile] Using XML parser...');
            const textContent = await file.text();
            const xmlParser = createInvoiceParser();
            parsedData = await xmlParser.parse(textContent);
        } else {
            return { success: false, error: `Tipo de archivo no soportado: ${type}` };
        }

        // Validar datos parseados iniciales
        if (!parsedData || !parsedData.client || !parsedData.items) {
            console.error('[parseInvoiceFile] Invalid parsed data structure:', parsedData);
            return { success: false, error: 'El archivo no contiene datos de factura válidos' };
        }

        if (parsedData.items.length === 0) {
            return { success: false, error: 'El archivo no contiene items' };
        }

        console.log(`[parseInvoiceFile] Successfully parsed ${parsedData.items.length} items from ${type} file`);

        // Paso 2: Convertir a formato HKA DocumentoElectronico
        console.log('[parseInvoiceFile] Converting to HKA format...');
        const documento = mapParsedDataToDocumentoElectronico(parsedData);

        console.log('[parseInvoiceFile] Successfully converted to HKA format');
        console.log('[parseInvoiceFile] Cliente:', documento.datosTransaccion.cliente);
        console.log('[parseInvoiceFile] Items:', documento.listaItems.length);
        console.log('[parseInvoiceFile] Total:', documento.totalesSubTotales.totalFactura);

        // Retornar documento convertido
        return {
            success: true,
            data: documento
        };

    } catch (error: any) {
        console.error('[parseInvoiceFile] Error:', error);
        console.error('[parseInvoiceFile] Stack:', error.stack);
        return {
            success: false,
            error: error.message || 'Error al procesar el archivo'
        };
    }
}
