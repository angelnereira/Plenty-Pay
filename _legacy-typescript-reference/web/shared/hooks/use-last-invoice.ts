'use client';

import { useQuery } from '@tanstack/react-query';
import {
    getLastInvoiceByClient,
    type LastInvoiceSummary,
} from '@/app/actions/invoice/get-last-invoice-by-client.action';

export function useLastInvoice(clientId: string | null) {
    return useQuery({
        queryKey: ['last-invoice', clientId],
        queryFn: async () => {
            if (!clientId) return null;
            const result = await getLastInvoiceByClient(clientId);
            if (!result.ok) return null;
            return result.data; // LastInvoiceSummary | null
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos (gcTime en TanStack Query v5)
    });
}

export type { LastInvoiceSummary };
