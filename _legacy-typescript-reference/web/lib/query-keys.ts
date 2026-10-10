/**
 * Query Key Factory para React Query
 * Permite invalidación granular y eficiente del caché
 * 
 * @example
 * // Usar en componentes
 * const { data } = useQuery({
 *   queryKey: queryKeys.invoices.list({ status: 'EMITTED' }),
 *   queryFn: () => getInvoices()
 * })
 * 
 * // Invalidar en mutaciones
 * queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
 */

export const queryKeys = {
    // Facturas
    invoices: {
        all: ['invoices'] as const,
        lists: () => [...queryKeys.invoices.all, 'list'] as const,
        list: (filters?: Record<string, unknown>) =>
            filters
                ? ([...queryKeys.invoices.lists(), filters] as const)
                : queryKeys.invoices.lists(),
        details: () => [...queryKeys.invoices.all, 'detail'] as const,
        detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
    },

    // Clientes/Customers
    customers: {
        all: ['customers'] as const,
        lists: () => [...queryKeys.customers.all, 'list'] as const,
        list: (clientId: string) =>
            [...queryKeys.customers.lists(), clientId] as const,
        detail: (id: string) =>
            [...queryKeys.customers.all, 'detail', id] as const,
    },

    // Dashboard Stats
    dashboard: {
        all: ['dashboard'] as const,
        stats: (clientId: string) =>
            [...queryKeys.dashboard.all, 'stats', clientId] as const,
        overview: () => [...queryKeys.dashboard.all, 'overview'] as const,
    },

    // Folios
    folios: {
        all: ['folios'] as const,
        assignments: (clientId: string) =>
            [...queryKeys.folios.all, 'assignments', clientId] as const,
        pools: () => [...queryKeys.folios.all, 'pools'] as const,
    },

    // Configuración
    config: {
        all: ['config'] as const,
        hka: () => [...queryKeys.config.all, 'hka'] as const,
        client: (clientId: string) =>
            [...queryKeys.config.all, 'client', clientId] as const,
    },
} as const

// Helper types para tipo-seguro
export type QueryKeys = typeof queryKeys
