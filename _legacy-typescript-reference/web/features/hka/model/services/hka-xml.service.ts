/**
 * HKA Web Service - Constructor XML SOAP
 *
 * Genera XML SOAP con namespaces exactos requeridos por HKA
 * según documentación oficial HKA 2026
 *
 * Namespaces obligatorios (CRÍTICO - deben ser exactos):
 * - soapenv: http://schemas.xmlsoap.org/soap/envelope/
 * - tem: http://tempuri.org/
 * - ser: http://schemas.datacontract.org/2004/07/Services.ObjComprobante.v1_0
 */

import { create } from 'xmlbuilder2';
import type {
  DatosDocumento,
  DocumentoElectronico,
  ItemFactura,
  TotalesSubTotales,
  Cliente,
  DatosTransaccion,
} from '../types/types';
import { HKA_NAMESPACES } from '../types/types';
import { cleanXMLObject, sanitizeForXML, formatPhoneForDGI } from './utils';

/**
 * Construye el envelope SOAP base con los namespaces requeridos por HKA
 * 
 * @param methodName - Nombre del método SOAP (ej: "Enviar", "EstadoDocumento")
 * @param bodyContent - Contenido del body en formato objeto
 * @returns XML string completo
 */
export function buildSOAPEnvelope(methodName: string, bodyContent: Record<string, unknown>): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': HKA_NAMESPACES.soapenv,
      'xmlns:tem': HKA_NAMESPACES.tem,
      'xmlns:ser': HKA_NAMESPACES.ser,
    })
    .ele('soapenv:Header').up()
    .ele('soapenv:Body')
    .ele(`tem:${methodName}`);

  // Agregar contenido del body
  addObjectToXML(doc, bodyContent);

  return doc.end({ prettyPrint: false });
}

/**
 * Agrega un objeto JavaScript al documento XML recursivamente
 * Maneja correctamente los prefijos de namespace
 */
function addObjectToXML(
  parent: ReturnType<typeof create>,
  obj: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') {
      continue; // REGLA CRÍTICA: No incluir campos vacíos
    }

    // Determinar el prefijo correcto
    // tem: para parámetros de nivel superior
    // ser: para estructuras de datos internas
    const elementPrefix = getElementPrefix(key);
    const elementName = `${elementPrefix}:${key}`;

    if (Array.isArray(value)) {
      // Manejar arrays (ej: listaItems, listaFormaPago)
      const arrayElement = parent.ele(elementName);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const itemElement = arrayElement.ele(getArrayItemName(key));
          addObjectToXML(itemElement, item as Record<string, unknown>);
        }
      }
    } else if (typeof value === 'object') {
      // Manejar objetos anidados
      const childElement = parent.ele(elementName);
      addObjectToXML(childElement, value as Record<string, unknown>);
    } else {
      // Valores primitivos
      parent.ele(elementName).txt(sanitizeForXML(String(value)));
    }
  }
}

/**
 * Determina el prefijo correcto para un elemento según las reglas HKA
 * tem: para parametros de metodo (nivel superior directo bajo el metodo SOAP)
 * ser: para estructuras de datos internas y sus campos
 */
function getElementPrefix(key: string): string {
  // Elementos de nivel superior que usan 'tem' (parametros directos del metodo)
  const temElements = [
    'tokenEmpresa',
    'tokenPassword',
    'documento',
    'datosDocumento',
    'consultarRucDVRequest',
    'motivoAnulacion',
    'correo',
    'cufe',
  ];

  if (temElements.includes(key)) {
    return 'tem';
  }

  // Todos los campos internos de estructuras usan 'ser'
  // Esto incluye campos dentro de datosDocumento como tipoDocumento, codigoSucursalEmisor, etc.
  return 'ser';
}

/**
 * Obtiene el nombre del elemento hijo para arrays
 */
function getArrayItemName(arrayName: string): string {
  const itemNames: Record<string, string> = {
    'listaItems': 'ser:item',
    'listaFormaPago': 'ser:formaPago',
    'listaItemOTI': 'ser:itemOTI',
    'listaTotalOTI': 'ser:totalOTI',
    'listaDocsFiscalReferenciados': 'ser:docFiscalReferenciado',
  };
  return itemNames[arrayName] || 'ser:item';
}

