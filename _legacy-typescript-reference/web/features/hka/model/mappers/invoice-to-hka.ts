/**
 * HKA Web Service - Mapper Invoice to HKA
 * 
 * Transforma una factura de Prisma (Invoice + Items + Customer) 
 * a la estructura DocumentoElectronico requerida por HKA
 * según HKA_Documentacion_Completa.md
 */

import type { Invoice, InvoiceItem, Customer } from '@prisma/client';
import type {
  DocumentoElectronico,
  DatosTransaccion,
  Cliente,
  ClienteContribuyente,
  ClienteConsumidorFinal,
  ClienteExtranjero,
  ItemFactura,
  TotalesSubTotales,
  FormaPagoFactura,
  HKAConfig,
  TipoClienteFE,
  TipoDocumento,
  NaturalezaOperacion,
  TasaITBMS,
  TiempoPago,
  TipoVenta,
} from '../types/types';
import {
  padLeft,
  formatDecimal,
  formatDateISO8601,
  cleanXMLObject,
  formatPhoneForDGI,
  mapPaymentMethodToHKA,
  mapDocumentTypeToHKA,
  mapReceiverTypeToHKA,
  extractInvoiceNumber,
  calcularPrecioItem,
  calcularITBMS,
  calcularValorTotal,
  roundToTwo,
  percentageToTaxCode,
} from '../services/utils';

/**
 * Invoice con relaciones cargadas
 */
export interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[];
  customer: Customer | null;
}

/**
 * Opciones de mapeo
 */
export interface MapperOptions {
  /** Forzar tipo de venta (por defecto se deduce) */
  tipoVenta?: TipoVenta;
  /** Información adicional de interés */
  informacionInteres?: string;
  /** Forzar naturaleza de operación */
  naturalezaOperacion?: NaturalezaOperacion;
}

import { HKALogger } from '../services/logger';

/**
 * Mapea una factura de Prisma al formato DocumentoElectronico de HKA
 * 
 * @param invoice - Factura de Prisma con items y customer
 * @param config - Configuración HKA del cliente
 * @param options - Opciones adicionales de mapeo
 * @returns DocumentoElectronico listo para enviar a HKA
 * 
 * @example
 * const documento = mapInvoiceToHKA(invoice, config);
 * const response = await enviarFactura(config, documento);
 */
export function mapInvoiceToHKA(
  invoice: InvoiceWithRelations,
  config: HKAConfig,
  options: MapperOptions = {}
): DocumentoElectronico {
  // Validar que tiene items
  const mapperLogger = new HKALogger();
  mapperLogger.log({
    level: 'DEBUG',
    method: 'mapInvoiceToHKA',
    timestamp: new Date(),
    metadata: {
      invoiceId: invoice.id,
      hasItems: !!invoice.items,
      itemsLength: invoice.items?.length,
    }
  });

  if (!invoice.items || invoice.items.length === 0) {
    mapperLogger.log({
      level: 'ERROR',
      method: 'mapInvoiceToHKA',
      timestamp: new Date(),
      error: { type: 'VALIDATION', message: 'Factura sin items' },
      metadata: { invoiceId: invoice.id }
    });
    throw new Error('La factura debe tener al menos un ítem');
  }

  // Mapear items y calcular totales
  const itemsHKA = mapItems(invoice.items, invoice);
  mapperLogger.log({
    level: 'DEBUG',
    method: 'mapInvoiceToHKA',
    timestamp: new Date(),
    metadata: { action: 'Items mapeados', count: itemsHKA.length }
  });

  const totales = calculateTotales(invoice, itemsHKA);

  // Mapear cliente
  const cliente = mapCliente(invoice, config);

  // Construir datos de transacción
  const datosTransaccion = buildDatosTransaccion(invoice, config, cliente, options);

  // Construir documento completo
  const documento: DocumentoElectronico = {
    codigoSucursalEmisor: config.branchCode,
    tipoSucursal: config.tipoSucursal,
    datosTransaccion,
    listaItems: itemsHKA,
    totalesSubTotales: {
      ...totales,
      listaFormaPago: buildFormasPago(invoice),
    },
  };

  mapperLogger.log({
    level: 'DEBUG',
    method: 'mapInvoiceToHKA',
    timestamp: new Date(),
    metadata: { action: 'Documento pre-clean', hasListaItems: !!documento.listaItems, listaItemsLength: documento.listaItems?.length }
  });

  // Limpiar campos vacíos (REGLA CRÍTICA HKA)
  const cleaned = cleanXMLObject(documento as unknown as Record<string, unknown>) as unknown as DocumentoElectronico;

  mapperLogger.log({
    level: 'DEBUG',
    method: 'mapInvoiceToHKA',
    timestamp: new Date(),
    metadata: { action: 'Documento post-clean', hasListaItems: !!cleaned.listaItems, listaItemsLength: cleaned.listaItems?.length }
  });

  return cleaned;
}

