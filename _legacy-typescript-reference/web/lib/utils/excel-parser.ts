/**
 * Parser de Excel para importar facturas
 * Soporta archivos .xlsx con diferentes formatos
 * ACTUALIZADO: Usa exceljs en lugar de xlsx (más seguro)
 */

import ExcelJS from 'exceljs'
import type { ParsedInvoiceData } from './xml-parser'

export interface ExcelInvoiceData extends ParsedInvoiceData {
  // Heredamos de ParsedInvoiceData para mantener compatibilidad
}

export class InvoiceExcelParser {
  /**
   * Parsear archivo Excel y extraer datos de factura
   */
  async parse(fileBuffer: ArrayBuffer): Promise<ExcelInvoiceData> {
    try {
      // Crear workbook desde buffer
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(fileBuffer)

      // Obtener la primera hoja
      const worksheet = workbook.worksheets[0]

      if (!worksheet) {
        throw new Error("El archivo Excel está vacío")
      }

      // Convertir worksheet a array de arrays
      const data: any[][] = []
      worksheet.eachRow((row, rowNumber) => {
        const rowValues: any[] = []
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues.push(cell.value)
        })
        data.push(rowValues)
      })

      if (!data || data.length === 0) {
        throw new Error("El archivo Excel está vacío")
      }

