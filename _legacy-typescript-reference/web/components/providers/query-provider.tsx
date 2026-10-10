'use client'

import { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { idbPersister } from '@/lib/indexeddb-persister'

// Cache time must be >= gcTime for persistence to work correctly
const CACHE_TIME = 1000 * 60 * 60 * 24 * 7 // 7 days

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // Optimized for Local-First PWA with persistence
                staleTime: 1000 * 60 * 5,           // 5 minutes - data is fresh
                gcTime: CACHE_TIME,                  // 7 days - keep in cache for persistence
                refetchOnWindowFocus: false,         // Avoid refetch, delta sync handles updates
                refetchOnReconnect: 'always',        // Refetch on reconnect for fresh data
                refetchOnMount: false,               // Don't refetch if we have cached data
                retry: 2,                            // 2 retries max
                retryDelay: (attemptIndex) =>
                    Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
                networkMode: 'offlineFirst',         // Use cached data when offline
            },
            mutations: {
                retry: 1,
                networkMode: 'offlineFirst',
            },
        },
    }))

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister: idbPersister,
                maxAge: CACHE_TIME,
                dehydrateOptions: {
                    // Only persist successful queries
                    shouldDehydrateQuery: (query) =>
                        query.state.status === 'success',
                },
            }}
        >
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </PersistQueryClientProvider>
    )
}
