/**
 * Subscription Types
 */

export interface Subscription {
    id: string;
    clientId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    monthlyInvoiceLimit: number;
    usedInvoices: number;
    startDate: Date;
    endDate: Date;
}

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface CreateSubscriptionDTO {
    clientId: string;
    plan: SubscriptionPlan;
}

export interface CheckQuotaResult {
    allowed: boolean;
    remaining: number;
    limit: number;
}