// ============================================
// BUILDERS ESPECÍFICOS POR MÉTODO
// ============================================

/**
 * Construye XML para método Enviar (crear factura)
 * Este es el método más complejo con estructura DocumentoElectronico
 */
export function buildEnviarXML(
  tokenEmpresa: string,
  tokenPassword: string,
  documento: DocumentoElectronico
): string {
  // Construir estructura del documento
  const documentoXML = buildDocumentoElectronicoXML(documento);

  // tipoEmision es parámetro de nivel superior requerido por HKA (además de dentro de datosTransaccion)
  const tipoEmision = documento.datosTransaccion?.tipoEmision || '01';

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': HKA_NAMESPACES.soapenv,
      'xmlns:tem': HKA_NAMESPACES.tem,
      'xmlns:ser': HKA_NAMESPACES.ser,
    })
    .ele('soapenv:Header').up()
    .ele('soapenv:Body')
    .ele('tem:Enviar')
    .ele('tem:tokenEmpresa').txt(tokenEmpresa).up()
    .ele('tem:tokenPassword').txt(tokenPassword).up()
    .ele('tem:tipoEmision').txt(tipoEmision).up()
    .ele('tem:documento');

  // Agregar documento electrónico
  addDocumentoElectronico(doc, documentoXML);

  return doc.end({ prettyPrint: false });
}

/**
 * Construye la estructura del documento electrónico limpia
 */
function buildDocumentoElectronicoXML(doc: DocumentoElectronico): Record<string, unknown> {
  const result: Record<string, unknown> = {
    codigoSucursalEmisor: doc.codigoSucursalEmisor,
    tipoSucursal: doc.tipoSucursal,
    datosTransaccion: buildDatosTransaccionXML(doc.datosTransaccion),
  };

  // gDFRef — Documentos Fiscales Referenciados (obligatorio para NC/ND tipo 04/05)
  if (doc.listaDocsFiscalReferenciados && doc.listaDocsFiscalReferenciados.length > 0) {
    result.listaDocsFiscalReferenciados = doc.listaDocsFiscalReferenciados.map(buildDocFiscalReferenciadoXML);
  }

  // gFExp — Grupo de Exportación (obligatorio cuando destinoOperacion='2')
  if (doc.grupoExportacion) {
    result.grupoExportacion = buildGrupoExportacionXML(doc.grupoExportacion);
  }

  result.listaItems = doc.listaItems.map(buildItemXML);
  result.totalesSubTotales = buildTotalesXML(doc.totalesSubTotales);

  // CRÍTICO: propagar contingenciaCufe al objeto plano para que
  // addDocumentoElectronico pueda construir <ser:usoPosterior><ser:cufe>.
  // cleanXMLObject eliminaría undefined/null pero un string válido pasa.
  if (doc.contingenciaCufe) {
    result.contingenciaCufe = doc.contingenciaCufe;
  }

  if (doc.dId) {
    result.dId = doc.dId;
  }

  return cleanXMLObject(result);
}

/**
 * Construye XML para un Documento Fiscal Referenciado (gDFRef / B60)
 *
 * CRITICAL: Orden XSD estricto:
 * tipoContribuyenteEmis → rucEmis → dvEmis → razonSocialEmis →
 * dFechaDFRef → iTipoDocRef → dCUFERef
 */
function buildDocFiscalReferenciadoXML(ref: import('../types/types').DocumentoFiscalReferenciado): Record<string, unknown> {
  return cleanXMLObject({
    fechaEmisionDocFiscalReferenciado: ref.fechaEmisionDocFiscalReferenciado,
    cufeFEReferenciada: ref.cufeFEReferenciada,
    nroFacturaPapel: ref.nroFacturaPapel,
    nroFacturaImpFiscal: ref.nroFacturaImpFiscal,
  });
}