/**
 * Construye los datos de transacción
 */
function buildDatosTransaccion(
  invoice: InvoiceWithRelations,
  config: HKAConfig,
  cliente: Cliente,
  options: MapperOptions
): DatosTransaccion {
  // Validar que ya tiene número asignado (no DRAFT-)
  if (!invoice.invoiceNumber || invoice.invoiceNumber.startsWith('DRAFT-')) {
    throw new Error(
      'Invoice must have a valid numeroDocumentoFiscal. ' +
      'The orchestrator assigns it in ASSIGN_DOCUMENT_NUMBER phase before calling the mapper.'
    );
  }

  // Obtener número de documento fiscal formateado
  const numeroDocFiscal = extractInvoiceNumber(invoice.invoiceNumber);

  // Determinar naturaleza de operación
  const naturalezaOperacion = options.naturalezaOperacion ||
    determineNaturalezaOperacion(invoice);

  // Determinar tipo de venta
  const tipoVenta = options.tipoVenta || '1'; // Default: Giro de negocio

  const transaccion: DatosTransaccion = {
    tipoEmision: config.tipoEmision,
    tipoDocumento: mapDocumentTypeToHKA(invoice.documentType) as TipoDocumento,
    numeroDocumentoFiscal: padLeft(numeroDocFiscal, 10),
    puntoFacturacionFiscal: config.puntoFacturacionFiscal,
    fechaEmision: formatDateISO8601(invoice.issueDate),
    naturalezaOperacion,
    tipoOperacion: '1', // Salida/venta
    destinoOperacion: config.destinoOperacion,
    formatoCAFE: config.formatoCAFE,
    entregaCAFE: config.entregaCAFE,
    envioContenedor: config.envioContenedor,
    procesoGeneracion: config.procesoGeneracion,
    tipoVenta,
    cliente,
  };

  // Agregar información de interés si existe
  if (options.informacionInteres || invoice.notes) {
    transaccion.informacionInteres = options.informacionInteres || invoice.notes || undefined;
  }

  // Si hay fecha de salida/entrega
  if (invoice.deliveryDate) {
    transaccion.fechaSalida = formatDateISO8601(invoice.deliveryDate);
  }

  return transaccion;
}

/**
 * Mapea el cliente según su tipo
 * 
 * STRICT VALIDATION for Contribuyente (01) and Gobierno (03):
 * - tipoContribuyente MUST come from customer.rucType (no fallback)
 * - Location fields MUST exist
 * 
 * For Consumidor Final (02): only include fields with actual values
 */
