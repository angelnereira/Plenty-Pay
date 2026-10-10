'use client'

import { useEffect, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Delta Sync Hook
 * 
 * Implements the Local-First delta synchronization strategy:
 * 1. On app load, reads lastSyncTimestamp from localStorage
 * 2. Calls /api/sync?since={timestamp} to get only changed records
 * 3. Merges changed records into TanStack Query cache
 * 4. Removes deleted records from cache
 * 5. Updates lastSyncTimestamp for next sync
 */

const LAST_SYNC_KEY = 'plentypay-last-sync'

interface DeltaSyncData {
    syncTimestamp: string
    customers: {
        changed: Array<{ id: string;[key: string]: unknown }>
        deletedIds: string[]
    }
    invoices: {
        changed: Array<{ id: string;[key: string]: unknown }>
        deletedIds: string[]
    }
}

interface UseDeltaSyncOptions {
    /** Whether to sync automatically on mount (default: true) */
    autoSync?: boolean
    /** Query key for customers list */
    customersQueryKey?: string[]
    /** Query key for invoices list */
    invoicesQueryKey?: string[]
    /** Callback when sync completes */
    onSyncComplete?: (data: DeltaSyncData) => void
    /** Callback when sync fails */
    onSyncError?: (error: Error) => void
}

interface UseDeltaSyncReturn {
    /** Trigger a manual sync */
    sync: () => Promise<void>
    /** Whether a sync is in progress */
    isSyncing: boolean
    /** Last sync timestamp */
    lastSyncTimestamp: string | null
    /** Last sync error */
    error: Error | null
}

export function useDeltaSync(options: UseDeltaSyncOptions = {}): UseDeltaSyncReturn {
    const {
        autoSync = true,
        customersQueryKey = ['customers'],
        invoicesQueryKey = ['invoices'],
        onSyncComplete,
        onSyncError,
    } = options

    const queryClient = useQueryClient()
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null)
    const [error, setError] = useState<Error | null>(null)

    // Load last sync timestamp from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(LAST_SYNC_KEY)
            setLastSyncTimestamp(stored)
        }
    }, [])

    const sync = useCallback(async () => {
        if (isSyncing) return

        setIsSyncing(true)
        setError(null)

        try {
            // Build the sync URL with the since parameter
            const since = lastSyncTimestamp || new Date(0).toISOString()
            const response = await fetch(`/api/sync?since=${encodeURIComponent(since)}`)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Sync failed: ${response.status}`)
            }

            const data: DeltaSyncData = await response.json()

            // Update customers cache
            if (data.customers.changed.length > 0 || data.customers.deletedIds.length > 0) {
                queryClient.setQueriesData(
                    { queryKey: customersQueryKey },
                    (oldData: unknown) => {
                        if (!Array.isArray(oldData)) return oldData

                        // Remove deleted customers
                        const updated = oldData.filter(
                            (item: { id: string }) => !data.customers.deletedIds.includes(item.id)
                        )

                        // Merge changed customers
                        for (const customer of data.customers.changed) {
                            const existingIndex = updated.findIndex(
                                (item: { id: string }) => item.id === customer.id
                            )
                            if (existingIndex >= 0) {
                                updated[existingIndex] = customer
                            } else {
                                updated.push(customer)
                            }
                        }

                        return updated
                    }
                )

                // Also invalidate individual customer queries
                for (const id of data.customers.deletedIds) {
                    queryClient.removeQueries({ queryKey: ['customer', id] })
                }
            }

            // Update invoices cache
            if (data.invoices.changed.length > 0 || data.invoices.deletedIds.length > 0) {
                queryClient.setQueriesData(
                    { queryKey: invoicesQueryKey },
                    (oldData: unknown) => {
                        if (!Array.isArray(oldData)) return oldData

                        // Remove deleted invoices
                        const updated = oldData.filter(
                            (item: { id: string }) => !data.invoices.deletedIds.includes(item.id)
                        )

                        // Merge changed invoices
                        for (const invoice of data.invoices.changed) {
                            const existingIndex = updated.findIndex(
                                (item: { id: string }) => item.id === invoice.id
                            )
                            if (existingIndex >= 0) {
                                updated[existingIndex] = invoice
                            } else {
                                updated.push(invoice)
                            }
                        }

                        return updated
                    }
                )

                // Invalidate individual invoice queries
                for (const id of data.invoices.deletedIds) {
                    queryClient.removeQueries({ queryKey: ['invoice', id] })
                }
            }

            // Update last sync timestamp
            const newTimestamp = data.syncTimestamp
            localStorage.setItem(LAST_SYNC_KEY, newTimestamp)
            setLastSyncTimestamp(newTimestamp)

            // Log sync results
            console.log(
                `[Delta Sync] Complete: ${data.customers.changed.length} customers, ` +
                `${data.invoices.changed.length} invoices updated. ` +
                `${data.customers.deletedIds.length + data.invoices.deletedIds.length} deleted.`
            )

            onSyncComplete?.(data)
        } catch (err) {
            const syncError = err instanceof Error ? err : new Error('Unknown sync error')
            setError(syncError)
            console.error('[Delta Sync] Error:', syncError)
            onSyncError?.(syncError)
        } finally {
            setIsSyncing(false)
        }
    }, [
        isSyncing,
        lastSyncTimestamp,
        queryClient,
        customersQueryKey,
        invoicesQueryKey,
        onSyncComplete,
        onSyncError,
    ])

    // Auto-sync on mount if enabled
    useEffect(() => {
        if (autoSync && typeof window !== 'undefined') {
            // Small delay to let the app hydrate first
            const timer = setTimeout(() => {
                sync()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [autoSync]) // eslint-disable-line react-hooks/exhaustive-deps

    // Background Sync on Reconnect
    // Automatically sync when device comes back online
    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleOnline = () => {
            console.log('[Delta Sync] Device back online, triggering sync...')
            // Small delay to ensure connection is stable
            setTimeout(() => {
                sync()
            }, 500)
        }

        const handleOffline = () => {
            console.log('[Delta Sync] Device went offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [sync])

    return {
        sync,
        isSyncing,
        lastSyncTimestamp,
        error,
    }
}
