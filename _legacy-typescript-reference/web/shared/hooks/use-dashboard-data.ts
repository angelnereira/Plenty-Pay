'use client'

import { useQuery } from "@tanstack/react-query"
import { getDashboardData, DashboardData } from "@/actions/dashboard-actions"

export function useDashboardData(initialData?: DashboardData) {
    return useQuery({
        queryKey: ['dashboard-data'],
        queryFn: async () => {
            const result = await getDashboardData()
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to fetch data')
            }
            return result.data
        },
        initialData: initialData,
        staleTime: 1000 * 30, // 30 seconds - dashboard should be fresh
        gcTime: 1000 * 60 * 5, // 5 minutes cache
        refetchOnMount: 'always', // Always refetch on mount for fresh data
        refetchOnWindowFocus: true, // Refetch when user returns to tab
    })
}

