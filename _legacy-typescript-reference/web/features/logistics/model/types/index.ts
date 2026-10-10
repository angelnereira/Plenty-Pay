export type DeliveryOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_PICKING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'

export type OriginModeType = 'DIRECT' | 'FROM_INVOICE' | 'FROM_POS'

export interface DeliveryAddress {
  text: string
  lat?: number
  lng?: number
}

export interface DeliveryOrderItemInput {
  productId?: string
  description: string
  quantity: number
  unitPrice?: number
  taxRate?: number // 0.07 = 7% ITBMS
  packaging?: string
  weightKg?: number
  dimensions?: string
  // Category classification
  category?: string
  sku?: string
  barcode?: string
  umc?: string       // DGI unit of measure catalog
  cpbsCode?: string  // DGI product/service code
  categoryMeta?: Record<string, string | number | null>
}

export interface CreateDeliveryOrderInput {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: DeliveryAddress
  scheduledDate?: Date
  estimatedDate?: Date
  carrierId?: string
  driverId?: string
  notes?: string
  emitInvoice?: boolean
  items: DeliveryOrderItemInput[]

  // Nuevos campos para captura completa
  priority?: string
  purchaseOrderRef?: string
  customerRuc?: string
  deliveryLocation?: string

  // Transportista manual
  carrierName?: string
  driverName?: string
  driverIdDoc?: string
  driverLicense?: string
  vehiclePlate?: string
  insurancePolicy?: string

  // Condiciones de movilización
  shippingMode?: string
  incoterm?: string
  controlledTemp?: boolean
  hazardousMat?: boolean
  shippingCost?: number
  insuranceCost?: number
}

export interface CreateFromInvoiceInput {
  invoiceId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: DeliveryAddress
  scheduledDate?: Date
  carrierId?: string
  driverId?: string
  notes?: string
}

export interface UpdateDeliveryOrderInput {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: DeliveryAddress
  scheduledDate?: Date
  estimatedDate?: Date
  carrierId?: string
  driverId?: string
  notes?: string
  internalNotes?: string
  emitInvoice?: boolean
}

export interface UpdateStatusInput {
  status: DeliveryOrderStatus
  notes?: string
}

export interface DeliveryOrderListItem {
  id: string
  code: string
  status: DeliveryOrderStatus
  originMode: OriginModeType
  customerName: string
  deliveryAddress: DeliveryAddress | null
  carrier: { id: string; name: string } | null
  driver: { id: string; firstName: string; lastName: string } | null
  totalAmount: string | null
  createdAt: Date
}

export interface DeliveryOrderDetail {
  id: string
  code: string
  status: DeliveryOrderStatus
  originMode: OriginModeType
  linkedInvoiceId: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  customerRuc: string | null
  deliveryLocation: string | null
  deliveryAddress: DeliveryAddress | null
  carrier: { id: string; name: string } | null
  driver: { id: string; firstName: string; lastName: string; phone: string | null } | null
  carrierName: string | null
  driverName: string | null
  driverIdDoc: string | null
  driverLicense: string | null
  vehiclePlate: string | null
  insurancePolicy: string | null
  shippingMode: string
  incoterm: string | null
  controlledTemp: boolean
  hazardousMat: boolean
  shippingCost: string | null
  insuranceCost: string | null
  priority: string
  purchaseOrderRef: string | null
  scheduledDate: Date | null
  estimatedDate: Date | null
  deliveredAt: Date | null
  emitInvoice: boolean
  subtotal: string | null
  taxAmount: string | null
  totalAmount: string | null
  inventoryDeducted: boolean
  pdfUrl: string | null
  qrToken: string | null
  notes: string | null
  internalNotes: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
  items: {
    id: string
    productId: string | null
    description: string
    quantity: string
    unitPrice: string | null
    taxRate: string | null
    taxAmount: string | null
    lineTotal: string | null
    packaging: string | null
    weightKg: string | null
    dimensions: string | null
    category: string | null
    sku: string | null
    barcode: string | null
    umc: string | null
    cpbsCode: string | null
    categoryMeta: Record<string, string | number | null> | null
    volWeight: string | null
    itemHash: string | null
  }[]
  statusHistory: {
    id: string
    fromStatus: DeliveryOrderStatus | null
    toStatus: DeliveryOrderStatus
    notes: string | null
    changedById: string | null
    createdAt: Date
  }[]
}
