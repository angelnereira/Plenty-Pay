/**
 * Engine 1: HKA Universal Input Adapter
 * "The Translator"
 * 
 * Se encarga de transformar cualquier entrada (Excel, CSV, JSON) 
 * a la estructura estricta DocumentoElectronico de HKA.
 */

import ExcelJS from 'exceljs';
import { parse } from 'papaparse';
import { sanitizeDecimal, sanitizeText } from './utils';
import type {
    HKAInputAdapter,
    AdaptationResult,
    SupportedInputFormat
} from './types';
import type {
    DocumentoElectronico,
    ItemFactura,
    Cliente,
    TotalesSubTotales,
    TasaITBMS
} from '../types/types';
import { cleanXMLObject, formatDateISO8601 } from '../services/utils';
import { HKALogger } from '../services/logger';

// ... imports anteriores
import { mapInvoiceToHKA, type InvoiceWithRelations } from '../mappers/invoice-to-hka';
import type { HKAConfig } from '../index';
import { resolveTimoEmision } from '../repositories/hka-config.repository';
import { mapReceiverTypeToHKA } from '../services/utils';

export class InputAdapterEngine implements HKAInputAdapter {

    /**
     * Procesa la entrada y devuelve un DocumentoElectronico estándar
     * Ahora soporta Invoice DB + HKAConfig para mapeo exacto
     */
    async process(
        input: unknown,
        format: SupportedInputFormat,
        config?: HKAConfig // Necesario para el mapper oficial
    ): Promise<AdaptationResult> {
        const adapterLogger = new HKALogger();
        try {
            let documento: DocumentoElectronico | undefined;
            const metadata = {
                format,
                detectedMethod: 'Enviar' as const,
                itemCount: 0,
                totalAmount: 0,
            };

            // Estrategia según formato
            switch (format) {
                case 'json':
                case 'object':
                    // Si tenemos config y parece ser una Invoice de Prisma
                    if (config && this.isPrismaInvoice(input)) {
                        // 1. CHEQUEO ESPECIAL: ¿Es un borrador con datos en 'notes'?
                        // Esto ocurre en la emisión de Factura Manual, donde los items no se guardan en la DB relacional
                        // sino como un JSON completo dentro de 'notes'.
                        // CRITICAL: NC/ND NUNCA deben tomar esta ruta — sus datos referenciales (refCufe,
                        // refDocumentDate, noteSubtype) solo se procesan correctamente por mapInvoiceToHKA.
                        // Un retry previo con updatedData puede haber guardado documentoCompleto en notes
                        // con tipoDocumento incorrecto y sin listaDocsFiscalReferenciados.
                        const isNotaCredDeb = input.documentType === 'NOTA_CREDITO' || input.documentType === 'NOTA_DEBITO';
                        if (input.items.length === 0 && input.notes && !isNotaCredDeb) {
                            try {
                                const notesData = JSON.parse(input.notes);
                                if (notesData.documentoCompleto) {
                                    adapterLogger.log({ level: 'DEBUG', method: 'InputAdapter', timestamp: new Date(), metadata: { action: 'Borrador Manual detectado en notes', invoiceNumber: input.invoiceNumber } });

                                    documento = notesData.documentoCompleto as DocumentoElectronico;
                                    adapterLogger.log({ level: 'DEBUG', method: 'InputAdapter', timestamp: new Date(), metadata: { action: 'Documento Original Num', num: documento.datosTransaccion?.numeroDocumentoFiscal } });

                                    // Asegurar que el numeroDocumentoFiscal coincida con lo asignado por el Orchestrator
                                    const assignedNumber = input.invoiceNumber || input.numeroDocumentoFiscal;

                                    if (assignedNumber && documento.datosTransaccion) {
                                        adapterLogger.log({ level: 'DEBUG', method: 'InputAdapter', timestamp: new Date(), metadata: { action: 'Overwriting number', assignedNumber } });
                                        documento.datosTransaccion.numeroDocumentoFiscal = String(assignedNumber);
                                        // Also ensure other references if any (none in standard HKA)
                                    } else {
                                        adapterLogger.log({ level: 'WARN', method: 'InputAdapter', timestamp: new Date(), metadata: { action: 'Skipping overwrite — no assignedNumber', invNum: input.invoiceNumber, docNum: input.numeroDocumentoFiscal } });
                                    }

                                    break; // Salir del switch, ya tenemos documento
                                }
                            } catch (e) {
                                adapterLogger.log({ level: 'WARN', method: 'InputAdapter', timestamp: new Date(), metadata: { action: 'Error parseando notes de borrador', error: String(e) } });
                            }
                        }

                        // 2. Mapeo estándar para facturas relacionales
                        adapterLogger.log({
                            level: 'DEBUG', method: 'InputAdapter', timestamp: new Date(),
                            metadata: { action: 'Prisma Invoice detected', invoiceId: input.id, invoiceNumber: input.invoiceNumber, hasItems: !!input.items, itemsCount: Array.isArray(input.items) ? input.items.length : 0, hasCustomer: !!input.customer }
                        });

                        // AUTO-DETECT tipoEmision: B2B (01), B2C/Mostrador (03) o Contingencia (02/04)
                        const tipoClienteFE = mapReceiverTypeToHKA(input.receiverType);

                        // Facturas offline-sinc: tipoEmisionOverride persiste el tipo determinado
                        // al momento de la creación offline. Tiene prioridad sobre la resolución
                        // dinámica del config para garantizar cumplimiento DGI aunque la contingencia
                        // ya esté desactivada cuando llega la sincronización.
                        const tipoEmisionOverride = (input as any).tipoEmisionOverride as string | null | undefined;
                        const resolvedTipoEmision = (tipoEmisionOverride as any) ??
                            resolveTimoEmision(tipoClienteFE as '01' | '02' | '03' | '04', config as Parameters<typeof resolveTimoEmision>[1]);

                        // Si la factura tiene sus propios campos B04/B05 (offline-sync),
                        // inyectarlos en el config para que el mapper los incluya en el XML.
                        const invoiceFechaInicio = (input as any).fechaInicioContingencia as Date | null | undefined;
                        const invoiceMotivo = (input as any).motivoContingencia as string | null | undefined;
                        const contingenciaOverride = (tipoEmisionOverride === '02' || tipoEmisionOverride === '04') && invoiceFechaInicio
                            ? {
                                contingenciaActiva: true,
                                contingenciaInicio: invoiceFechaInicio instanceof Date
                                    ? invoiceFechaInicio.toISOString()
                                    : String(invoiceFechaInicio),
                                contingenciaMotivo: invoiceMotivo ?? 'Falla de conectividad a internet en el local comercial',
                                contingenciaTipo: tipoEmisionOverride as '02' | '04',
                              }
                            : {};

                        // Para Autorización Posterior (03/04): CAFE obligatorio + exención de ContenedorFE
                        const isPostAuth = resolvedTipoEmision === '03' || resolvedTipoEmision === '04';
                        const resolvedConfig: HKAConfig = {
                          ...config,
                          ...contingenciaOverride,
                          tipoEmision: resolvedTipoEmision,
                          ...(isPostAuth && {
                            // DGI: CAFE siempre obligatorio en flujo posterior — anular valor '1' (sin generación)
                            formatoCAFE: config.formatoCAFE === '1' ? '2' : config.formatoCAFE,
                            entregaCAFE: config.entregaCAFE === '1' ? '2' : config.entregaCAFE,
                            // Consumidor final exime de obligatoriedad de envío de ContenedorFE (B17=2)
                            envioContenedor: '2',
                          }),
                        };
                        adapterLogger.log({
                            level: 'DEBUG', method: 'InputAdapter', timestamp: new Date(),
                            metadata: {
                                action: 'tipoEmision resuelto',
                                tipoClienteFE,
                                resolvedTipoEmision,
                                tipoEmisionOverride: tipoEmisionOverride ?? 'none',
                                isPostAuth,
                                contingenciaActiva: resolvedConfig.contingenciaActiva,
                                hasContingenciaOverride: Object.keys(contingenciaOverride).length > 0,
                            }
                        });

                        documento = mapInvoiceToHKA(input, resolvedConfig);
                    } else {
                        documento = this.processJSON(input);
                    }
                    break;
                case 'csv':
                case 'excel':
                    documento = await this.processSpreadsheet(input);
                    break;
                default:
                    return {
                        success: false,
                        errors: [`Formato no soportado: ${format}`],
                    };
            }

            if (!documento) {
                return {
                    success: false,
                    errors: ['No se pudo generar el documento'],
                };
            }

            // Validaciones básicas post-transformación
            const validationErrors = this.validateStructure(documento);

            // Calcular metadatos finales
            metadata.itemCount = documento.listaItems.length;
            metadata.totalAmount = Number(documento.totalesSubTotales.totalFactura);

            return {
                success: validationErrors.length === 0,
                documento,
                sourceMetadata: metadata,
                errors: validationErrors,
            };

        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Error desconocido en adaptador'],
            }
        }
    }

    // ==========================================
    // ESTRATEGIAS DE PARSEO
    // ==========================================

    private processJSON(input: unknown): DocumentoElectronico {
        // Si ya viene como objeto, asumimos que intenta seguir la estructura
        // Hacemos un mapping "soft" para limpiar campos extra y asegurar tipos
        const raw = typeof input === 'string' ? JSON.parse(input) : input;
        if (!raw || typeof raw !== 'object') {
            throw new Error('Input JSON inválido');
        }

        // Aquí se podría implementar lógica de auto-correction
        // Por ahora retornamos el objeto asumiendo que es un DocumentoElectronico válido
        // El Guard Engine hará la validación estricta después.
        return raw as DocumentoElectronico;
    }

    private async processSpreadsheet(input: unknown): Promise<DocumentoElectronico> {
        let inputs: any[] = [];

        // Parsear Buffer/String a Array de Objetos
        if (Buffer.isBuffer(input) || typeof input === 'string') {
            const workbook = new ExcelJS.Workbook();

            // Cargar workbook desde buffer o base64
            if (Buffer.isBuffer(input)) {
                await workbook.xlsx.load(input as any);
            } else {
                // Convertir base64 a buffer
                const buffer = Buffer.from(input, 'base64');
                await workbook.xlsx.load(buffer as any);
            }

            // Obtener primera hoja
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('No se encontró ninguna hoja en el archivo Excel');
            }

            // Convertir worksheet a array de objetos (equivalente a sheet_to_json)
            const rows: any[] = [];
            const headers: string[] = [];

            // Primera fila contiene los headers
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell, colNumber) => {
                headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
            });

            // Iterar resto de filas
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row

                const rowData: any = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber - 1];
                    if (header) {
                        rowData[header] = cell.value;
                    }
                });

                // Solo agregar filas que tengan al menos un valor
                if (Object.keys(rowData).length > 0) {
                    rows.push(rowData);
                }
            });

            inputs = rows;
        } else if (Array.isArray(input)) {
            inputs = input;
        } else {
            throw new Error('Input Excel/CSV inválido');
        }

        if (inputs.length === 0) throw new Error('Archivo vacío');

        // Interpretación Inteligente de Filas (Header vs Detalle)
        // Asumimos un formato plano donde cada fila es un ítem, y los datos de cabecera se repiten

        const firstRow = inputs[0];

        // Mapear Cabecera (Cliente, Transacción)
        const cliente = this.mapClienteFromRow(firstRow);
        const datosTransaccion = this.mapTransaccionFromRow(firstRow);

        // Mapear Items
        const items: ItemFactura[] = inputs.map(row => this.mapItemFromRow(row));

        // Calcular Totales (Engine 1 debe ser capaz de auto-calcular si faltan)
        const totales = this.calculateTotales(items);

        return {
            codigoSucursalEmisor: firstRow['Sucursal'] || '0000',
            tipoSucursal: '1',
            datosTransaccion,
            listaItems: items,
            totalesSubTotales: totales,
        };
    }

    // ==========================================
    // MAPPER HELPERS (Intelligent Mapping)
    // ==========================================

    private mapClienteFromRow(row: any): Cliente {
        // STRICT VALIDATION: For Excel imports, critical fields must exist.
        // No more hardcoded fallbacks that send incorrect fiscal data to HKA.

        const tipoCliente = row['TipoCliente'] || '02'; // Default to consumidor final

        // For Contribuyente (01) and Gobierno (03), require all location fields
        if (tipoCliente === '01' || tipoCliente === '03') {
            const missingFields: string[] = [];
            if (!row['TipoContribuyente']) missingFields.push('TipoContribuyente');
            if (!row['RUC']) missingFields.push('RUC');
            if (!row['DV']) missingFields.push('DV');
            if (!row['RazonSocial'] && !row['Cliente']) missingFields.push('RazonSocial/Cliente');
            if (!row['Ubicacion']) missingFields.push('Ubicacion (formato: X-X-X)');
            if (!row['Provincia']) missingFields.push('Provincia');
            if (!row['Distrito']) missingFields.push('Distrito');
            if (!row['Corregimiento']) missingFields.push('Corregimiento');
            if (!row['Direccion']) missingFields.push('Direccion');

            if (missingFields.length > 0) {
                throw new Error(
                    `Campos obligatorios faltantes en Excel para Contribuyente/Gobierno: ${missingFields.join(', ')}. ` +
                    `Por favor complete estos campos en su archivo Excel.`
                );
            }

            return {
                tipoClienteFE: tipoCliente as '01' | '03',
                tipoContribuyente: row['TipoContribuyente'] as '1' | '2',
                numeroRUC: row['RUC'],
                digitoVerificadorRUC: row['DV'],
                razonSocial: row['RazonSocial'] || row['Cliente'],
                direccion: row['Direccion'],
                codigoUbicacion: row['Ubicacion'],
                provincia: row['Provincia'],
                distrito: row['Distrito'],
                corregimiento: row['Corregimiento'],
                telefono1: row['Telefono'],
                correoElectronico1: row['Email'],
                pais: 'PA',
            };
        }

        // Consumidor Final (02) - only include fields with actual values
        const cliente: Cliente = {
            tipoClienteFE: '02',
            razonSocial: row['RazonSocial'] || row['Cliente'] || 'CONSUMIDOR FINAL',
            pais: 'PA',
        };

        // Only add optional fields if they have values
        if (row['RUC']) cliente.numeroRUC = row['RUC'];
        if (row['DV']) cliente.digitoVerificadorRUC = row['DV'];
        if (row['Direccion']) cliente.direccion = row['Direccion'];
        if (row['Telefono']) cliente.telefono1 = row['Telefono'];
        if (row['Email']) cliente.correoElectronico1 = row['Email'];

        return cliente;
    }

    private mapTransaccionFromRow(row: any): any {
        return {
            tipoEmision: '01',
            tipoDocumento: '01', // Factura
            numeroDocumentoFiscal: row['NumeroFactura'] || '0',
            puntoFacturacionFiscal: row['PuntoFacturacion'] || '101',
            fechaEmision: formatDateISO8601(new Date()),
            naturalezaOperacion: row['Naturaleza'] || '01', // Venta
            tipoOperacion: '1', // Salida
            destinoOperacion: '1', // Panama
            procesoGeneracion: '1',
            tipoVenta: '1',
        };
    }

    private mapItemFromRow(row: any): ItemFactura {
        return {
            descripcion: sanitizeText(row['Descripcion'] || row['Producto'] || 'Item genérico'),
            codigo: sanitizeText(row['Codigo'] || row['SKU'] || 'GEN-01'),
            unidadMedida: row['Unidad'] || 'und',
            cantidad: sanitizeDecimal(row['Cantidad'] || 1),
            precioUnitario: sanitizeDecimal(row['Precio'] || 0),
            precioUnitarioDescuento: sanitizeDecimal(row['Descuento'] || 0),
            precioItem: sanitizeDecimal(row['Subtotal'] || 0),
            valorTotal: sanitizeDecimal(row['Total'] || 0),
            tasaITBMS: this.normalizeITBMS(row['ITBMS']) as TasaITBMS,
            valorITBMS: sanitizeDecimal(row['ValorITBMS'] || 0),
            tasaISC: '00', // Default
            valorISC: '0.00',
        };
    }

    private normalizeITBMS(val: any): string {
        // Mapear valores comunes de entrada a códigos HKA
        const str = String(val).trim();
        if (str === '7' || str === '0.07' || str === '7%' || str === '07') return '01'; // 7%
        if (str === '10' || str === '0.10' || str === '10%' || str === '10') return '02'; // 10%
        if (str === '15' || str === '0.15' || str === '15%') return '03'; // 15%
        if (str === '0' || str === '0.00' || str === '0%') return '00'; // Exento
        return '01'; // Default 7% por seguridad si no se reconoce
    }

    private calculateTotales(items: ItemFactura[]): TotalesSubTotales {
        let neto = 0;
        let itbms = 0;
        let total = 0;

        items.forEach(item => {
            // Asegurar que sumamos números
            neto += Number(item.precioItem || 0);
            itbms += Number(item.valorITBMS || 0);
            total += Number(item.valorTotal || 0);
        });

        return {
            totalPrecioNeto: neto.toFixed(2),
            totalITBMS: itbms.toFixed(2),
            totalISC: '0.00',
            totalMontoGravado: neto.toFixed(2),
            totalDescuento: '0.00',
            totalFactura: total.toFixed(2),
            totalValorRecibido: total.toFixed(2),
            vuelto: '0.00',
            tiempoPago: '1',
            nroItems: String(items.length),
            totalTodosItems: total.toFixed(2),
            listaFormaPago: [{
                formaPagoFact: '02',
                descFormaPago: 'Efectivo',
                valorCuotaPagada: total.toFixed(2)
            }]
        };
    }

    private validateStructure(doc: DocumentoElectronico): string[] {
        const errors: string[] = [];
        if (!doc.listaItems || doc.listaItems.length === 0) errors.push('Documento sin items');
        if (!doc.datosTransaccion) errors.push('Faltan datos de transacción');
        return errors;
    }

    private isPrismaInvoice(input: unknown): input is InvoiceWithRelations {
        return (
            typeof input === 'object' &&
            input !== null &&
            'id' in input &&
            'invoiceNumber' in input &&
            'items' in input &&
            'customer' in input &&
            Array.isArray((input as any).items)
        );
    }
}