/**
 * Construye XML para gFExp — Grupo Factura de Exportación (B13)
 *
 * Obligatorio cuando destinoOperacion='2' (tipoDocumento 03).
 * Campos opcionales se omiten si undefined/null (cleanXMLObject los elimina).
 *
 * Orden XSD: cCondEntr → cMoneda → cMonedaDesc → dCambio → dVTotEst → dPuertoEmbarq
 */
function buildGrupoExportacionXML(exp: import('../types/types').GrupoExportacion): Record<string, unknown> {
  return cleanXMLObject({
    cCondEntr: exp.cCondEntr,
    cMoneda: exp.cMoneda,
    cMonedaDesc: exp.cMonedaDesc,
    dCambio: exp.dCambio,
    dVTotEst: exp.dVTotEst,
    dPuertoEmbarq: exp.dPuertoEmbarq,
  });
}

/**
 * Construye XML para datosTransaccion
 */
function buildDatosTransaccionXML(datos: DatosTransaccion): Record<string, unknown> {
  return cleanXMLObject({
    tipoEmision: datos.tipoEmision,
    fechaInicioContingencia: datos.fechaInicioContingencia,
    motivoContingencia: datos.motivoContingencia,
    tipoDocumento: datos.tipoDocumento,
    numeroDocumentoFiscal: datos.numeroDocumentoFiscal,
    puntoFacturacionFiscal: datos.puntoFacturacionFiscal,
    fechaEmision: datos.fechaEmision,
    fechaSalida: datos.fechaSalida,
    naturalezaOperacion: datos.naturalezaOperacion,
    tipoOperacion: datos.tipoOperacion,
    destinoOperacion: datos.destinoOperacion,
    formatoCAFE: datos.formatoCAFE,
    entregaCAFE: datos.entregaCAFE,
    envioContenedor: datos.envioContenedor,
    procesoGeneracion: datos.procesoGeneracion,
    tipoVenta: datos.tipoVenta,
    informacionInteres: datos.informacionInteres,
    cliente: buildClienteXML(datos.cliente),
  });
}

/**
 * Construye XML para cliente según tipoClienteFE
 *
 * CRITICAL: El orden de elementos DEBE coincidir con el XSD de HKA (xs:sequence).
 * Si un elemento aparece fuera de orden, HKA reporta campos como "requerido"
 * porque el validador XSD no los encuentra en la posición esperada.
 *
 * Orden XSD: tipoClienteFE → tipoContribuyente → numeroRUC → digitoVerificadorRUC →
 *   razonSocial → direccion → codigoUbicacion → provincia → distrito → corregimiento →
 *   tipoIdentificacion → nroIdentificacionExtranjero → paisExtranjero →
 *   telefono1 → telefono2 → telefono3 → correoElectronico1 → correoElectronico2 →
 *   correoElectronico3 → pais → paisOtro
 */
function buildClienteXML(cliente: Cliente): Record<string, unknown> {
  const c = cliente as unknown as Record<string, string | undefined>;

  if (cliente.tipoClienteFE === '01' || cliente.tipoClienteFE === '03') {
    // Contribuyente o Gobierno — orden XSD estricto
    return cleanXMLObject({
      tipoClienteFE: c.tipoClienteFE,
      tipoContribuyente: c.tipoContribuyente,
      numeroRUC: c.numeroRUC,
      digitoVerificadorRUC: c.digitoVerificadorRUC,
      razonSocial: c.razonSocial,
      direccion: c.direccion,
      codigoUbicacion: c.codigoUbicacion,
      provincia: c.provincia,
      distrito: c.distrito,
      corregimiento: c.corregimiento,
      telefono1: formatPhoneForDGI(c.telefono1),
      correoElectronico1: c.correoElectronico1,
      correoElectronico2: c.correoElectronico2,
      correoElectronico3: c.correoElectronico3,
      pais: c.pais,
      codigoCPBS: c.codigoCPBS,
    });
  } else if (cliente.tipoClienteFE === '04') {
    // Extranjero — orden XSD estricto
    return cleanXMLObject({
      tipoClienteFE: c.tipoClienteFE,
      razonSocial: c.razonSocial,
      direccion: c.direccion,
      tipoIdentificacion: c.tipoIdentificacion,
      nroIdentificacionExtranjero: c.nroIdentificacionExtranjero,
      paisExtranjero: c.paisExtranjero,
      telefono1: formatPhoneForDGI(c.telefono1),
      correoElectronico1: c.correoElectronico1,
      correoElectronico2: c.correoElectronico2,
      correoElectronico3: c.correoElectronico3,
      pais: c.pais,
      paisOtro: c.paisOtro,
    });
  } else {
    // Consumidor final (02) — orden XSD estricto
    return cleanXMLObject({
      tipoClienteFE: c.tipoClienteFE,
      tipoContribuyente: c.tipoContribuyente,
      numeroRUC: c.numeroRUC,
      digitoVerificadorRUC: c.digitoVerificadorRUC,
      razonSocial: c.razonSocial,
      direccion: c.direccion,
      telefono1: formatPhoneForDGI(c.telefono1),
      correoElectronico1: c.correoElectronico1,
      correoElectronico2: c.correoElectronico2,
      correoElectronico3: c.correoElectronico3,
      pais: c.pais,
    });
  }
}

