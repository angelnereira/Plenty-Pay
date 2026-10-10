/**
 * Mapper para convertir datos parseados de Excel/XML a formato HKA DocumentoElectronico
 */

import type { ParsedInvoiceData } from '@/lib/utils/xml-parser';
import type { DocumentoElectronico, Cliente, ItemFactura, DatosTransaccion, TotalesSubTotales } from '@/features/hka/model/types/types';

/**
 * Convierte ParsedInvoiceData (del parser) a DocumentoElectronico (formato HKA)
 * 
 * IMPORTANTE: Por defecto, las importaciones de Excel asumen Consumidor Final (02).
 * - RAZON_SOCIAL → nombre del cliente
 * - NUMERO_RUC → cédula de identidad (para CF, se usa como identificador personal)
 * 
 * STRICT VALIDATION: Para Contribuyente (01), se requieren todos los campos de ubicación.
 * NO se usan fallbacks hardcodeados que envíen datos incorrectos a HKA.
 */
export function mapParsedDataToDocumentoElectronico(data: ParsedInvoiceData): DocumentoElectronico {
    // Por defecto, Excel import = Consumidor Final (02)
    // Solo es Contribuyente (01) si explícitamente se indica o si tiene formato RUC empresarial
    // Un RUC empresarial típicamente tiene formato XX-XXXX-XXXX o más de 9 dígitos
    const taxIdValue = data.client.taxId?.trim() || '';
    const isEnterpriseRuc = taxIdValue.length > 9 || taxIdValue.includes('-');

    // Si el cliente tiene un tipoCliente explícito, usarlo. Si no, defaultear a 02 (Consumidor Final)
    const clientType = (data.client as any).tipoClienteFE || (data.client as any).tipoCliente || (isEnterpriseRuc ? '01' : '02');

    // Extended client data (may come from parsed Excel with these fields)
    const extendedClient = data.client as any;

    // Mapear cliente según tipo
    let cliente: Cliente;

    if (clientType === '01') {
        // Contribuyente (01) - STRICT VALIDATION: todos los campos son requeridos
        // Validar campos obligatorios
        const missingFields: string[] = [];
        if (!extendedClient.tipoContribuyente) missingFields.push('tipoContribuyente (1=Natural, 2=Jurídica)');
        if (!taxIdValue) missingFields.push('RUC');
        if (!extendedClient.dv) missingFields.push('DV (Dígito Verificador)');
        if (!data.client.name) missingFields.push('Razón Social');
        if (!data.client.address) missingFields.push('Dirección');
        if (!extendedClient.codigoUbicacion) missingFields.push('Código Ubicación (formato: X-X-X)');
        if (!extendedClient.provincia) missingFields.push('Provincia');
        if (!extendedClient.distrito) missingFields.push('Distrito');
        if (!extendedClient.corregimiento) missingFields.push('Corregimiento');

        if (missingFields.length > 0) {
            throw new Error(
                `Campos obligatorios faltantes en Excel para Contribuyente (01): ${missingFields.join(', ')}. ` +
                `Por favor agregue estas columnas a su archivo Excel o cambie el tipo de cliente a Consumidor Final (02).`
            );
        }

        cliente = {
            tipoClienteFE: '01',
            tipoContribuyente: extendedClient.tipoContribuyente,
            numeroRUC: taxIdValue,
            digitoVerificadorRUC: extendedClient.dv,
            razonSocial: data.client.name,
            direccion: data.client.address,
            codigoUbicacion: extendedClient.codigoUbicacion,
            provincia: extendedClient.provincia,
            distrito: extendedClient.distrito,
            corregimiento: extendedClient.corregimiento,
            pais: data.client.country || 'PA',
            // Solo incluir campos opcionales si tienen valor
            ...(data.client.phone ? { telefono1: data.client.phone } : {}),
            ...(data.client.email ? { correoElectronico1: data.client.email } : {}),
        } as Cliente;
    } else {
        // Consumidor Final (02) - NO FALLBACKS, only include fields with actual values
        cliente = {
            tipoClienteFE: '02',
            razonSocial: data.client.name || 'Consumidor Final',
            pais: data.client.country || 'PA',
        } as Cliente;

        // Only include optional fields if they have real values
        if (taxIdValue) {
            (cliente as any).tipoContribuyente = '1'; // Natural when we have cedula
            (cliente as any).numeroRUC = taxIdValue;
        }
        if (data.client.address?.trim()) {
            (cliente as any).direccion = data.client.address.trim();
        }
        if (data.client.phone?.trim()) {
            (cliente as any).telefono1 = data.client.phone.trim();
        }
        if (data.client.email?.trim()) {
            (cliente as any).correoElectronico1 = data.client.email.trim();
        }
    }

    // Mapear items
    const items: ItemFactura[] = data.items.map(item => {
        const cantidad = item.quantity;
        const precioUnitario = item.unitPrice;
        const descuento = item.discount || 0;
        const precioItem = cantidad * (precioUnitario - descuento);

        // Mapear tasa ITBMS de porcentaje a código
        let tasaITBMS = '01'; // Default 7%
        if (item.taxRate === 0) tasaITBMS = '00';
        else if (item.taxRate === 7) tasaITBMS = '01';
        else if (item.taxRate === 10) tasaITBMS = '02';
        else if (item.taxRate === 15) tasaITBMS = '03';

        const tasaDecimal = item.taxRate / 100;
        const valorITBMS = precioItem * tasaDecimal;
        const valorTotal = precioItem + valorITBMS;

        return {
            descripcion: item.description,
            codigo: (item as any).codigo || 'GEN-01',
            // FIX: Usuario indica que 'und' (minúscula) es el valor correcto.
            unidadMedida: (item as any).unidadMedida || 'und',
            // FIX: HKA requiere formato 'N|1..9|2.6', ej: "1.00"
            cantidad: cantidad.toFixed(2),
            precioUnitario: precioUnitario.toFixed(2),
            precioUnitarioDescuento: descuento.toFixed(2),
            precioItem: precioItem.toFixed(2),
            valorTotal: valorTotal.toFixed(2),
            tasaITBMS: tasaITBMS as any,
            valorITBMS: valorITBMS.toFixed(2),
            // ISC omitido si no aplica
        };
    });

    // Calcular totales
    const totalPrecioNeto = items.reduce((sum, item) => sum + parseFloat(item.precioItem), 0);
    const totalITBMS = items.reduce((sum, item) => sum + parseFloat(item.valorITBMS), 0);
    const totalFactura = totalPrecioNeto + totalITBMS;

    // Mapear forma de pago
    let formaPagoCode = '02'; // Default efectivo
    if (data.paymentMethod) {
        const method = data.paymentMethod.toUpperCase();
        if (method.includes('CREDIT') || method.includes('CREDITO')) formaPagoCode = '01';
        else if (method.includes('CASH') || method.includes('EFECTIVO')) formaPagoCode = '02';
        else if (method.includes('CARD') || method.includes('TARJETA')) formaPagoCode = '03';
        else if (method.includes('TRANSFER') || method.includes('TRANSFERENCIA')) formaPagoCode = '08';
        else if (method.includes('CHECK') || method.includes('CHEQUE')) formaPagoCode = '09';
    }

    // Totales y subtotales (totalISC es condicional, se omite si no aplica)
    const totalesSubTotales = {
        totalPrecioNeto: totalPrecioNeto.toFixed(2),
        totalITBMS: totalITBMS.toFixed(2),
        // totalISC omitido - HKA rechaza "0.00" si no hay ISC
        totalMontoGravado: totalITBMS.toFixed(2),
        totalDescuento: '0.00',
        totalFactura: totalFactura.toFixed(2),
        totalValorRecibido: totalFactura.toFixed(2),
        vuelto: '0.00',
        tiempoPago: '1', // Inmediato
        nroItems: String(items.length),
        totalTodosItems: totalFactura.toFixed(2),
        listaFormaPago: [{
            formaPagoFact: formaPagoCode as any,
            valorCuotaPagada: totalFactura.toFixed(2),
            // FIX: descFormaPago SOLO para '99'. Usar spread para evitar serialización de undefined.
            ...(formaPagoCode === '99' && {
                descFormaPago: (data.paymentMethod || 'Otras formas de pago').padEnd(10, '.')
            })
        }],
    } as TotalesSubTotales;

    // Datos de transacción
    const datosTransaccion: DatosTransaccion = {
        tipoEmision: '01',
        tipoDocumento: '01', // Factura
        numeroDocumentoFiscal: '0000000001', // Placeholder, se asignará después
        puntoFacturacionFiscal: '001',
        fechaEmision: new Date().toISOString(),
        naturalezaOperacion: '01', // Venta
        tipoOperacion: '1', // Salida
        destinoOperacion: '1', // Panamá
        formatoCAFE: '1',
        entregaCAFE: '1',
        envioContenedor: '1',
        procesoGeneracion: '1',
        tipoVenta: '1',
        informacionInteres: data.notes || '',
        cliente,
    };

    // Documento completo
    const documento: DocumentoElectronico = {
        codigoSucursalEmisor: '0000',
        tipoSucursal: '1',
        datosTransaccion,
        listaItems: items,
        totalesSubTotales,
    };

    return documento;
}