function mapCliente(
  invoice: InvoiceWithRelations,
  config: HKAConfig
): Cliente {
  const tipoClienteFE = mapReceiverTypeToHKA(invoice.receiverType) as TipoClienteFE;
  const customer = invoice.customer;

  // País según destino de operación
  const pais = config.destinoOperacion === '1' ? 'PA' : 'ZZ';

  // Base común a todos los tipos
  const baseCliente = {
    tipoClienteFE,
    pais,
    telefono1: formatPhoneForDGI(invoice.receiverPhone || customer?.phone),
    correoElectronico1: invoice.receiverEmail || customer?.email || undefined,
  };

  // Contribuyente (01) o Gobierno (03) - STRICT VALIDATION
  if (tipoClienteFE === '01' || tipoClienteFE === '03') {
    // CRITICAL: tipoContribuyente MUST be provided, no default allowed
    const tipoContribuyente = customer?.rucType;
    if (!tipoContribuyente || (tipoContribuyente !== '1' && tipoContribuyente !== '2')) {
      throw new Error(
        `tipoContribuyente es requerido para Contribuyente/Gobierno. ` +
        `Valor recibido: "${tipoContribuyente}". Debe ser "1" (Natural) o "2" (Jurídica). ` +
        `Customer ID: ${customer?.id || 'N/A'}`
      );
    }

    // Validate required location fields
    const locationCode = customer?.locationCode || config.locationCode;
    const provincia = customer?.province || config.provincia;
    const distrito = customer?.district || config.distrito;
    const corregimiento = customer?.corregimiento || config.corregimiento;

    if (!locationCode) {
      throw new Error('codigoUbicacion es requerido para Contribuyente/Gobierno');
    }
    if (!provincia || !distrito || !corregimiento) {
      throw new Error('provincia, distrito y corregimiento son requeridos para Contribuyente/Gobierno');
    }

    const contrib: ClienteContribuyente = {
      ...baseCliente,
      tipoClienteFE: tipoClienteFE as '01' | '03',
      tipoContribuyente: tipoContribuyente as '1' | '2',
      numeroRUC: invoice.receiverRuc || customer?.ruc || '',
      digitoVerificadorRUC: invoice.receiverDv || customer?.dv || '',
      razonSocial: invoice.receiverName || customer?.name || '',
      direccion: invoice.receiverAddress || customer?.address || '',
      codigoUbicacion: locationCode,
      provincia,
      distrito,
      corregimiento,
    };

    // Si es gobierno, agregar código CPBS si existe
    if (tipoClienteFE === '03' && customer?.codigoCPBS) {
      contrib.codigoCPBS = customer.codigoCPBS;
    }

    return contrib;
  }

  // Extranjero (04) - NO enviar RUC ni ubicación
  if (tipoClienteFE === '04') {
    const extranjero: ClienteExtranjero = {
      ...baseCliente,
      tipoClienteFE: '04',
      tipoIdentificacion: '01', // Pasaporte por defecto
      nroIdentificacionExtranjero: invoice.receiverRuc || '',
      paisExtranjero: customer?.countryCode !== 'PA' ? customer?.countryCode : undefined,
    };
    return extranjero;
  }

  // Consumidor final (02) - incluir nombre y cédula si están disponibles
  // Según ficha técnica DGI: gDatRec acepta gRucRec (cédula) + dNombRec (nombre) para CF
  const consumidor: ClienteConsumidorFinal = {
    ...baseCliente,
    tipoClienteFE: '02',
  };

  // Nombre del receptor (dNombRec)
  if (invoice.receiverName?.trim()) {
    consumidor.razonSocial = invoice.receiverName.trim();
  }

  // Cédula del receptor (gRucRec): cuando está presente, incluir tipoContribuyente y DV
  // para mantener la secuencia XSD que HKA requiere
  if (invoice.receiverRuc?.trim()) {
    consumidor.tipoContribuyente = '1'; // Persona Natural
    consumidor.numeroRUC = invoice.receiverRuc.trim();
    consumidor.digitoVerificadorRUC = invoice.receiverDv?.trim() || '00'; // '00' placeholder para CF
  }

  return consumidor;
}

/**
 * Mapea los items de la factura
 */
