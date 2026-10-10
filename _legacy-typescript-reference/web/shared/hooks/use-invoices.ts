import { useQuery } from "@tanstack/react-query"
import { getInvoices, InvoicesData } from "@/actions/invoice-actions"

export function useInvoices(initialData?: InvoicesData) {
    return useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const result = await getInvoices()
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to fetch invoices')
            }
            return result.data
        },
        initialData: initialData,
        staleTime: 1000 * 30, // 30 seconds - invoices should be fresh
        gcTime: 1000 * 60 * 5, // 5 minutes cache
        refetchOnMount: 'always', // Always refetch on mount for fresh data
        refetchOnWindowFocus: true, // Refetch when user returns to tab
    })
}

