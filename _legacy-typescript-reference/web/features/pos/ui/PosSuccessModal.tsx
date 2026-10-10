"use client";

import { InvoiceSuccessModal } from "@/features/invoicing/ui/invoice-success-modal";
import { useSession } from "next-auth/react";

interface PosSuccessModalProps {
    invoice: {
        id: string;
        number: string;
        cufe?: string;
        qrUrl?: string;
        // Offline-mode fields populated by processOffline()
        offline?: boolean;
        businessName?: string;
        businessRuc?: string;
        businessDv?: string;
        businessAddress?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        discount?: number;
        paymentMethod?: string;
        issueDate?: Date;
        items?: Array<{ id: string; name: string; quantity: number; price: number; taxRate?: number }>;
        /** Pre-generated PDF blob URL (created in processOffline with static imports) */
        offlinePdfBlobUrl?: string;
    };
    onClose: () => void;
    onNewSale: () => void;
}

export function PosSuccessModal({ invoice, onClose, onNewSale }: PosSuccessModalProps) {
    const { data: session } = useSession();
    const logisticsEnabled = session?.user?.logisticsEnabled ?? false;

    const offlineData = invoice.offline ? {
        items: invoice.items || [],
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        total: invoice.total || 0,
        discount: invoice.discount,
        paymentMethod: invoice.paymentMethod || 'CASH',
        issueDate: invoice.issueDate || new Date(),
        businessName: invoice.businessName || '',
        businessRuc: invoice.businessRuc || '',
        businessDv: invoice.businessDv || '',
        businessAddress: invoice.businessAddress || '',
    } : undefined;

    return (
        <InvoiceSuccessModal
            isOpen={true}
            invoiceId={invoice.id}
            invoiceNumber={invoice.number}
            cufe={invoice.cufe || ""}
            qrCodeUrl={invoice.qrUrl || invoice.cufe || ""}
            onClose={onClose}
            onNewInvoice={onNewSale}
            logisticsEnabled={logisticsEnabled}
            isOffline={invoice.offline}
            offlineData={offlineData}
            offlinePdfBlobUrl={invoice.offlinePdfBlobUrl}
        />
    );
}