      // Detectar formato del Excel
      return this.detectAndParse(data, worksheet)

    } catch (error: any) {
      throw new Error(`Error al procesar Excel: ${error.message}`)
    }
  }

  /**
   * Detectar formato y parsear
   */
  private detectAndParse(data: any[][], worksheet: ExcelJS.Worksheet): ExcelInvoiceData {
    // Convertir a JSON con headers para análisis
    const jsonData: any[] = []
    let headerRow: any[] = []

    // Buscar fila de headers (primera fila con strings)
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i]
      if (row && row.some(cell => typeof cell === 'string' && cell.trim().length > 0)) {
        headerRow = row.map(cell => String(cell || '').trim())

        // Convertir filas restantes a objetos JSON
        for (let j = i + 1; j < data.length; j++) {
          const dataRow = data[j]
          const obj: any = {}
          headerRow.forEach((header, idx) => {
            if (header) {
              obj[header] = dataRow[idx]
            }
          })
          if (Object.keys(obj).length > 0) {
            jsonData.push(obj)
          }
        }
        break
      }
    }

    // Intentar detectar formato basado en columnas
    if (jsonData.length > 0) {
      const firstRow = jsonData[0]
      const keys = Object.keys(firstRow).map(k => k.toLowerCase())

      // Formato con headers conocidos
      if (this.hasClientHeaders(keys) || this.hasInvoiceHeaders(keys)) {
        return this.parseWithHeaders(jsonData)
      }
    }

    // Formato sin headers (datos directos)
    return this.parseWithoutHeaders(data)
  }

  /**
   * Normaliza un número que puede venir como string con símbolos ($, , .) o como número
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value !== 'string') return 0
    const cleaned = value
      .toString()
      .replace(/\s+/g, '')
      .replace(/[\$]/g, '')
      .replace(/\./g, '') // remover separador de miles estilo es-PA
      .replace(/,/g, '.')  // convertir coma decimal a punto
    const parsed = parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private isNumericLike(value: any): boolean {
    if (typeof value === 'number') return true
    if (typeof value !== 'string') return false
    return /^\s*[\$]?[\d.,]+\s*$/.test(value)
  }

  /**
   * Verificar si tiene headers de cliente
   */
  private hasClientHeaders(keys: string[]): boolean {
    const clientKeys = ['nombre', 'name', 'cliente', 'customer', 'ruc', 'taxid']
    return keys.some(k => clientKeys.some(ck => k.includes(ck)))
  }

  /**
   * Verificar si tiene headers de factura
   */
  private hasInvoiceHeaders(keys: string[]): boolean {
    const invoiceKeys = ['descripcion', 'description', 'producto', 'product', 'cantidad', 'quantity', 'precio', 'price']
    return keys.some(k => invoiceKeys.some(ik => k.includes(ik)))
  }

  /**
   * Parsear con headers
   */
  private parseWithHeaders(data: any[]): ExcelInvoiceData {
    // Buscar información del cliente en las primeras filas
    const clientData = this.extractClientData(data)

    // Buscar items (productos/servicios)
    const items = this.extractItemsWithHeaders(data)

    // Buscar información adicional
    const additionalInfo = this.extractAdditionalInfo(data)

    return {
      client: clientData,
      items: items,
      notes: additionalInfo.notes,
      paymentMethod: additionalInfo.paymentMethod,
    }
  }

  /**
   * Parsear sin headers (formato simple)
   */
  private parseWithoutHeaders(data: any[][]): ExcelInvoiceData {
    // Formato esperado:
    // Fila 1: Cliente
    // Fila 2: Datos del cliente
    // Fila 3: Headers de items
    // Fila 4+: Items

    let clientName = ""
    let clientTaxId = ""
    let clientEmail = ""
    let clientPhone = ""
    let clientAddress = ""

    // Buscar datos del cliente en las primeras filas
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const firstCell = String(row[0] || '').toLowerCase()

      if (firstCell.includes('cliente') || firstCell.includes('customer') || firstCell.includes('nombre')) {
        clientName = String(row[1] || '')
      } else if (firstCell.includes('ruc') || firstCell.includes('tax') || firstCell.includes('nit')) {
        clientTaxId = String(row[1] || '')
      } else if (firstCell.includes('email') || firstCell.includes('correo')) {
        clientEmail = String(row[1] || '')
      } else if (firstCell.includes('tel') || firstCell.includes('phone')) {
        clientPhone = String(row[1] || '')
      } else if (firstCell.includes('direc') || firstCell.includes('address')) {
        clientAddress = String(row[1] || '')
      }
    }

    // Buscar items (después de las primeras filas)
    const items = this.extractItemsWithoutHeaders(data)

    return {
      client: {
        name: clientName || "Cliente Genérico",
        taxId: clientTaxId || "000000000",
        email: clientEmail,
        phone: clientPhone,
        address: clientAddress || "Panamá",
        city: "Panamá",
        country: "PA",
      },
      items: items.length > 0 ? items : [{
        description: "Item 1",
        quantity: 1,
        unitPrice: 0,
        taxRate: 7,
        discount: 0,
      }],
      notes: "",
      paymentMethod: "CASH",
    }
  }

  /**
   * Extraer datos del cliente
   */
  private extractClientData(data: any[]): ExcelInvoiceData['client'] & Record<string, any> {
    const clientData: any = {
      name: "",
      taxId: "",
      email: "",
      phone: "",
      address: "",
      city: "Panamá",
      country: "PA",
    }

    // Buscar en las primeras filas
    for (const row of data.slice(0, 10)) {
      for (const key in row) {
        const lowerKey = key.toLowerCase()
        const value = String(row[key] || '').trim()

        if (!value) continue

        // Nombre - ahora incluye RAZON_SOCIAL que es el campo típico en Excel de facturas
        if (
          (lowerKey.includes('nombre') ||
            lowerKey.includes('name') ||
            lowerKey.includes('cliente') ||
            lowerKey.includes('customer') ||
            lowerKey.includes('razon') ||  // RAZON_SOCIAL
            lowerKey.includes('social')) &&
          !clientData.name
        ) {
          // Ignorar si parece un código numérico corto (ej: "01", "02")
          if (/^\d{1,3}$/.test(value)) continue;
          clientData.name = value
          console.log(`[ExcelParser] 📝 Nombre encontrado en columna "${key}":`, value);
        }
        // RUC/Tax ID/Cédula - incluye NUMERO_RUC
        else if (
          (lowerKey.includes('ruc') ||
            lowerKey.includes('tax') ||
            lowerKey.includes('nit') ||
            lowerKey.includes('cedula') ||
            lowerKey.includes('numero_ruc')) &&
          !clientData.taxId
        ) {
          clientData.taxId = value
          console.log(`[ExcelParser] 🔢 RUC/Cédula encontrado en columna "${key}":`, value);
        }
        // Email
        else if (lowerKey.includes('email') || lowerKey.includes('correo')) {
          clientData.email = value
        }
        // Teléfono
        else if (lowerKey.includes('tel') || lowerKey.includes('phone') || lowerKey.includes('celular')) {
          clientData.phone = value
        }
        // Dirección
        else if (lowerKey.includes('direc') || lowerKey.includes('address')) {
          clientData.address = value
        }
        // Ciudad
        else if (lowerKey.includes('ciudad') || lowerKey.includes('city')) {
          clientData.city = value
        }
        // País
        else if (lowerKey === 'pais' || lowerKey.includes('country')) {
          clientData.country = value
        }
        // DATO.xlsx Specific Fields
        else if (lowerKey === 'tipo_contribuyente' || lowerKey === 'tipocontribuyente') {
          clientData.tipoContribuyente = value
        }
        else if (lowerKey === 'dv' || lowerKey === 'digito_verificador') {
          clientData.dv = value
        }
        else if (lowerKey === 'codigo_ubicacion' || lowerKey === 'codigoubicacion') {
          clientData.codigoUbicacion = value
        }
        else if (lowerKey === 'provincia') {
          clientData.provincia = value
        }
        else if (lowerKey === 'distrito') {
          clientData.distrito = value
        }
        else if (lowerKey === 'corregimiento') {
          clientData.corregimiento = value
        }
        else if (lowerKey === 'tipo_cliente_fe' || lowerKey === 'tipoclientefe') {
          clientData.tipoClienteFE = value
        }
      }
    }

    // Valores por defecto si no se encontraron
    if (!clientData.name) clientData.name = "Cliente Genérico"
    if (!clientData.taxId) clientData.taxId = "000000000"
    if (!clientData.address) clientData.address = "Panamá"

    console.log('[ExcelParser] ✅ Datos de cliente extraídos:', clientData);

    return clientData
  }

  /**
   * Extraer items con headers
   */
  private extractItemsWithHeaders(data: any[]): ExcelInvoiceData['items'] {
    const items: ExcelInvoiceData['items'] = []

    for (const row of data) {
      const item: any = {
        description: "",
        quantity: 0,
        unitPrice: 0,
        taxRate: 7,
        discount: 0,
        codigo: "",
        unidadMedida: ""
      }

      let hasItemData = false
      let candidateDescription: string | null = null

      for (const key in row) {
        const lowerKey = key.toLowerCase()
        const value = row[key]

        // Descuento (check before precio so precio_descuento matches here)
        if (lowerKey.includes('descuento') || lowerKey.includes('discount')) {
          item.discount = this.parseNumber(value) || 0
          hasItemData = true
        }
        // Precio unitario (ampliar sinónimos y normalizar formatos)
        else if (
          (lowerKey.includes('precio') && !lowerKey.includes('item') && !lowerKey.includes('acarreo') && !lowerKey.includes('seguro')) ||
          lowerKey.includes('price') ||
          lowerKey.includes('valor') ||
          lowerKey.includes('unit') ||
          lowerKey.includes('p.u') ||
          lowerKey.includes('p/u') ||
          lowerKey === 'pu' ||
          lowerKey.includes('importe') ||
          lowerKey.includes('monto') ||
          lowerKey.includes('unitario')
        ) {
          const num = this.parseNumber(value)
          if (num > 0) {
            item.unitPrice = num
            hasItemData = true
          }
        }
        // Cantidad
        else if (lowerKey === 'cantidad' || lowerKey.includes('quantity') || lowerKey.includes('cant') || lowerKey.includes('qty')) {
          item.quantity = this.parseNumber(value) || 0
          if (item.quantity > 0) hasItemData = true
        }
        // Descripción (solo si no es numérico)
        else if (lowerKey.includes('descrip') || lowerKey.includes('product') || lowerKey === 'item' || lowerKey.includes('servicio')) {
          const text = String(value ?? '').trim()
          if (text && !this.isNumericLike(text)) {
            item.description = text
            hasItemData = true
          } else if (text) {
            // Guardar como candidata si resulta ser numérico (para no contaminar descripción)
            candidateDescription = text
          }
        }
        // Tasa de impuesto (check for TASA_ITBMS directly or other synonyms)
        else if (lowerKey.includes('impuesto') || lowerKey.includes('tax') || lowerKey.includes('itbms') || lowerKey.includes('iva')) {
          // If the value is "01", "02", "03", "00" directly mapping to HKA, we must preserve it
          // or parse it to numeric. PlentyPay uses 7, 10, 15 internally for `taxRate`.
          let rate = this.parseNumber(value) || 7;
          // In PlentyPay/HKA, code '01' means 7%, '02' means 10%, '03' means 15%, '00' means 0%.
          const valStr = String(value).trim();
          if (valStr === '00') rate = 0;
          if (valStr === '01') rate = 7;
          if (valStr === '02') rate = 10;
          if (valStr === '03') rate = 15;
          item.taxRate = rate;
        }
        // Código
        else if (lowerKey === 'codigo' || lowerKey === 'code') {
          item.codigo = String(value ?? '').trim();
        }
        // Unidad de medida
        else if (lowerKey === 'unidadmedida' || lowerKey === 'unidad_medida' || lowerKey === 'unit') {
          item.unidadMedida = String(value ?? '').trim();
        }
      }

      // Si la descripción quedó vacía pero hay una candidata numérica y sí tenemos otros datos
      if (!item.description && candidateDescription && !this.isNumericLike(candidateDescription)) {
        item.description = candidateDescription
      }

      // Solo agregar si tiene datos y al menos una descripción razonable
      if (hasItemData && item.description) {
        items.push(item)
      }
    }

    return items.length > 0 ? items : [{
      description: "Item 1",
      quantity: 1,
      unitPrice: 0,
      taxRate: 7,
      discount: 0,
    }]
  }

  /**
   * Extraer items sin headers
   */
  private extractItemsWithoutHeaders(data: any[][]): ExcelInvoiceData['items'] {
    const items: ExcelInvoiceData['items'] = []

    // Buscar fila de headers de items
    let itemsStartRow = -1
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const firstCell = String(row[0] || '').toLowerCase()
      if (firstCell.includes('descrip') || firstCell.includes('product') || firstCell.includes('item')) {
        itemsStartRow = i + 1
        break
      }
    }

    // Si no se encontró header, buscar desde la fila 5
    if (itemsStartRow === -1) {
      itemsStartRow = 5
    }

    // Extraer items
    for (let i = itemsStartRow; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length < 3) continue

      const description = String(row[0] || '').trim()
      if (!description) continue

      items.push({
        description: this.isNumericLike(description) ? '' : description,
        quantity: this.parseNumber(row[1]) || 1,
        unitPrice: this.parseNumber(row[2]) || 0,
        taxRate: this.parseNumber(row[3]) || 7,
        discount: this.parseNumber(row[4]) || 0,
      })
    }

    // Filtrar filas que accidentalmente dejaron descripción numérica vacía
    return items.filter(it => it.description)
  }

  /**
   * Extraer información adicional
   */
  private extractAdditionalInfo(data: any[]): { notes?: string; paymentMethod?: string } {
    let notes = ""
    let paymentMethod = "CASH"

    for (const row of data) {
      for (const key in row) {
        const lowerKey = key.toLowerCase()
        const value = String(row[key] || '').trim()

        if (!value) continue

        // Notas
        if (lowerKey.includes('nota') || lowerKey.includes('note') || lowerKey.includes('comentario') || lowerKey.includes('observ')) {
          notes = value
        }
        // Forma de pago
        else if (lowerKey.includes('pago') || lowerKey.includes('payment')) {
          const valueLower = value.toLowerCase()
          if (valueLower.includes('efectivo') || valueLower.includes('cash') || valueLower === '02') {
            paymentMethod = "CASH"
          } else if (valueLower.includes('tarjeta') || valueLower.includes('card') || valueLower === '03' || valueLower === '04') {
            paymentMethod = "CARD"
          } else if (valueLower.includes('transfer') || valueLower.includes('ach') || valueLower === '08') {
            paymentMethod = "TRANSFER"
          } else if (valueLower.includes('cheque') || valueLower.includes('check') || valueLower === '09') {
            paymentMethod = "CHECK"
          } else if (valueLower.includes('credit') || valueLower === '01') {
            paymentMethod = "CREDITO"
          }
        }
      }
    }

    return { notes, paymentMethod }
  }

  /**
   * Validar que el archivo Excel tiene la estructura mínima requerida
   */
  static async validate(fileBuffer: ArrayBuffer): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // Intentar leer el archivo
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(fileBuffer)

      if (!workbook.worksheets || workbook.worksheets.length === 0) {
        errors.push("El archivo Excel no tiene hojas")
        return { valid: false, errors }
      }

      const worksheet = workbook.worksheets[0]

      if (!worksheet || worksheet.rowCount === 0) {
        errors.push("La hoja de Excel está vacía")
        return { valid: false, errors }
      }

      if (worksheet.rowCount < 2) {
        errors.push("El archivo Excel debe tener al menos 2 filas de datos")
        return { valid: false, errors }
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (error: any) {
      errors.push(`Error al validar Excel: ${error.message}`)
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
export function createExcelParser() {
  return new InvoiceExcelParser()
}

