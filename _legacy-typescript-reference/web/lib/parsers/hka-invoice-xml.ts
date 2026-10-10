// Utilidad ligera para parsear XML de factura (UBL/HKA) y mapear a estructura interna
// Evita dependencias externas; usa heurísticas simples con regex tolerantes a namespaces

export interface ParsedInvoiceItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface ParsedInvoiceData {
  customer?: {
    name?: string
    ruc?: string
    dv?: string
  }
  items: ParsedInvoiceItem[]
  totals?: {
    total?: number
  }
}

function getTagValue(xml: string, tag: string): string | undefined {
  // Captura con o sin namespace: <cbc:Name> o <Name>
  const nsPattern = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([\s\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i')
  const match = xml.match(nsPattern)
  return match ? sanitize(match[1]) : undefined
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseHKAXmlInvoice(xmlContent: string): ParsedInvoiceData {
  const xml = xmlContent
  const customerName =
    getTagValue(xml, 'Name') ||
    getTagValue(xml, 'RegistrationName') ||
    getTagValue(xml, 'PartyName')

  // Intentar extraer RUC y DV si vienen juntos o separados
  const customerId = getTagValue(xml, 'ID')
  let ruc: string | undefined
  let dv: string | undefined
  if (customerId) {
    // Heurística: "RUC-DV" o "RUC ... DV"
    const dvMatch = customerId.match(/(\d{1,3})$/)
    if (dvMatch) dv = dvMatch[1]
    ruc = customerId
  }

  // Extraer líneas de factura de forma heurística
  const items: ParsedInvoiceItem[] = []
  const lineRegex = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?InvoiceLine[\s\S]*?<\\/(?:[a-zA-Z0-9_-]+:)?InvoiceLine>`,
    'gi',
  )
  const lines = xml.match(lineRegex) || []
  for (const line of lines) {
    const quantityStr = getTagValue(line, 'InvoicedQuantity') || getTagValue(line, 'Quantity') || '1'
    const priceStr =
      getTagValue(line, 'PriceAmount') ||
      getTagValue(line, 'LineExtensionAmount') ||
      getTagValue(line, 'Amount') ||
      '0'
    const desc =
      getTagValue(line, 'Description') ||
      getTagValue(line, 'Name') ||
      getTagValue(line, 'Item') ||
      'Item'

    const quantity = Number(String(quantityStr).replace(/[^0-9.]/g, '')) || 1
    const price = Number(String(priceStr).replace(/[^0-9.]/g, '')) || 0

    let unitPrice = price
    if (unitPrice === 0) {
      // Si solo viene total de la línea, intentar deducir unitPrice si quantity > 0
      unitPrice = quantity > 0 ? price / quantity : 0
    }

    items.push({ description: desc, quantity, unitPrice })
  }

  // Total heurístico
  const totalStr =
    getTagValue(xml, 'PayableAmount') || getTagValue(xml, 'TaxInclusiveAmount') || getTagValue(xml, 'LegalMonetaryTotal')
  const total = totalStr ? Number(String(totalStr).replace(/[^0-9.]/g, '')) : undefined

  const data: ParsedInvoiceData = {
    customer: {
      name: customerName,
      ruc,
      dv,
    },
    items: items.length > 0 ? items : [],
    totals: { total },
  }

  return data
}


