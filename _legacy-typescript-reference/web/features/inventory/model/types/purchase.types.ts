import { Decimal } from "@prisma/client/runtime/library";

// ============================================
// SUPPLIER TYPES
// ============================================

export interface CreateSupplierInput {
    code: string;
    name: string;
    tradeName?: string;
    ruc?: string;
    dv?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    website?: string;
    paymentTerms?: string;
    creditLimit?: number;
    currency?: string;
    bankAccount?: string;
    bankName?: string;
    defaultLeadTimeDays?: number;
    category?: string;
    tier?: SupplierTier;
    certifications?: string[];
    notes?: string;
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
    id: string;
}

export type SupplierTier = 'STRATEGIC' | 'PREFERRED' | 'STANDARD' | 'PROBATION';

export interface SupplierProductInput {
    supplierId: string;
    productId: string;
    unitPrice: number;
    currency?: string;
    minOrderQty?: number;
    leadTimeDays?: number;
    supplierSku?: string;
    isPrimary?: boolean;
}

export interface SupplierEvaluationInput {
    supplierId: string;
    periodStart: Date;
    periodEnd: Date;
    onTimeDeliveryRate: number;
    qualityRate: number;
    responseTimeScore: number;
    priceCompetitiveness: number;
    notes?: string;
    evaluatedBy?: string;
}

export interface SupplierListFilters {
    search?: string;
    tier?: SupplierTier;
    category?: string;
    isActive?: boolean;
}

// ============================================
// PURCHASE REQUISITION TYPES
// ============================================

export type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export interface CreateRequisitionInput {
    requiredDate?: Date;
    reason: string;
    department?: string;
    costCenter?: string;
    budgetCode?: string;
    items: CreateRequisitionItemInput[];
    notes?: string;
}

export interface CreateRequisitionItemInput {
    productId?: string;
    description: string;
    quantity: number;
    unit?: string;
    estimatedUnitPrice: number;
    suggestedSupplierId?: string;
    notes?: string;
}

export interface ApproveRequisitionInput {
    requisitionId: string;
    approvedBy: string;
}

export interface RejectRequisitionInput {
    requisitionId: string;
    rejectedBy: string;
    rejectionReason: string;
}

// ============================================
// PURCHASE ORDER TYPES
// ============================================

export type PurchaseOrderStatus =
    | 'DRAFT'
    | 'SENT'
    | 'CONFIRMED'
    | 'PARTIAL_RECEIVED'
    | 'RECEIVED'
    | 'CLOSED'
    | 'CANCELLED';

export interface CreatePurchaseOrderInput {
    supplierId: string;
    requisitionId?: string;
    expectedDate?: Date;
    shippingAddress?: string;
    shippingMethod?: string;
    paymentTerms?: string;
    paymentMethod?: string;
    currency?: string;
    items: CreatePurchaseOrderItemInput[];
    notes?: string;
    internalNotes?: string;
}

export interface CreatePurchaseOrderItemInput {
    productId?: string;
    description: string;
    unit?: string;
    quantityOrdered: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
    notes?: string;
}

export interface UpdatePurchaseOrderStatusInput {
    purchaseOrderId: string;
    status: PurchaseOrderStatus;
    reason?: string; // For cancellation
}

export interface PurchaseOrderListFilters {
    search?: string;
    status?: PurchaseOrderStatus;
    supplierId?: string;
    fromDate?: Date;
    toDate?: Date;
}

export interface ReorderSuggestion {
    productId: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
    safetyStock: number;
    suggestedQuantity: number;
    eoqQuantity: number;
    avgDailyDemand: number;
    leadTimeDays: number;
    primarySupplierId?: string;
    primarySupplierName?: string;
}

// ============================================
// GOODS RECEIPT TYPES
// ============================================

export type InspectionStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'PARTIAL';
export type QualityStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CreateGoodsReceiptInput {
    purchaseOrderId: string;
    deliveryNote?: string;
    invoiceNumber?: string;
    warehouseLocation?: string;
    items: CreateGoodsReceiptItemInput[];
    notes?: string;
}

export interface CreateGoodsReceiptItemInput {
    poItemId?: string;
    productId?: string;
    quantityReceived: number;
    quantityAccepted: number;
    quantityRejected?: number;
    batchNumber?: string;
    serialNumber?: string;
    expiryDate?: Date;
    qualityStatus?: QualityStatus;
    rejectionReason?: string;
    unitCost: number;
    notes?: string;
}

export interface CompleteInspectionInput {
    goodsReceiptId: string;
    inspectionStatus: InspectionStatus;
    inspectionNotes?: string;
}

// ============================================
// INVENTORY ANALYTICS TYPES
// ============================================

export type ABCClass = 'A' | 'B' | 'C';

export interface ABCClassificationResult {
    productId: string;
    productName: string;
    abcClass: ABCClass;
    annualValue: number;
    percentageOfTotal: number;
    cumulativePercentage: number;
}

export interface InventoryTurnoverMetrics {
    period: { start: Date; end: Date };
    cogs: number;
    averageInventory: number;
    turnoverRatio: number;
    daysOfInventory: number;
}

export interface StockoutForecast {
    productId: string;
    productName: string;
    currentStock: number;
    avgDailyDemand: number;
    daysUntilStockout: number;
    estimatedStockoutDate: Date;
    reorderRecommended: boolean;
}

// ============================================
// INVENTORY VALUATION TYPES
// ============================================

export type ValuationMethod = 'FIFO' | 'WEIGHTED_AVG';

export interface InventoryValuation {
    productId: string;
    productName: string;
    currentStock: number;
    valuationMethod: ValuationMethod;
    unitCost: number;
    totalValue: number;
}

export interface FIFOLayer {
    lotId: string;
    batchNumber: string | null;
    quantity: number;
    unitCost: number;
    entryDate: Date;
}

export interface COGSCalculation {
    productId: string;
    quantity: number;
    method: ValuationMethod;
    totalCost: number;
    layers?: FIFOLayer[]; // For FIFO method
}