/**
 * Construye XML para un ítem de factura
 */
/**
 * Construye XML para un ítem de factura
 *
 * CRITICAL: Orden XSD estricto:
 * descripcion → codigo → unidadMedida → cantidad → fechaFabricacion → fechaCaducidad →
 * codigoCPBSAbrev → codigoCPBS → unidadMedidaCPBS → infoItem →
 * precioUnitario → precioUnitarioDescuento → precioItem → precioAcarreo → precioSeguro →
 * valorTotal → codigoGTIN → cantGTINCom → codigoGTINInv → cantGTINComInv →
 * tasaITBMS → valorITBMS → tasaISC → valorISC → listaItemOTI
 */
function buildItemXML(item: ItemFactura): Record<string, unknown> {
  return cleanXMLObject({
    descripcion: item.descripcion,
    codigo: item.codigo,
    unidadMedida: item.unidadMedida,
    cantidad: item.cantidad,
    fechaFabricacion: item.fechaFabricacion,
    fechaCaducidad: item.fechaCaducidad,
    codigoCPBSAbrev: item.codigoCPBSAbrev,
    codigoCPBS: item.codigoCPBS,
    unidadMedidaCPBS: item.unidadMedidaCPBS,
    infoItem: item.infoItem,
    precioUnitario: item.precioUnitario,
    precioUnitarioDescuento: item.precioUnitarioDescuento,
    precioItem: item.precioItem,
    precioAcarreo: item.precioAcarreo,
    precioSeguro: item.precioSeguro,
    valorTotal: item.valorTotal,
    codigoGTIN: (item as unknown as Record<string, string | undefined>).codigoGTIN,
    cantGTINCom: (item as unknown as Record<string, string | undefined>).cantGTINCom,
    codigoGTINInv: (item as unknown as Record<string, string | undefined>).codigoGTINInv,
    cantGTINComInv: (item as unknown as Record<string, string | undefined>).cantGTINComInv,
    tasaITBMS: item.tasaITBMS,
    valorITBMS: item.valorITBMS,
    tasaISC: item.tasaISC,
    valorISC: item.valorISC,
    listaItemOTI: item.listaItemOTI?.map(oti => ({
      tasaOTI: oti.tasaOTI,
      valorTasa: oti.valorTasa,
    })),
  });
}

/**
 * Construye XML para totales y subtotales
 */
/**
 * CRITICAL: Orden XSD estricto:
 * totalPrecioNeto → totalITBMS → totalISC → totalMontoGravado → totalDescuento →
 * totalAcarreoCobrado → valorSeguroCobrado → totalOtrosGastos → totalFactura →
 * totalValorRecibido → vuelto → tiempoPago → nroItems → totalTodosItems →
 * listaDescBonificacion → listaFormaPago → retencion → listaPagoPlazo → listaTotalOTI
 */
