'use client'

import { get, set, del, createStore } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Creates an IndexedDB persister for TanStack Query cache.
 * Uses idb-keyval for simple, Promise-based IndexedDB access.
 * 
 * This enables Local-First architecture by persisting the query cache
 * to IndexedDB, which has no 5MB limit like localStorage.
 * 
 * @param storeName - Name for the IndexedDB store (default: 'plentypay-cache')
 * @param key - Key under which to store the client cache (default: 'tanstack-query')
 */
export function createIDBPersister(
    storeName = 'plentypay-cache',
    key = 'tanstack-query'
): Persister {
    // Create a custom store with specific database and store names
    const customStore = createStore(`${storeName}-db`, storeName)

    return {
        persistClient: async (client: PersistedClient) => {
            try {
                await set(key, client, customStore)
            } catch (error) {
                console.warn('[IDB Persister] Failed to persist client:', error)
            }
        },
        restoreClient: async () => {
            try {
                return await get<PersistedClient>(key, customStore)
            } catch (error) {
                console.warn('[IDB Persister] Failed to restore client:', error)
                return undefined
            }
        },
        removeClient: async () => {
            try {
                await del(key, customStore)
            } catch (error) {
                console.warn('[IDB Persister] Failed to remove client:', error)
            }
        },
    }
}

/**
 * Default persister instance for the app.
 * Import this in your QueryProvider to enable persistence.
 */
export const idbPersister = createIDBPersister()
