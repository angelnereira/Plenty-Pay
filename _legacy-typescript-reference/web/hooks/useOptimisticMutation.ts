'use client'

import { useMutation, useQueryClient, UseMutationOptions, MutationKey } from '@tanstack/react-query'
import { useCallback } from 'react'

/**
 * Optimistic Mutation Hook Factory
 */

type OptimisticContext<TCache> = {
    previousData: TCache | undefined
}

interface UseOptimisticMutationOptions<TReturn, TVariables, TCache, TContext = OptimisticContext<TCache>>
    extends Omit<UseMutationOptions<TReturn, Error, TVariables, TContext>, 'mutationFn'> {
    /** The query key to update optimistically */
    queryKey: unknown[]
    /** Transform function to apply optimistic update to existing data */
    optimisticUpdate: (oldData: TCache | undefined, variables: TVariables) => TCache
    /** The actual mutation function */
    mutationFn: (variables: TVariables) => Promise<TReturn>
}

/**
 * Hook for creating optimistic mutations
 */
export function useOptimisticMutation<TReturn, TVariables, TCache>({
    queryKey,
    mutationFn,
    optimisticUpdate,
    onSuccess,
    onError,
    onSettled,
    ...options
}: UseOptimisticMutationOptions<TReturn, TVariables, TCache>) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn,
        onMutate: async (variables: TVariables) => {
            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey })

            // Snapshot the previous value for potential rollback
            const previousData = queryClient.getQueryData<TCache>(queryKey)

            // Optimistically update the cache
            queryClient.setQueryData<TCache>(queryKey, (old) =>
                optimisticUpdate(old, variables)
            )

            // Return context with previous data for rollback
            return { previousData }
        },
        onError: (error, variables, context) => {
            // Rollback to previous data on error
            if (context?.previousData !== undefined) {
                queryClient.setQueryData(queryKey, context.previousData)
            }
            console.error('[Optimistic Mutation] Rolled back due to error:', error);
            (onError as any)?.(error, variables, context)
        },
        onSuccess: (data, variables, context) => {
            console.log('[Optimistic Mutation] Server confirmed, syncing cache');
            (onSuccess as any)?.(data, variables, context)
        },
        onSettled: (data, error, variables, context) => {
            // Always refetch after mutation to ensure sync with server
            queryClient.invalidateQueries({ queryKey });
            (onSettled as any)?.(data, error, variables, context)
        },
        ...options,
    })
}

// ============================================
// Pre-built Optimistic Mutations for Common Operations
// ============================================

/**
 * Optimistic mutation for adding an item to a list
 */
export function useOptimisticAdd<TItem extends { id: string }>(
    queryKey: unknown[],
    mutationFn: (item: Partial<TItem>) => Promise<TItem>,
    options?: Partial<UseOptimisticMutationOptions<TItem, Partial<TItem>, TItem[]>>
) {
    return useOptimisticMutation<TItem, Partial<TItem>, TItem[]>({
        queryKey,
        mutationFn,
        optimisticUpdate: (oldData, newItem) => {
            const tempItem = {
                ...newItem,
                id: newItem.id || `temp-${Date.now()}`,
                _isOptimistic: true,
            } as unknown as TItem
            return [...(oldData || []), tempItem]
        },
        ...options,
    })
}

/**
 * Optimistic mutation for updating an item in a list
 */
export function useOptimisticUpdate<TItem extends { id: string }>(
    queryKey: unknown[],
    mutationFn: (item: Partial<TItem> & { id: string }) => Promise<TItem>,
    options?: Partial<UseOptimisticMutationOptions<TItem, Partial<TItem> & { id: string }, TItem[]>>
) {
    return useOptimisticMutation<TItem, Partial<TItem> & { id: string }, TItem[]>({
        queryKey,
        mutationFn,
        optimisticUpdate: (oldData, updatedItem) => {
            if (!oldData) return []
            return oldData.map((item) =>
                item.id === updatedItem.id
                    ? ({ ...item, ...updatedItem, _isOptimistic: true } as unknown as TItem)
                    : item
            )
        },
        ...options,
    })
}

/**
 * Optimistic mutation for removing an item from a list
 */
export function useOptimisticDelete<TItem extends { id: string }>(
    queryKey: unknown[],
    mutationFn: (id: string) => Promise<void>,
    options?: Partial<UseOptimisticMutationOptions<void, string, TItem[]>>
) {
    return useOptimisticMutation<void, string, TItem[]>({
        queryKey,
        mutationFn,
        optimisticUpdate: (oldData, id) => {
            if (!oldData) return []
            return oldData.filter((item) => item.id !== id)
        },
        ...options,
    })
}
