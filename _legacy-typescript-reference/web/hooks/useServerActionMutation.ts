'use client'

import { useTransition, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

/**
 * Server Action Mutation Hook with Optimistic Updates
 * 
 * Wraps Next.js server actions with optimistic UI updates.
 * Unlike useMutation, server actions are called directly without fetch.
 * This hook provides the same optimistic behavior for server actions.
 * 
 * Features:
 * - Optimistic UI updates before server responds
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Loading state via useTransition
 */

interface ServerActionMutationOptions<TData, TVariables, TResult> {
    /** The server action function to call */
    action: (variables: TVariables) => Promise<TResult>
    /** Query key to update optimistically */
    queryKey: readonly unknown[]
    /** Transform function for optimistic update */
    optimisticUpdate: (oldData: TData | undefined, variables: TVariables) => TData
    /** Callback on success */
    onSuccess?: (result: TResult, variables: TVariables) => void
    /** Callback on error */
    onError?: (error: Error, variables: TVariables, previousData: TData | undefined) => void
    /** Whether to invalidate queries on success (default: true) */
    invalidateOnSuccess?: boolean
}

interface ServerActionMutationResult<TVariables, TResult> {
    /** Execute the mutation */
    mutate: (variables: TVariables) => Promise<TResult | undefined>
    /** Whether the action is pending */
    isPending: boolean
    /** Last error if any */
    error: Error | null
    /** Reset error state */
    reset: () => void
}

export function useServerActionMutation<TData, TVariables, TResult = unknown>({
    action,
    queryKey,
    optimisticUpdate,
    onSuccess,
    onError,
    invalidateOnSuccess = true,
}: ServerActionMutationOptions<TData, TVariables, TResult>): ServerActionMutationResult<TVariables, TResult> {
    const queryClient = useQueryClient()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<Error | null>(null)

    const mutate = useCallback(async (variables: TVariables): Promise<TResult | undefined> => {
        setError(null)

        // Snapshot current data for rollback
        const previousData = queryClient.getQueryData<TData>(queryKey as unknown[])

        // Apply optimistic update immediately
        queryClient.setQueryData<TData>(queryKey as unknown[], (old) =>
            optimisticUpdate(old, variables)
        )

        return new Promise((resolve) => {
            startTransition(async () => {
                try {
                    const result = await action(variables)

                    // Invalidate to sync with server on success
                    if (invalidateOnSuccess) {
                        queryClient.invalidateQueries({ queryKey: queryKey as unknown[] })
                    }

                    console.log('[Server Action] Success:', queryKey)
                    onSuccess?.(result, variables)
                    resolve(result)
                } catch (err) {
                    // Rollback on error
                    queryClient.setQueryData(queryKey as unknown[], previousData)

                    const error = err instanceof Error ? err : new Error('Unknown error')
                    console.error('[Server Action] Rolled back due to error:', error)
                    setError(error)
                    onError?.(error, variables, previousData)
                    resolve(undefined)
                }
            })
        })
    }, [action, queryKey, optimisticUpdate, onSuccess, onError, invalidateOnSuccess, queryClient])

    const reset = useCallback(() => {
        setError(null)
    }, [])

    return {
        mutate,
        isPending,
        error,
        reset,
    }
}

// ============================================
// Pre-built Hooks for Common Operations
// ============================================

/**
 * Hook for customer operations with optimistic updates
 */
export function useCustomerMutation(clientId: string) {
    const queryClient = useQueryClient()
    const queryKey = queryKeys.customers.list(clientId)

    const addCustomer = useCallback(
        <T extends { name: string; ruc: string; id?: string }>(
            action: (customer: T) => Promise<T>
        ) => {
            return useServerActionMutation<T[], T, T>({
                action,
                queryKey,
                optimisticUpdate: (oldData, newCustomer) => {
                    const tempCustomer = {
                        ...newCustomer,
                        id: newCustomer.id || `temp-${Date.now()}`,
                    } as T
                    return [...(oldData || []), tempCustomer]
                },
            })
        },
        [queryKey]
    )

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
    }, [queryClient])

    return { addCustomer, invalidate }
}

/**
 * Hook for invoice operations with optimistic updates
 */
export function useInvoiceMutation() {
    const queryClient = useQueryClient()

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    }, [queryClient])

    const invalidateOne = useCallback((invoiceId: string) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) })
    }, [queryClient])

    const updateStatus = useCallback(
        <T extends { id: string; status: string }>(
            action: (data: { id: string; status: string }) => Promise<T>
        ) => {
            return useServerActionMutation<T[], { id: string; status: string }, T>({
                action,
                queryKey: queryKeys.invoices.all,
                optimisticUpdate: (oldData, { id, status }) => {
                    if (!oldData) return []
                    return oldData.map((invoice) =>
                        invoice.id === id ? { ...invoice, status } : invoice
                    )
                },
                onSuccess: () => {
                    invalidateAll()
                },
            })
        },
        [invalidateAll]
    )

    return { invalidateAll, invalidateOne, updateStatus }
}

/**
 * Helper hook to invalidate related queries after successful actions
 * Use this to refresh data after server actions complete
 */
export function useQueryInvalidation() {
    const queryClient = useQueryClient()

    return {
        invalidateInvoices: () =>
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
        invalidateCustomers: () =>
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
        invalidateDashboard: () =>
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        invalidateAll: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        },
    }
}