function mapItems(
  items: InvoiceItem[],
  invoice: InvoiceWithRelations
): ItemFactura[] {
  const mapped = items.map(item => mapSingleItem(item, invoice));
  return mapped;
}

/**
 * Mapea un item individual
 */
function mapSingleItem(
  item: InvoiceItem,
  invoice: InvoiceWithRelations
): ItemFactura {
  // Convertir valores de Prisma (Decimal) a number
  const cantidad = Number(item.quantity);
  const precioUnitario = Number(item.unitPrice);
  const descuento = Number(item.discount || 0);
  const taxRate = Number(item.taxRate || 7);

  // Calcular valores según fórmulas HKA
  const precioItem = roundToTwo(calcularPrecioItem(cantidad, precioUnitario, descuento / cantidad));
  const tasaITBMS = percentageToTaxCode(taxRate) as TasaITBMS;
  const valorITBMS = roundToTwo(calcularITBMS(precioItem, tasaITBMS));
  const valorTotal = roundToTwo(calcularValorTotal(precioItem, valorITBMS));

  const itemHKA: ItemFactura = {
    descripcion: item.description,
    codigo: item.code || undefined,
    unidadMedida: item.unit || 'UND',
    cantidad: formatDecimal(cantidad, 2),
    precioUnitario: formatDecimal(precioUnitario, 2),
    precioUnitarioDescuento: formatDecimal(descuento / cantidad, 2),
    precioItem: formatDecimal(precioItem, 2),
    valorTotal: formatDecimal(valorTotal, 2),
    tasaITBMS,
    valorITBMS: formatDecimal(valorITBMS, 2),
  };

  // Agregar campos CPBS si el cliente es gobierno (obligatorios) o si están presentes
  const isGovernment = mapReceiverTypeToHKA(invoice.receiverType) === '03';
  if (isGovernment) {
    const cpbsCode = item.cpbsCode && item.cpbsCode.trim() !== '' ? item.cpbsCode : '80141600';
    itemHKA.codigoCPBSAbrev = cpbsCode.substring(0, 2);
    itemHKA.codigoCPBS = cpbsCode;
    itemHKA.unidadMedidaCPBS = item.cpbsUnit || item.unit || 'und';
  } else if (item.cpbsCode && item.cpbsCode.trim() !== '') {
    itemHKA.codigoCPBSAbrev = item.cpbsCode.substring(0, 2);
    itemHKA.codigoCPBS = item.cpbsCode;
    itemHKA.unidadMedidaCPBS = item.cpbsUnit || item.unit || 'und';
  }

  return itemHKA;
}

/**
 * Calcula los totales de la factura
 */
function calculateTotales(
  invoice: InvoiceWithRelations,
  itemsHKA: ItemFactura[]
): Omit<TotalesSubTotales, 'listaFormaPago'> {
  // Sumar desde los items ya calculados
  let totalPrecioNeto = 0;
  let totalITBMS = 0;
  let totalValorItems = 0;

  for (const item of itemsHKA) {
    totalPrecioNeto += parseFloat(item.precioItem);
    totalITBMS += parseFloat(item.valorITBMS);
    totalValorItems += parseFloat(item.valorTotal);
  }

  // Redondear totales
  totalPrecioNeto = roundToTwo(totalPrecioNeto);
  totalITBMS = roundToTwo(totalITBMS);
  totalValorItems = roundToTwo(totalValorItems);

  const totalFactura = roundToTwo(Number(invoice.total));

  // Determinar tiempo de pago
  const tiempoPago = determineTiempoPago(invoice);

  // totalDescuento se OMITE: los descuentos por-ítem ya están aplicados en
  // precioItem. El campo totalDescuento corresponde sólo a descuentos
  // globales (bonificación, código 13) y, si se informa, requiere
  // listaDescBonificacion. invoice.discount aquí refleja la suma de
  // descuentos por ítem, no un descuento global, por lo que no debe enviarse.
  return {
    totalPrecioNeto: formatDecimal(totalPrecioNeto, 2),
    totalITBMS: formatDecimal(totalITBMS, 2),
    // totalISC: '0.00', // Removed: HKA error "El campo totalISC no debe ser informado" if 0
    totalMontoGravado: formatDecimal(totalITBMS, 2),
    totalFactura: formatDecimal(totalFactura, 2),
    totalValorRecibido: formatDecimal(totalFactura, 2),
    tiempoPago,
    nroItems: String(itemsHKA.length),
    totalTodosItems: formatDecimal(totalValorItems, 2),
  };
}

