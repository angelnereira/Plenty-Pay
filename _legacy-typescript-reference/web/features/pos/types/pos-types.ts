// Payment method types and interfaces
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';

export interface PaymentDetails {
    method: PaymentMethod;
    // For MIXED payments
    cashAmount?: number;
    cardAmount?: number;
    transferAmount?: number;
}

export interface Discount {
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
}

// POS UI Types
export type ViewMode = 'grid' | 'list';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface PosFilters {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly: boolean;
}

export enum CheckoutPreference {
    ALWAYS_DGI = 'ALWAYS_DGI',
    INTERNAL_ONLY = 'INTERNAL_ONLY',
    ASK_ALWAYS = 'ASK_ALWAYS',
    AUTO_THRESHOLD = 'AUTO_THRESHOLD'
}
