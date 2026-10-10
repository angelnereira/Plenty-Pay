'use client';

import { Invoice } from "@/actions/invoice-actions";
import { MobileInvoiceCard } from "@/features/invoicing/ui/mobile/mobile-invoice-card";
import { EnhancedInvoiceTable } from "@/features/invoicing/ui/enhanced-invoice-table";

interface ResponsiveInvoiceListProps {
    invoices: Invoice[];
    isLoading?: boolean;
    /** Optional callback for invoice list refresh after operations */
    onSuccess?: () => void;
}

export function ResponsiveInvoiceList({ invoices, isLoading, onSuccess }: ResponsiveInvoiceListProps) {
    if (invoices.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-muted-foreground">No hay facturas para mostrar</p>
            </div>
        )
    }

    return (
        <>
            {/* Mobile View */}
            <div className="md:hidden space-y-3">
                {invoices.map((invoice) => (
                    <MobileInvoiceCard
                        key={invoice.id}
                        id={invoice.id}
                        folio={invoice.folio}
                        clientName={invoice.clientName || invoice.receiverName}
                        clientRuc={invoice.clientRuc || invoice.receiverRuc || 'N/A'}
                        total={invoice.total}
                        status={invoice.status}
                        documentType={invoice.documentType}
                        createdAt={invoice.createdAt}
                        currency={invoice.currency}
                        cufe={invoice.cufe}
                        onSuccess={onSuccess}
                    />
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block premium-card p-0 overflow-hidden">
                <EnhancedInvoiceTable invoices={invoices} onRefresh={onSuccess} />
            </div>
        </>
    );
}