/**
 * Construye las formas de pago
 */
function buildFormasPago(invoice: InvoiceWithRelations): FormaPagoFactura[] {
  const formaPagoCode = mapPaymentMethodToHKA(invoice.paymentMethod);
  const totalFactura = roundToTwo(Number(invoice.total));

  const formaPago: FormaPagoFactura = {
    formaPagoFact: formaPagoCode as FormaPagoFactura['formaPagoFact'],
    valorCuotaPagada: formatDecimal(totalFactura, 2),
  };

  // Si es "Otro" (99), agregar descripción
  if (formaPagoCode === '99') {
    formaPago.descFormaPago = invoice.paymentMethod || 'Otro';
  }

  return [formaPago];
}

/**
 * Determina la naturaleza de operación basado en el tipo de documento
 */
function determineNaturalezaOperacion(invoice: InvoiceWithRelations): NaturalezaOperacion {
  switch (invoice.documentType) {
    case 'FACTURA_EXPORTACION':
      return '02'; // Exportación
    case 'NOTA_CREDITO':
      return '11'; // Devolución
    case 'NOTA_DEBITO':
      return '01'; // Venta
    default:
      return '01'; // Venta
  }
}

/**
 * Determina el tiempo de pago
 */
function determineTiempoPago(invoice: InvoiceWithRelations): TiempoPago {
  const paymentTerm = invoice.paymentTerm?.toUpperCase() || 'CASH';

  if (paymentTerm === 'CASH' || paymentTerm === 'CONTADO') {
    return '1'; // Inmediato
  }
  if (paymentTerm === 'CREDIT' || paymentTerm === 'CREDITO') {
    return '2'; // A plazo
  }
  return '1'; // Default: Inmediato
}

/**
 * Valida que una factura tenga todos los datos requeridos para HKA
 */
export function validateInvoiceForHKA(
  invoice: InvoiceWithRelations
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar items
  if (!invoice.items || invoice.items.length === 0) {
    errors.push('La factura debe tener al menos un ítem');
  }

  // Validar número de factura
  if (!invoice.invoiceNumber) {
    errors.push('El número de factura es requerido');
  }

  // Validar datos del receptor según tipo
  const tipoCliente = mapReceiverTypeToHKA(invoice.receiverType);

  if (tipoCliente === '01' || tipoCliente === '03') {
    // Contribuyente o Gobierno requieren RUC y DV
    if (!invoice.receiverRuc && !invoice.customer?.ruc) {
      errors.push('El RUC del receptor es requerido para contribuyentes');
    }
    if (!invoice.receiverDv && !invoice.customer?.dv) {
      errors.push('El DV del receptor es requerido para contribuyentes');
    }
    if (!invoice.receiverName && !invoice.customer?.name) {
      errors.push('El nombre/razón social del receptor es requerido');
    }
  }

  // Gobierno requiere CPBS en todos los items
  if (tipoCliente === '03' && invoice.items) {
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      if (!item.cpbsCode) {
        errors.push(`Item ${i + 1}: El código CPBS es obligatorio para facturas a Gobierno`);
      }
      if (!item.cpbsUnit) {
        errors.push(`Item ${i + 1}: La unidad de medida CPBS es obligatoria para facturas a Gobierno`);
      }
    }
  }

  // Validar totales
  if (Number(invoice.total) <= 0) {
    errors.push('El total de la factura debe ser mayor a 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

