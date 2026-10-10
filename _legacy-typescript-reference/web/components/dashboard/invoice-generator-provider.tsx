"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import { DocumentCreator } from "@/features/invoicing/ui/document-creator"
import { useRouter } from "next/navigation"
import { useQueryInvalidation } from "@/hooks/useServerActionMutation"
import { type DocumentMode } from "@/shared/hooks/use-document-form"

interface OpenGeneratorOptions {
    /** Pre-loaded HKA data (from file import) */
    data?: any
    /** Document mode */
    documentMode?: DocumentMode
}

interface InvoiceGeneratorContextType {
    openGenerator: (options?: OpenGeneratorOptions | any) => void
    closeGenerator: () => void
    optimisticInvoices: any[]
    addOptimisticInvoice: (invoice: any) => void
}

const InvoiceGeneratorContext = createContext<InvoiceGeneratorContextType | undefined>(undefined)

export function InvoiceGeneratorProvider({
    children,
    clientId,
}: {
    children: ReactNode;
    /** Tenant ID from the authenticated session (session.user.clientId).
     *  Passed by the server component that wraps this provider so the
     *  localStorage draft key is namespaced per tenant. */
    clientId?: string;
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [initialData, setInitialData] = useState<any>(null)
    const [initialDocumentMode, setInitialDocumentMode] = useState<DocumentMode>('FACTURA')
    const [optimisticInvoices, setOptimisticInvoices] = useState<any[]>([])

    const router = useRouter()
    const { invalidateAll } = useQueryInvalidation()

    const openGenerator = (options?: OpenGeneratorOptions | any) => {
        // Support both old API (raw data) and new API ({ data, documentMode })
        if (options && typeof options === 'object' && ('documentMode' in options || 'data' in options)) {
            const opts = options as OpenGeneratorOptions
            setInitialData(opts.data || null)
            setInitialDocumentMode(opts.documentMode || 'FACTURA')
        } else if (options) {
            // Legacy: raw HKA data passed directly
            setInitialData(options)
            setInitialDocumentMode('FACTURA')
        } else {
            setInitialData(null)
            setInitialDocumentMode('FACTURA')
        }
        setIsOpen(true)
    }

    const closeGenerator = () => {
        setIsOpen(false)
        setInitialData(null)
        setInitialDocumentMode('FACTURA')
    }

    const addOptimisticInvoice = (invoice: any) => {
        setOptimisticInvoices(prev => [invoice, ...prev])
    }

    const handleSuccess = () => {
        setOptimisticInvoices([])
        invalidateAll()
        router.refresh()
    }

    return (
        <InvoiceGeneratorContext.Provider value={{
            openGenerator,
            closeGenerator,
            optimisticInvoices,
            addOptimisticInvoice
        }}>
            {children}
            <DocumentCreator
                isOpen={isOpen}
                onClose={closeGenerator}
                onSuccess={handleSuccess}
                onStartEmit={addOptimisticInvoice}
                initialData={initialData}
                initialDocumentMode={initialDocumentMode}
                draftKey={clientId ?? 'no-session'}
            />
        </InvoiceGeneratorContext.Provider>
    )
}

export function useInvoiceGenerator() {
    const context = useContext(InvoiceGeneratorContext)
    if (context === undefined) {
        throw new Error("useInvoiceGenerator must be used within a InvoiceGeneratorProvider")
    }
    return context
}
