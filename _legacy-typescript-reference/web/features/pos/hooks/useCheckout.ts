"use client";

import { useState } from "react";
import { usePosStore } from "../stores/pos.store";
import { processSaleAction } from "@/app/actions/pos/process-sale.action";
import { CheckoutPreference } from "../types/pos-types";
import { useToast } from "@shared/hooks/use-toast";
import { printReceipt } from "../utils/print-receipt";

export type CheckoutStatus = 'IDLE' | 'VALIDATING_STOCK' | 'PROCESSING_DGI' | 'PROCESSING_INTERNAL' | 'SUCCESS' | 'ERROR';

export function useCheckout() {
    const {
        cart,
        getTotal,
        paymentMethod,
        discount,
        notes,
        paymentDetails,
        clearCart,
        checkoutPreference,
        checkoutThreshold,
        customer // NEW: Extracted customer from store
    } = usePosStore();

    const [status, setStatus] = useState<CheckoutStatus>('IDLE');
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [lastInvoice, setLastInvoice] = useState<any>(null);
    const [stockValidationErrors, setStockValidationErrors] = useState<string[]>([]);
    const { toast } = useToast();

    // Validate stock availability before processing
    const validateStock = async (): Promise<boolean> => {
        try {
            setStatus('VALIDATING_STOCK');

            const response = await fetch('/api/pos/validate-cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(item => ({
                        productId: item.id,
                        quantity: item.quantity
                    }))
                })
            });

            const result = await response.json();

            if (!result.valid) {
                const errors = result.unavailableItems?.map((item: any) =>
                    `${item.productName}: solo ${item.availableStock} disponible (pedido: ${item.requestedQuantity})`
                ) || ['Stock insuficiente para algunos productos'];

                setStockValidationErrors(errors);
                toast({
                    variant: "destructive",
                    title: "Stock Insuficiente",
                    description: errors[0]
                });
                setStatus('IDLE');
                return false;
            }

            setStockValidationErrors([]);
            return true;
        } catch (error) {
            console.error('Stock validation error:', error);
            // On validation error, proceed anyway (graceful degradation)
            toast({
                variant: "default",
                title: "Advertencia",
                description: "No se pudo validar stock. Procediendo con la venta."
            });
            return true;
        }
    };

    const processInternal = async () => {
        setStatus('PROCESSING_INTERNAL');
        try {
            const result = await processSaleAction(cart, paymentMethod, {
                internalOnly: true,
                discount,
                notes,
                paymentDetails,
                customer
            });

            if (result.success && result.invoiceId) {
                const invoiceSnapshot = {
                    id: result.invoiceId,
                    number: result.invoiceNumber,
                    issueDate: result.issueDate ? new Date(result.issueDate) : new Date(),
                    isInternal: true,
                    items: [...cart],
                };

                toast({
                    title: "Comprobante Interno Generado",
                    description: `Documento ${result.invoiceNumber} creado.`,
                });

                // Generate and download PDF
                try {
                    const { generateInternalInvoicePDF } = await import('@/app/actions/pos/generate-internal-pdf.action');
                    const pdfResult = await generateInternalInvoicePDF({ invoiceId: result.invoiceId });

                    if (pdfResult.success && pdfResult.data) {
                        const linkSource = `data:${pdfResult.data.mimeType};base64,${pdfResult.data.pdfBase64}`;
                        const downloadLink = document.createElement('a');
                        downloadLink.href = linkSource;
                        downloadLink.download = pdfResult.data.filename;
                        downloadLink.click();
                    }
                } catch (e) {
                    console.error("PDF Generation failed", e);
                    toast({
                        variant: "destructive",
                        title: "Advertencia",
                        description: "Venta registrada pero falló la descarga del PDF.",
                    });
                }

                setLastInvoice(invoiceSnapshot);
                clearCart();
                setStatus('SUCCESS');
            } else {
                throw new Error(result.error || "Fallo al crear comprobante interno");
            }
        } catch (error: any) {
            console.error("Internal Checkout Error", error);
            setStatus('ERROR');
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al procesar venta interna."
            });
            setTimeout(() => setStatus('IDLE'), 3000);
        }
    };

    const processDGI = async () => {
        setStatus('PROCESSING_DGI');
        try {
            const result = await processSaleAction(cart, paymentMethod, {
                discount,
                notes,
                paymentDetails,
                customer
            });

            if (result.success) {
                const invoiceData = {
                    id: result.invoiceId,
                    number: result.invoiceNumber,
                    cufe: result.cufe,
                    authProtocol: result.authProtocol,
                    issueDate: result.issueDate ? new Date(result.issueDate) : new Date(),
                    items: [...cart]
                };
                setLastInvoice(invoiceData);

                toast({
                    title: "Factura DGI Exitosa",
                    description: `Factura #${result.invoiceNumber} emitida.`,
                });

                clearCart();
                setStatus('SUCCESS');

                setTimeout(() => {
                    printReceipt("pos-receipt-template");
                }, 500);

            } else {
                throw new Error(result.error || "Fallo al emitir a DGI");
            }
        } catch (error: any) {
            console.error("DGI Checkout Error", error);
            setStatus('ERROR');
            toast({
                variant: "destructive",
                title: "Error DGI",
                description: error.message || "Error de comunicación con PAC/DGI."
            });
            setTimeout(() => setStatus('IDLE'), 3000);
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (paymentMethod === 'MIXED' && paymentDetails) {
            const totalPaid = (paymentDetails.cashAmount || 0) +
                (paymentDetails.cardAmount || 0) +
                (paymentDetails.transferAmount || 0);
            if (Math.abs(totalPaid - getTotal()) > 0.01) {
                toast({
                    variant: "destructive",
                    title: "Pago incompleto",
                    description: `Falta pagar.`
                });
                return;
            }
        }

        const isStockValid = await validateStock();
        if (!isStockValid) return;

        const total = getTotal();

        switch (checkoutPreference) {
            case CheckoutPreference.ALWAYS_DGI:
                processDGI();
                break;
            case CheckoutPreference.INTERNAL_ONLY:
                processInternal();
                break;
            case CheckoutPreference.AUTO_THRESHOLD:
                if (total >= checkoutThreshold) {
                    processDGI();
                } else {
                    processInternal();
                }
                break;
            case CheckoutPreference.ASK_ALWAYS:
                setShowDecisionModal(true);
                break;
            default:
                processDGI();
        }
    };

    const confirmChoice = (choice: 'DGI' | 'INTERNAL') => {
        setShowDecisionModal(false);
        if (choice === 'DGI') processDGI();
        else processInternal();
    };

    const resetSale = () => {
        clearCart();
        setLastInvoice(null);
        setStatus('IDLE');
    };

    return {
        handleCheckout,
        confirmChoice,
        status,
        showDecisionModal,
        setShowDecisionModal,
        lastInvoice,
        isProcessing: status === 'VALIDATING_STOCK' || status === 'PROCESSING_DGI' || status === 'PROCESSING_INTERNAL',
        stockValidationErrors,
        resetSale
    };
}
