/**
 * Helpers compartidos entre todos los mappers de strategies.
 * Contienen la lógica de construcción de Cliente, Items y Totales
 * que es idéntica para todos los tipos de documento.
 */

import type { Cliente, ItemFactura, TotalesSubTotales, ClienteExtranjero } from '@/features/hka/model/types/types';
import { formatPhoneForDGI } from '@/features/hka/model/services/utils';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';

// ─── Tasas ITBMS ──────────────────────────────────────────────────────────────

export const TASA_ITBMS_MAP: Record<string, number> = {
    '00': 0.00, '01': 0.07, '02': 0.10, '03': 0.15,
};

// ─── buildCliente ─────────────────────────────────────────────────────────────

/** Retorna [cliente HKA, notasCliente] */
export function buildCliente(
    client: ManualInvoiceData['client'],
    tipoClienteFE: string
): [Cliente, string] {
    let cliente: Cliente;
    let notasCliente = '';

    // Contribuyente o Gobierno - requieren RUC y tipoContribuyente
    if (tipoClienteFE === '01' || tipoClienteFE === '03') {
        console.log('[buildCliente] Building Contribuyente cliente with:', {
            tipoClienteFE,
            tipoContribuyente: client.tipoContribuyente,
            numeroRUC: client.numeroRUC,
            digitoVerificadorRUC: client.digitoVerificadorRUC,
            razonSocial: client.razonSocial,
        });

        // VALIDACIÓN ESTRICTA: Para Contribuyente (01) y Gobierno (03), estos campos son OBLIGATORIOS según HKA
        const requiredFields = {
            numeroRUC: client.numeroRUC,
            digitoVerificadorRUC: client.digitoVerificadorRUC,
            razonSocial: client.razonSocial,
            direccion: client.direccion,
            codigoUbicacion: client.codigoUbicacion,
            provincia: client.provincia,
            distrito: client.distrito,
            corregimiento: client.corregimiento,
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([, value]) => !value || value.trim() === '')
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Campos obligatorios faltantes para Contribuyente: ${missingFields.join(', ')}`);
        }

        // VALIDACIÓN DE LONGITUD: HKA tiene requisitos mínimos
        // razonSocial: AN|2..200
        if (client.razonSocial.trim().length < 2) {
            throw new Error('Razón Social debe tener al menos 2 caracteres');
        }
        // direccion: AN|5..100
        if (client.direccion.trim().length < 5) {
            throw new Error('Dirección debe tener al menos 5 caracteres (ej: "Ciudad, Calle...")');
        }

        cliente = {
            tipoClienteFE: tipoClienteFE as '01' | '03',
            tipoContribuyente: client.tipoContribuyente === '1' ? '1' : '2',
            numeroRUC: client.numeroRUC,
            // HKA requires DV to be exactly 2 characters (e.g., "05" not "5")
            digitoVerificadorRUC: client.digitoVerificadorRUC.padStart(2, '0'),
            razonSocial: client.razonSocial,
            direccion: client.direccion,
            codigoUbicacion: client.codigoUbicacion,
            provincia: client.provincia,
            distrito: client.distrito,
            corregimiento: client.corregimiento,
            pais: 'PA',
            // Only include optional fields if they have actual values (avoid $undefined)
            ...(formatPhoneForDGI(client.telefono1) ? { telefono1: formatPhoneForDGI(client.telefono1) } : {}),
            ...(client.correoElectronico1 ? { correoElectronico1: client.correoElectronico1 } : {}),
        };
    }
    // Consumidor Final (02)
    // Según ficha técnica DGI: gDatRec para CF acepta gRucRec (cédula) + dNombRec (nombre)
    // simultáneamente. El DV (digitoVerificadorRUC) debe ser '00' para mantener
    // la secuencia XSD estricta que HKA requiere (tipoContribuyente → numeroRUC → DV → razonSocial).
    else if (tipoClienteFE === '02') {
        const nombreCliente = client.razonSocial?.trim() || '';
        const cedulaCliente = client.numeroRUC?.trim() || '';
        const direccionCliente = client.direccion?.trim() || '';

        console.log('[buildCliente] CF - data.client recibido:', {
            razonSocialRaw: nombreCliente,
            direccionRaw: direccionCliente,
            numeroRUCRaw: cedulaCliente,
        });

        // Estructura base para Consumidor Final
        const clienteBase: Record<string, string | undefined> = {
            tipoClienteFE: '02',
            pais: 'PA',
        };

        // 1. Razón Social (dNombRec): Usar nombre del cliente o default
        clienteBase.razonSocial = nombreCliente && nombreCliente.toUpperCase() !== 'CONSUMIDOR FINAL'
            ? nombreCliente
            : 'CONSUMIDOR FINAL';

        // 2. RUC/Cédula (gRucRec): Si el cliente proporcionó cédula, enviarla
        //    DV='00' es placeholder válido para CF — mantiene la secuencia XSD intacta
        if (cedulaCliente && cedulaCliente !== '000000000') {
            clienteBase.tipoContribuyente = '1'; // Persona Natural
            clienteBase.numeroRUC = cedulaCliente;
            clienteBase.digitoVerificadorRUC = '00'; // CF no usa DV real, '00' mantiene XSD
        } else {
            // Sin cédula: usar genérico si la razón social también es genérica
            if (clienteBase.razonSocial === 'CONSUMIDOR FINAL') {
                clienteBase.tipoContribuyente = '1';
                clienteBase.numeroRUC = '000000000';
                clienteBase.digitoVerificadorRUC = '00';
            }
        }

        // Teléfono (formato DGI: 999-9999 o 9999-9999) y email (opcional)
        const formattedPhone = formatPhoneForDGI(client.telefono1);
        if (formattedPhone) {
            clienteBase.telefono1 = formattedPhone;
        }
        if (client.correoElectronico1?.trim()) {
            clienteBase.correoElectronico1 = client.correoElectronico1.trim();
        }

        if (direccionCliente) {
            clienteBase.direccion = direccionCliente;
        }

        console.log('[buildCliente] Consumidor Final mapeado:', {
            razonSocial: clienteBase.razonSocial,
            direccion: clienteBase.direccion,
            numeroRUC: clienteBase.numeroRUC,
            tipoContribuyente: clienteBase.tipoContribuyente,
        });

        // Construir notas con datos del cliente para CF
        const partes: string[] = [];
        if (nombreCliente && nombreCliente.toUpperCase() !== 'CONSUMIDOR FINAL') {
            partes.push(`Cliente: ${nombreCliente}`);
        }
        if (cedulaCliente && cedulaCliente !== '000000000') {
            partes.push(`Cédula: ${cedulaCliente}`);
        }
        if (partes.length > 0) {
            notasCliente = partes.join(' | ');
        }

        cliente = clienteBase as unknown as Cliente;
    }
    // Extranjero (04)
    else {
        cliente = {
            tipoClienteFE: '04',
            tipoIdentificacion: '01', // Asumimos Pasaporte por defecto si es extranjero en PlentyPay
            nroIdentificacionExtranjero: client.numeroRUC || 'ND',
            razonSocial: client.razonSocial,
            direccion: client.direccion || '',
            telefono1: formatPhoneForDGI(client.telefono1) || undefined,
            correoElectronico1: client.correoElectronico1 || undefined,
            pais: 'PA'
        } as ClienteExtranjero;
    }

    return [cliente, notasCliente];
}

// ─── buildItems ───────────────────────────────────────────────────────────────

export interface BuildItemsOptions {
    forceITBMSZero?: boolean;      // Para Exportación (03) y Zona Franca (08)
    tipoClienteFE?: string;        // Para CPBS de Gobierno (03)
}

export function buildItems(
    items: ManualInvoiceData['items'],
    tipoClienteFE: string,
    options: BuildItemsOptions = {}
): ItemFactura[] {
    return items.map((item, index) => {
        // En este flujo, `precioUnitarioDescuento` representa el precio unitario neto
        // (ya descontado), no el monto del descuento.
        // ⭐ FIX: precioUnitarioDescuento en HKA es el MONTO DEL DESCUENTO, no el precio neto.
        // Usamos aritmética de 2 decimales para que coincida con la validación de HKA (Error 2053).
        const unitPrice = item.precioUnitario;
        const netPrice = item.precioUnitarioDescuento;
        const unitDiscount = Math.max(0, unitPrice - netPrice);

        // HKA valida: precioItem = cantidad * (precioUnitario - precioUnitarioDescuento)
        // Redondeamos los componentes a 2 decimales antes del cálculo final para evitar discrepancias de precisión.
        const unitPriceFixed = Number(unitPrice.toFixed(2));
        const unitDiscountFixed = Number(unitDiscount.toFixed(2));
        const precioItem = item.cantidad * (unitPriceFixed - unitDiscountFixed);

        // Si forceITBMSZero=true → tasaITBMS='00', valorITBMS=0 para todos (Exportación, Zona Franca)
        const tasaITBMSCode: ItemFactura['tasaITBMS'] = options.forceITBMSZero ? '00' : (item.tasaITBMS as ItemFactura['tasaITBMS']);
        const tasaDecimal = options.forceITBMSZero ? 0 : (TASA_ITBMS_MAP[item.tasaITBMS] ?? 0.07);
        const valorITBMS = precioItem * tasaDecimal;
        const valorTotal = precioItem + valorITBMS;

        // Build descripcion - for reembolso items with tercero info, append to descripcion
        let descripcion = item.descripcion;
        if ('rucTercero' in item && item.rucTercero) {
            descripcion = `${item.descripcion} | Tercero: ${item.rucTercero}${item.numeroDocumentoTercero ? ` Fact: ${item.numeroDocumentoTercero}` : ''}`;
        }

        const hkaItem: ItemFactura & { _productId?: string } = {
            descripcion,
            codigo: item.code || `ITEM-${index + 1}`,
            unidadMedida: 'und',
            cantidad: item.cantidad.toFixed(2),
            precioUnitario: unitPriceFixed.toFixed(2),
            // ⭐ El monto del descuento debe estar redondeado a 2 decimales
            precioUnitarioDescuento: unitDiscountFixed.toFixed(2),
            precioItem: precioItem.toFixed(2),
            valorTotal: valorTotal.toFixed(2),
            tasaITBMS: tasaITBMSCode,
            valorITBMS: valorITBMS.toFixed(2)
        };

        // CPBS: Solo se requiere para gobierno (tipoClienteFE=03)
        // o si el usuario lo ingresó explícitamente y es válido.
        if (tipoClienteFE === '03') {
            const cpbsCode = item.cpbsCode && item.cpbsCode.trim() !== '' ? item.cpbsCode : '80141600';
            hkaItem.codigoCPBSAbrev = cpbsCode.substring(0, 2);
            hkaItem.codigoCPBS = cpbsCode;
            hkaItem.unidadMedidaCPBS = item.cpbsUnit || 'und';
        } else if (item.cpbsCode && item.cpbsCode.trim() !== '') {
            hkaItem.codigoCPBSAbrev = item.cpbsCode.substring(0, 2);
            hkaItem.codigoCPBS = item.cpbsCode;
            hkaItem.unidadMedidaCPBS = item.cpbsUnit || 'und';
        }

        // Propagar productId como campo auxiliar (no-fiscal).
        if (item.productId) {
            hkaItem._productId = item.productId;
        }

        return hkaItem;
    });
}

// ─── buildTotales ─────────────────────────────────────────────────────────────

export function buildTotales(
    items: ItemFactura[],
    payment: ManualInvoiceData['payment']
): TotalesSubTotales {
    const totalPrecioNeto = items.reduce((sum, item) => sum + parseFloat(item.precioItem), 0);
    const totalITBMS = items.reduce((sum, item) => sum + parseFloat(item.valorITBMS), 0);
    const totalFactura = totalPrecioNeto + totalITBMS;

    // Totales y subtotales (totalISC es condicional en HKA, se omite si no aplica)
    // totalDescuento se OMITE: los descuentos por-ítem ya están aplicados en
    // precioItem = cantidad × (precioUnitario − precioUnitarioDescuento). El
    // campo totalDescuento es exclusivo de descuentos globales (bonificación,
    // código 13) y, si se informa, requiere listaDescBonificacion.
    return {
        totalPrecioNeto: totalPrecioNeto.toFixed(2),
        totalITBMS: totalITBMS.toFixed(2),
        // totalISC omitido - HKA rechaza "0.00" si no hay ISC
        totalMontoGravado: totalITBMS.toFixed(2),
        totalFactura: totalFactura.toFixed(2),
        totalValorRecibido: totalFactura.toFixed(2),
        vuelto: '0.00',
        tiempoPago: payment.tiempoPago as TotalesSubTotales['tiempoPago'],
        nroItems: String(items.length),
        totalTodosItems: totalFactura.toFixed(2),
        listaFormaPago: [{
            formaPagoFact: payment.formaPagoFact as TotalesSubTotales['listaFormaPago'][0]['formaPagoFact'],
            valorCuotaPagada: totalFactura.toFixed(2),
            // FIX: descFormaPago SOLO para '99'. Usar spread para evitar serialización de undefined.
            ...(payment.formaPagoFact === '99' && {
                descFormaPago: (payment.descFormaPago || 'Otras formas de pago').padEnd(10, '.')
            })
        }]
    } as TotalesSubTotales;
}
