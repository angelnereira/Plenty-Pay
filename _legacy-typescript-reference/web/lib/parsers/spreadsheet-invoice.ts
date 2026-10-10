import { ParsedInvoiceData, ParsedInvoiceItem } from './hka-invoice-xml'

function normalize(str: string): string {
  return String(str || '').trim()
}

function toNumber(value: any): number {
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

function mapRowToItem(row: Record<string, any>, headerMap: Record<string, string>): ParsedInvoiceItem | null {
  const descKey = headerMap['description']
  const qtyKey = headerMap['quantity']
  const unitKey = headerMap['unitprice']
  const description = normalize(row[descKey])
  if (!description) return null
  const quantity = toNumber(row[qtyKey] ?? 1)
  const unitPrice = toNumber(row[unitKey] ?? 0)
  return { description, quantity: quantity || 1, unitPrice }
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  headers.forEach((h) => {
    const key = String(h || '').toLowerCase().trim()
    if (['descripcion', 'description', 'item', 'concepto', 'detalle'].includes(key)) map['description'] = h
    if (['cantidad', 'quantity', 'qty'].includes(key)) map['quantity'] = h
    if (['precio', 'precio_unitario', 'unitprice', 'unit_price', 'price', 'precio unitario'].includes(key)) map['unitprice'] = h
    if (['cliente', 'nombre', 'razon_social', 'customer', 'customer_name'].includes(key)) map['customer_name'] = h
    if (['ruc', 'identificacion', 'id', 'customer_ruc'].includes(key)) map['customer_ruc'] = h
    if (['dv', 'digito_verificador', 'customer_dv'].includes(key)) map['customer_dv'] = h
  })
  return map
}

export function parseCSVInvoice(csvText: string): ParsedInvoiceData {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { items: [] }
  const splitter = (line: string) => {
    // Separación simple por coma o punto y coma; evita comillas complejas
    const parts = line.split(/,|;|\t/)
    return parts.map((p) => p.trim())
  }
  const header = splitter(lines[0])
  const headerMap = buildHeaderMap(header)

  const rows = lines.slice(1).map(splitter)
  const items: ParsedInvoiceItem[] = []
  for (const row of rows) {
    const rowObj: Record<string, any> = {}
    header.forEach((h, i) => {
      rowObj[h] = row[i]
    })
    const item = mapRowToItem(rowObj, headerMap)
    if (item) items.push(item)
  }

  const data: ParsedInvoiceData = {
    customer: {
      name: normalize((rows.length ? rows[0] : [])[header.indexOf(headerMap['customer_name'])] || ''),
      ruc: normalize((rows.length ? rows[0] : [])[header.indexOf(headerMap['customer_ruc'])] || ''),
      dv: normalize((rows.length ? rows[0] : [])[header.indexOf(headerMap['customer_dv'])] || ''),
    },
    items,
  }
  return data
}

export async function parseXLSXInvoice(buffer: Buffer): Promise<ParsedInvoiceData> {
  let xlsx: any = null
  try {
    // Carga dinámica para no romper el build si no está instalado
    // @ts-ignore
    xlsx = await import('xlsx')
  } catch (_) {
    throw new Error('Soporte XLSX no disponible. Instala la dependencia "xlsx" para habilitarlo.')
  }

  const wb = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { items: [] }
  const sheet = wb.Sheets[sheetName]
  const json: Array<Record<string, any>> = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  if (json.length === 0) return { items: [] }

  const headers = Object.keys(json[0] || {})
  const headerMap = buildHeaderMap(headers)
  const items: ParsedInvoiceItem[] = []

  for (const row of json) {
    const item = mapRowToItem(row, headerMap)
    if (item) items.push(item)
  }

  const firstRow = json[0] || {}
  const data: ParsedInvoiceData = {
    customer: {
      name: normalize(firstRow[headerMap['customer_name']]),
      ruc: normalize(firstRow[headerMap['customer_ruc']]),
      dv: normalize(firstRow[headerMap['customer_dv']]),
    },
    items,
  }
  return data
}


