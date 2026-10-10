/**
 * Subscription Service
 */

import type { CheckQuotaResult, Subscription } from '../types/subscription.types';
import type { ApiResponse } from '@shared/lib/types';

export class SubscriptionService {
    private readonly PLAN_LIMITS = {
        FREE: 10,
        BASIC: 100,
        PRO: 1000,
        ENTERPRISE: -1, // Unlimited
    };

    async checkInvoiceQuota(clientId: string): Promise<CheckQuotaResult> {
        try {
            // TODO: Obtener subscription de BD
            const subscription: any = {
                plan: 'FREE',
                usedInvoices: 5,
            };

            const limit = this.PLAN_LIMITS[subscription.plan as keyof typeof this.PLAN_LIMITS];
            const remaining = limit === -1 ? Infinity : limit - subscription.usedInvoices;

            return {
                allowed: remaining > 0,
                remaining: remaining === Infinity ? -1 : remaining,
                limit,
            };
        } catch (error) {
            return {
                allowed: false,
                remaining: 0,
                limit: 0,
            };
        }
    }

    async incrementInvoiceCount(clientId: string): Promise<ApiResponse<void>> {
        try {
            // TODO: Incrementar contador en BD
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: 'Error incrementando contador',
            };
        }
    }
}
