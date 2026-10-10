import { Product, InventoryTransactionType } from "@prisma/client";

export interface CreateProductInput {
    sku?: string;
    barcode?: string;
    name: string;
    brand?: string;
    description?: string;
    category?: string;
    weight?: string;
    size?: string;
    dimensions?: string;
    color?: string;
    material?: string;
    unitType?: string;
    purchasePrice: number;
    salePrice: number;
    taxRate: number;
    taxCode: string;
    originCountry?: string;
    image?: string;
    cpbsCode?: string;
    cpbsUnit?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
    id: string;
}

export interface CreateLotInput {
    productId: string;
    batchNumber?: string;
    quantity: number;
    purchasePrice: number;
    salePrice?: number;
    expiryDate?: Date;
    supplierId?: string;
    originCountry?: string;
    notes?: string;
}

export interface CreateTransactionInput {
    productId: string;
    type: InventoryTransactionType;
    quantity: number;
    invoiceId?: string;
    lotId?: string;
    reason?: string;
    reference?: string;
    userId?: string;
}

export interface InventoryStats {
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalInventoryValue: number;
}

export interface SerializedProduct extends Omit<Product, 'purchasePrice' | 'salePrice' | 'taxRate' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
    purchasePrice: number;
    salePrice: number;
    taxRate: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}