function buildTotalesXML(totales: TotalesSubTotales): Record<string, unknown> {
  return cleanXMLObject({
    totalPrecioNeto: totales.totalPrecioNeto,
    totalITBMS: totales.totalITBMS,
    totalISC: totales.totalISC,
    totalMontoGravado: totales.totalMontoGravado,
    totalDescuento: totales.totalDescuento,
    totalAcarreoCobrado: totales.totalAcarreoCobrado,
    valorSeguroCobrado: totales.valorSeguroCobrado,
    totalOtrosGastos: totales.totalOtrosGastos,
    totalFactura: totales.totalFactura,
    totalValorRecibido: totales.totalValorRecibido,
    vuelto: totales.vuelto,
    tiempoPago: totales.tiempoPago,
    nroItems: totales.nroItems,
    totalTodosItems: totales.totalTodosItems,
    listaDescBonificacion: totales.listaDescBonificacion?.map(db => cleanXMLObject({
      tipoDescBonif: db.tipoDescBonif,
      descDescuento: db.descDescuento,
      montoGlobalDescBonificacion: db.montoGlobalDescBonificacion,
    })),
    listaFormaPago: totales.listaFormaPago.map(fp => cleanXMLObject({
      formaPagoFact: fp.formaPagoFact,
      descFormaPago: fp.descFormaPago,
      valorCuotaPagada: fp.valorCuotaPagada,
    })),
    listaPagoPlazo: totales.listaPagoPlazo?.map(pp => cleanXMLObject({
      fechaVenceCuota: pp.fechaVenceCuota,
      valorCuota: pp.valorCuota,
    })),
    listaTotalOTI: totales.listaTotalOTI?.map(oti => ({
      codigoTotalOTI: oti.codigoTotalOTI,
      valorTotalOTI: oti.valorTotalOTI,
    })),
  });
}

/**
 * Agrega documento electrónico al XML usando xmlbuilder2
 */
function addDocumentoElectronico(
  parent: ReturnType<typeof create>,
  documento: Record<string, unknown>
): void {
  // codigoSucursalEmisor
  if (documento.codigoSucursalEmisor) {
    parent.ele('ser:codigoSucursalEmisor').txt(String(documento.codigoSucursalEmisor));
  }

  // tipoSucursal
  if (documento.tipoSucursal) {
    parent.ele('ser:tipoSucursal').txt(String(documento.tipoSucursal));
  }

  // datosTransaccion
  if (documento.datosTransaccion) {
    const datosElement = parent.ele('ser:datosTransaccion');
    addNestedObject(datosElement, documento.datosTransaccion as Record<string, unknown>);
  }

  // listaDocsFiscalReferenciados (gDFRef / B60) — NC/ND tipo 04/05
  if (documento.listaDocsFiscalReferenciados && Array.isArray(documento.listaDocsFiscalReferenciados)) {
    const listaRefElement = parent.ele('ser:listaDocsFiscalReferenciados');
    for (const ref of documento.listaDocsFiscalReferenciados as Record<string, unknown>[]) {
      const refElement = listaRefElement.ele('ser:docFiscalReferenciado');
      addNestedObject(refElement, ref);
    }
  }

  // grupoExportacion (gFExp / B13) — obligatorio cuando destinoOperacion='2' (tipoDocumento 03)
  // BUG FIX: este bloque faltaba completamente; facturas de exportación fallaban sin este grupo.
  if (documento.grupoExportacion && typeof documento.grupoExportacion === 'object') {
    const expElement = parent.ele('ser:grupoExportacion');
    addNestedObject(expElement, documento.grupoExportacion as Record<string, unknown>);
  }

  // listaItems
  if (documento.listaItems && Array.isArray(documento.listaItems)) {
    const listaElement = parent.ele('ser:listaItems');
    for (const item of documento.listaItems as Record<string, unknown>[]) {
      const itemElement = listaElement.ele('ser:item');
      addNestedObject(itemElement, item);
    }
  }

  // totalesSubTotales
  if (documento.totalesSubTotales) {
    const totalesElement = parent.ele('ser:totalesSubTotales');
    addTotalesSubTotales(totalesElement, documento.totalesSubTotales as Record<string, unknown>);
  }

  // usoPosterior — obligatorio para tipoEmision=02/03/04
  // HKA exige cufe NO vacío dentro de usoPosterior (código 109 si está vacío).
  // El CUFE local se pre-genera en mapInvoiceToHKA y se almacena en contingenciaCufe.
  // Si por alguna razón no se generó (RUC no configurado), se omite el bloque
  // entero para evitar el error 109 — HKA lo rechazará de otra forma pero con
  // un mensaje más informativo que "cufe requerido".
  const datosTransaccion = documento.datosTransaccion as Record<string, unknown> | undefined;
  const tipoEmision = datosTransaccion?.tipoEmision as string | undefined;
  const contingenciaCufe = (documento as Record<string, unknown>).contingenciaCufe as string | undefined;
  if ((tipoEmision === '02' || tipoEmision === '03' || tipoEmision === '04') && contingenciaCufe) {
    parent.ele('ser:usoPosterior').ele('ser:cufe').txt(contingenciaCufe);
  }

  // dId — Identificador para firma electrónica (FE + CUFE)
  if (documento.dId) {
    parent.ele('ser:dId').txt(String(documento.dId));
  }
}

