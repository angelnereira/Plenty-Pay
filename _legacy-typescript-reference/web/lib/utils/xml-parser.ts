/**
 * Parser de XML para importar facturas
 * Soporta múltiples formatos de XML de facturación electrónica
 */

import { XMLParser } from "fast-xml-parser"

export interface ParsedInvoiceData {
  // Cliente
  client: {
    name: string
    taxId: string
    dv?: string
    email?: string
    phone?: string
    address: string
    city?: string
    country?: string
  }

  // Items
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
    discount: number
  }>

  // Información adicional
  notes?: string
  paymentMethod?: string
  issueDate?: Date
  dueDate?: Date
}

export class InvoiceXMLParser {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false, // Cambiar a false para más control
      trimValues: true,
      parseTagValue: false, // No auto-convertir valores
      stopNodes: [],
      processEntities: true,
      htmlEntities: false,
    })
  }

  /**
   * Parsear XML y extraer datos de factura
   */
  async parse(xmlContent: string): Promise<ParsedInvoiceData> {
    try {
      // Validación previa
      if (!xmlContent || xmlContent.trim().length === 0) {
        throw new Error("El contenido XML está vacío")
      }

      // Limpiar BOM (Byte Order Mark) si existe
      let cleaned = xmlContent
      if (cleaned.charCodeAt(0) === 0xFEFF) {
        cleaned = cleaned.slice(1)
      }

      // Intentar parsear
      let parsed
      try {
        parsed = this.parser.parse(cleaned)
      } catch (parseError: any) {
        throw new Error(`Error al parsear el XML: ${parseError.message}. Verifica que sea un archivo XML válido.`)
      }

      // Verificar que se parseó algo
      if (!parsed || typeof parsed !== 'object') {
        throw new Error("El XML no pudo ser parseado correctamente")
      }

      // Detectar formato del XML
      if (parsed.rFE) {
        // Formato FEL de Panamá
        return this.parseFELPanama(parsed.rFE)
      } else if (parsed.Invoice || parsed.invoice) {
        // Formato genérico
        return this.parseGenericInvoice(parsed.Invoice || parsed.invoice)
      } else if (parsed["cfdi:Comprobante"]) {
        // Formato CFDI México
        return this.parseCFDI(parsed["cfdi:Comprobante"])
      } else {
        // Listar elementos raíz encontrados
        const rootElements = Object.keys(parsed).join(", ")
        throw new Error(
          `Formato de XML no reconocido. Elementos raíz: ${rootElements}. ` +
          `Formatos soportados: rFE, Invoice, cfdi:Comprobante`
        )
      }
    } catch (error: any) {
      // Re-lanzar con mensaje más claro
      if (error.message.includes("Error al parsear XML")) {
        throw error
      }
      throw new Error(`Error al procesar XML: ${error.message}`)
    }
  }

  /**
   * Parsear formato FEL de Panamá
   */
  private parseFELPanama(rFE: any): ParsedInvoiceData {
    const receptor = rFE.dRec || {}
    const items = Array.isArray(rFE.dItems?.dItem)
      ? rFE.dItems.dItem
      : [rFE.dItems?.dItem].filter(Boolean)

    return {
      client: {
        name: receptor.dNombre || "",
        taxId: receptor.dRuc || "",
        email: receptor.dCorreo || "",
        phone: receptor.dTelefono || "",
        address: receptor.dDireccion || "",
        city: receptor.dCiudad || "Panamá",
        country: receptor.dPais || "PA",
      },
      items: items.map((item: any, index: number) => ({
        description: item.dDescItem || `Item ${index + 1}`,
        quantity: parseFloat(item.dCantItem || "1"),
        unitPrice: parseFloat(item.dPrecioItem || "0"),
        taxRate: parseFloat(item.dTasaItbms || "7"),
        discount: 0, // El formato FEL no incluye descuento por item
      })),
      notes: rFE.dInfo?.dTexto || "",
      paymentMethod: this.mapPaymentMethodFromCode(rFE.dTot?.dFormaPago || "01"),
    }
  }

  /**
   * Parsear formato genérico de factura
   */
  private parseGenericInvoice(invoice: any): ParsedInvoiceData {
    const customer = invoice.Customer || invoice.customer || {}
    const items = Array.isArray(invoice.Items?.Item || invoice.items?.item)
      ? (invoice.Items?.Item || invoice.items?.item)
      : [invoice.Items?.Item || invoice.items?.item].filter(Boolean)

    return {
      client: {
        name: customer.Name || customer.name || "",
        taxId: customer.TaxID || customer.taxId || customer.RUC || customer.ruc || "",
        email: customer.Email || customer.email || "",
        phone: customer.Phone || customer.phone || "",
        address: customer.Address || customer.address || "",
        city: customer.City || customer.city || "Panamá",
        country: customer.Country || customer.country || "PA",
      },
      items: items.map((item: any, index: number) => ({
        description: item.Description || item.description || `Item ${index + 1}`,
        quantity: parseFloat(item.Quantity || item.quantity || "1"),
        unitPrice: parseFloat(item.UnitPrice || item.unitPrice || item.Price || item.price || "0"),
        taxRate: parseFloat(item.TaxRate || item.taxRate || item.VAT || item.vat || "7"),
        discount: parseFloat(item.Discount || item.discount || "0"),
      })),
      notes: invoice.Notes || invoice.notes || "",
      paymentMethod: invoice.PaymentMethod || invoice.paymentMethod || "CASH",
    }
  }

  /**
   * Parsear formato CFDI de México
   */
  private parseCFDI(comprobante: any): ParsedInvoiceData {
    const receptor = comprobante["cfdi:Receptor"] || {}
    const conceptos = Array.isArray(comprobante["cfdi:Conceptos"]?.["cfdi:Concepto"])
      ? comprobante["cfdi:Conceptos"]["cfdi:Concepto"]
      : [comprobante["cfdi:Conceptos"]?.["cfdi:Concepto"]].filter(Boolean)

    return {
      client: {
        name: receptor["@_Nombre"] || "",
        taxId: receptor["@_Rfc"] || "",
        email: "",
        phone: "",
        address: "",
        city: "Ciudad de México",
        country: "MX",
      },
      items: conceptos.map((concepto: any, index: number) => ({
        description: concepto["@_Descripcion"] || `Item ${index + 1}`,
        quantity: parseFloat(concepto["@_Cantidad"] || "1"),
        unitPrice: parseFloat(concepto["@_ValorUnitario"] || "0"),
        taxRate: 16, // IVA México
        discount: parseFloat(concepto["@_Descuento"] || "0"),
      })),
      notes: "",
      paymentMethod: this.mapCFDIPaymentMethod(comprobante["@_FormaPago"]),
    }
  }

  /**
   * Mapear código de forma de pago a nuestro sistema
   */
  private mapPaymentMethodFromCode(code: string): string {
    const methodMap: Record<string, string> = {
      "01": "CASH",
      "02": "CARD",
      "03": "TRANSFER",
      "04": "CHECK",
      "99": "OTHER",
    }
    return methodMap[code] || "CASH"
  }

  /**
   * Mapear forma de pago CFDI
   */
  private mapCFDIPaymentMethod(formaPago: string): string {
    if (formaPago?.includes("01")) return "CASH"
    if (formaPago?.includes("02")) return "CHECK"
    if (formaPago?.includes("03")) return "TRANSFER"
    if (formaPago?.includes("04")) return "CARD"
    return "CASH"
  }

  /**
   * Validar que el XML tiene la estructura mínima requerida
   */
  static validate(xmlContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      // Verificar que el contenido no esté vacío
      if (!xmlContent || xmlContent.trim().length === 0) {
        errors.push("El archivo está vacío")
        return { valid: false, errors }
      }

      // Limpiar BOM (Byte Order Mark) si existe
      let cleaned = xmlContent
      if (cleaned.charCodeAt(0) === 0xFEFF) {
        cleaned = cleaned.slice(1)
      }

      // Verificar que sea XML (más tolerante con BOM y espacios)
      const trimmed = cleaned.trim()
      if (!trimmed.startsWith('<')) {
        errors.push(`El archivo no parece ser XML válido. Primeros caracteres: "${trimmed.substring(0, 50)}"`)
        return { valid: false, errors }
      }

      // Intentar parsear el XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: true,
        trimValues: true,
        stopNodes: [], // No detener en ningún nodo
        parseTagValue: false, // No parsear valores como números automáticamente
      })

      const parsed = parser.parse(cleaned)

      // Verificar que el parseo produjo algo
      if (!parsed || typeof parsed !== 'object') {
        errors.push("El XML no pudo ser parseado correctamente")
        return { valid: false, errors }
      }

      if (Object.keys(parsed).length === 0) {
        errors.push("El XML está vacío o no tiene estructura")
        return { valid: false, errors }
      }

      // Verificar que tiene algún formato reconocible
      const hasKnownFormat =
        parsed.rFE ||
        parsed.Invoice ||
        parsed.invoice ||
        parsed["cfdi:Comprobante"]

      if (!hasKnownFormat) {
        // Listar las raíces encontradas para ayudar al debug
        const rootElements = Object.keys(parsed).join(", ")
        errors.push(
          `Formato de XML no reconocido. ` +
          `Elementos raíz encontrados: ${rootElements}. ` +
          `Formatos soportados: rFE (FEL Panamá), Invoice (XML genérico), cfdi:Comprobante (CFDI México)`
        )
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (error: any) {
      // Mejorar el mensaje de error
      let errorMessage = error.message || "Error desconocido"

      // Errores comunes
      if (errorMessage.includes("tagName")) {
        errorMessage = "El XML tiene una estructura inválida. Verifica que sea un archivo XML bien formado."
      } else if (errorMessage.includes("Unexpected")) {
        errorMessage = "El XML contiene caracteres o estructuras no válidas."
      } else if (errorMessage.includes("Invalid")) {
        errorMessage = "El formato del XML no es válido."
      }

      errors.push(`XML inválido: ${errorMessage}`)
      return {
        valid: false,
        errors,
      }
    }
  }
}

/**
 * Helper para crear una instancia del parser
 */
export function createInvoiceParser() {
  return new InvoiceXMLParser()
}