/**
 * Agrega un objeto anidado al XML con prefijo 'ser'
 */
function addNestedObject(
  parent: ReturnType<typeof create>,
  obj: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;

    if (key === 'cliente' && typeof value === 'object') {
      const clienteElement = parent.ele('ser:cliente');
      addNestedObject(clienteElement, value as Record<string, unknown>);
    } else if (key === 'informacionInteres' && typeof value === 'string') {
      // La DGI permite CDATA en este campo para encapsular HTML/texto libre.
      // No usar sanitizeForXML aquí — dejar el contenido tal cual dentro de CDATA.
      parent.ele('ser:informacionInteres').dat(value);
    } else if (key === 'listaItemOTI' && Array.isArray(value)) {
      const listaElement = parent.ele('ser:listaItemOTI');
      for (const oti of value as Record<string, unknown>[]) {
        const otiElement = listaElement.ele('ser:itemOTI');
        addNestedObject(otiElement, oti);
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const childElement = parent.ele(`ser:${key}`);
      addNestedObject(childElement, value as Record<string, unknown>);
    } else if (!Array.isArray(value)) {
      parent.ele(`ser:${key}`).txt(sanitizeForXML(String(value)));
    }
  }
}

/**
 * Agrega totalesSubTotales con manejo especial de listaFormaPago
 */
function addTotalesSubTotales(
  parent: ReturnType<typeof create>,
  totales: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(totales)) {
    if (value === undefined || value === null || value === '') continue;

    if (key === 'listaFormaPago' && Array.isArray(value)) {
      const listaElement = parent.ele('ser:listaFormaPago');
      for (const fp of value as Record<string, unknown>[]) {
        const fpElement = listaElement.ele('ser:formaPago');
        addNestedObject(fpElement, fp);
      }
    } else if (key === 'listaPagoPlazo' && Array.isArray(value)) {
      const listaElement = parent.ele('ser:listaPagoPlazo');
      for (const pp of value as Record<string, unknown>[]) {
        const ppElement = listaElement.ele('ser:pagoPlazo');
        addNestedObject(ppElement, pp);
      }
    } else if (key === 'listaTotalOTI' && Array.isArray(value)) {
      const listaElement = parent.ele('ser:listaTotalOTI');
      for (const oti of value as Record<string, unknown>[]) {
        const otiElement = listaElement.ele('ser:totalOTI');
        addNestedObject(otiElement, oti);
      }
    } else if (key === 'listaDescBonificacion' && Array.isArray(value)) {
      // BUG FIX: listaDescBonificacion era silenciosamente descartada por la
      // condición !Array.isArray(value). Obligatoria cuando totalDescuento > 0.
      const listaElement = parent.ele('ser:listaDescBonificacion');
      for (const db of value as Record<string, unknown>[]) {
        const dbElement = listaElement.ele('ser:descuentoBonificacion');
        addNestedObject(dbElement, db);
      }
    } else if (!Array.isArray(value)) {
      parent.ele(`ser:${key}`).txt(sanitizeForXML(String(value)));
    }
  }
}

// ============================================
// BUILDERS PARA OTROS MÉTODOS
// ============================================

/**
 * Construye XML para método EstadoDocumento
 */
export function buildEstadoDocumentoXML(
  tokenEmpresa: string,
  tokenPassword: string,
  datosDocumento: DatosDocumento
): string {
  return buildSOAPEnvelope('EstadoDocumento', {
    tokenEmpresa,
    tokenPassword,
    datosDocumento: cleanXMLObject(datosDocumento as unknown as Record<string, unknown>),
  });
}

/**
 * Construye XML para método AnulacionDocumento
 */
export function buildAnulacionDocumentoXML(
  tokenEmpresa: string,
  tokenPassword: string,
  motivoAnulacion: string,
  datosDocumento: DatosDocumento
): string {
  return buildSOAPEnvelope('AnulacionDocumento', {
    tokenEmpresa,
    tokenPassword,
    motivoAnulacion,
    datosDocumento: cleanXMLObject(datosDocumento as unknown as Record<string, unknown>),
  });
}

/**
 * Construye XML para método DescargaXML
 */
export function buildDescargaXMLRequest(
  tokenEmpresa: string,
  tokenPassword: string,
  datosDocumento: DatosDocumento
): string {
  return buildSOAPEnvelope('DescargaXML', {
    tokenEmpresa,
    tokenPassword,
    datosDocumento: cleanXMLObject(datosDocumento as unknown as Record<string, unknown>),
  });
}

/**
 * Construye XML para método DescargaPDF
 */
export function buildDescargaPDFXML(
  tokenEmpresa: string,
  tokenPassword: string,
  datosDocumento: DatosDocumento
): string {
  return buildSOAPEnvelope('DescargaPDF', {
    tokenEmpresa,
    tokenPassword,
    datosDocumento: cleanXMLObject(datosDocumento as unknown as Record<string, unknown>),
  });
}

/**
 * Construye XML para método FoliosRestantes
 * Este es el método más simple - solo requiere tokens
 */
export function buildFoliosRestantesXML(
  tokenEmpresa: string,
  tokenPassword: string
): string {
  return buildSOAPEnvelope('FoliosRestantes', {
    tokenEmpresa,
    tokenPassword,
  });
}

/**
 * Construye XML para método EnvioCorreo
 */
export function buildEnvioCorreoXML(
  tokenEmpresa: string,
  tokenPassword: string,
  datosDocumento: DatosDocumento,
  correo: string
): string {
  return buildSOAPEnvelope('EnvioCorreo', {
    tokenEmpresa,
    tokenPassword,
    datosDocumento: cleanXMLObject(datosDocumento as unknown as Record<string, unknown>),
    correo,
  });
}

/**
 * Construye XML para método RastreoCorreo
 * Este método usa CUFE en lugar de datosDocumento
 */
export function buildRastreoCorreoXML(
  tokenEmpresa: string,
  tokenPassword: string,
  cufe: string
): string {
  return buildSOAPEnvelope('RastreoCorreo', {
    tokenEmpresa,
    tokenPassword,
    cufe,
  });
}

/**
 * Construye XML para método ConsultarRucDV
 * Usa estructura especial consultarRucDVRequest
 */
export function buildConsultarRucDVXML(
  tokenEmpresa: string,
  tokenPassword: string,
  tipoRuc: '1' | '2',
  ruc: string
): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': HKA_NAMESPACES.soapenv,
      'xmlns:tem': HKA_NAMESPACES.tem,
      'xmlns:ser': HKA_NAMESPACES.ser,
    })
    .ele('soapenv:Header').up()
    .ele('soapenv:Body')
    .ele('tem:ConsultarRucDV')
    .ele('tem:consultarRucDVRequest')
    .ele('ser:tokenEmpresa').txt(tokenEmpresa).up()
    .ele('ser:tokenPassword').txt(tokenPassword).up()
    .ele('ser:tipoRuc').txt(tipoRuc).up()
    .ele('ser:ruc').txt(ruc);

  return doc.end({ prettyPrint: false });
}

