"use client";

import { usePosStore } from "../stores/pos.store";
import { Button } from "@shared/ui/button";
import { Trash2, Minus, Plus, ShoppingCart, CreditCard, Tag, StickyNote, Loader2, Percent, DollarSign, X, FileEdit, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@shared/hooks/use-toast";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { RECEIPT_TEMPLATES, ReceiptData } from "./receipt-templates";
import { useCheckout } from "../hooks/useCheckout";
import { PosSuccessModal } from "./PosSuccessModal";
import { PosInternalSuccessModal } from "./PosInternalSuccessModal";
import { LineDiscountControl } from "./LineDiscountControl";
import { MotorEntityCombobox } from "@/components/motor/MotorEntityCombobox";
import type { MotorEntitySummary } from "@/shared/hooks/use-motor-search";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction
} from "@shared/ui/alert-dialog";

/** Mapea MotorEntityKind → tipoClienteFE DGI */
const KIND_TO_TIPO: Record<string, string> = {
    CLIENT: '01',
    SUPPLIER: '01',
    PARTNER: '01',
    PROSPECT: '02',
    INTERNAL: '01',
};

export function PosCart() {
    const {
        cart,
        removeFromCart,
        updateQuantity,
        setLineDiscount,
        getSubtotal,
        getLineDiscountAmount,
        getLineDiscountForItem,
        getDiscountAmount,
        getTaxAmount,
        getTotal,
        clearCart,
        selectedTemplate,
        paymentMethod,
        discount,
        setDiscount,
        notes,
        setNotes,
        customer,
        setCustomer
    } = usePosStore();

    const {
        handleCheckout,
        confirmChoice,
        status,
        isProcessing,
        showDecisionModal,
        setShowDecisionModal,
        lastInvoice,
        resetSale
    } = useCheckout();

    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
    const [discountValue, setDiscountValue] = useState('');
    const { toast } = useToast();

    // Hydration safety - wait for client mount before using persisted state
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const subtotal = getSubtotal();
    const lineDiscountAmount = getLineDiscountAmount();
    const discountAmount = getDiscountAmount();
    const taxAmount = getTaxAmount();
    const total = getTotal();

    const cartLength = mounted ? cart.length : 0;

    const applyDiscount = () => {
        const value = parseFloat(discountValue);
        if (!value || value <= 0) {
            toast({
                variant: "destructive",
                title: "Descuento inválido",
                description: "Ingrese un valor válido mayor a 0"
            });
            return;
        }

        if (discountType === 'PERCENTAGE' && value > 100) {
            toast({
                variant: "destructive",
                title: "Porcentaje inválido",
                description: "El porcentaje no puede ser mayor a 100%"
            });
            return;
        }

        setDiscount({ type: discountType, value });
        setShowDiscountInput(false);
        setDiscountValue('');
        toast({
            title: "Descuento aplicado",
            description: discountType === 'PERCENTAGE'
                ? `${value}% de descuento`
                : `$${value.toFixed(2)} de descuento`
        });
    };

    const removeDiscount = () => {
        setDiscount(null);
        setDiscountValue('');
    };

    const handleCustomerSelect = (entity: MotorEntitySummary) => {
        const tipo = KIND_TO_TIPO[entity.kind] ?? '01';
        
        // Extract extra info from customFields if available
        const customFields = (entity.customFields ?? {}) as Record<string, any>;
        const dv = customFields.dv || customFields.digitoVerificador || undefined;
        const address = customFields.address || customFields.direccion || undefined;

        setCustomer({
            id: entity.id,
            tipoClienteFE: tipo,
            razonSocial: entity.displayName,
            numeroRUC: entity.documentNumber ?? undefined,
            digitoVerificadorRUC: dv,
            correoElectronico1: entity.primaryEmail ?? undefined,
            telefono1: entity.primaryPhone ?? undefined,
            direccion: address,
        });
    };

    // Status Text Map
    const statusText = {
        'IDLE': 'COBRAR',
        'VALIDATING_STOCK': 'VERIFICANDO STOCK...',
        'PROCESSING_DGI': 'EMITIENDO DGI...',
        'PROCESSING_OFFLINE': 'PROCESANDO OFFLINE...',
        'PROCESSING_INTERNAL': 'GENERANDO TICKET...',
        'SUCCESS': 'ÉXITO',
        'ERROR': 'REINTENTAR'
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-transparent border-l dark:border-white/[0.1]">
            {/* Header */}
            <div className="p-6 border-b dark:border-white/[0.1] flex items-center justify-between shrink-0 bg-white dark:bg-white/[0.08] z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h2 className="font-black text-lg text-gray-900 dark:text-white leading-none">CARRITO</h2>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cartLength} ÍTEMS</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    disabled={cartLength === 0}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 h-8 font-bold text-[10px] uppercase tracking-wider"
                >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Vaciar
                </Button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 custom-scrollbar bg-gray-50/30 dark:bg-white/[0.03]">
                {!mounted ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">Cargando...</p>
                    </div>
                ) : cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30">
                        <div className="bg-gray-100 dark:bg-white/[0.04] p-6 rounded-full mb-4">
                            <ShoppingCart className="h-12 w-12" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest">El carrito está vacío</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {cart.map((item) => (
                            <div key={item.id} className="group flex flex-col gap-2 bg-white dark:bg-white/[0.05] p-3 rounded-xl border border-gray-100 dark:border-white/[0.1] hover:border-violet-200 dark:hover:border-violet-900/50 transition-all shadow-sm">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate mb-0.5">{item.name}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                            $ {item.price.toFixed(2)} por unidad
                                        </p>
                                    </div>
                                    <span className="font-black text-sm text-gray-900 dark:text-white shrink-0">
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-white/[0.06]">
                                    <div className="flex items-center bg-gray-50 dark:bg-white/[0.06] rounded-lg p-0.5 border dark:border-white/[0.1]">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-gray-500 hover:text-red-500"
                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center text-xs font-black text-gray-700 dark:text-gray-300">
                                            {item.quantity}
                                        </span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-gray-500 hover:text-violet-600"
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeFromCart(item.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* Descuento por línea (HKA: precioUnitarioDescuento) */}
                                <div className="flex items-center justify-between gap-2">
                                    <LineDiscountControl
                                        lineSubtotal={item.price * item.quantity}
                                        lineDiscount={item.lineDiscount}
                                        onChange={(d) => setLineDiscount(item.id, d)}
                                    />
                                    {getLineDiscountForItem(item.id) > 0 && (
                                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                                            -${getLineDiscountForItem(item.id).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - Totals and Actions */}
            {cartLength > 0 && (
                <div className="border-t dark:border-white/[0.1] bg-white dark:bg-white/[0.08] flex flex-col shrink-0">
                    {/* Scrollable Controls Area */}
                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide custom-scrollbar border-b dark:border-white/[0.1] bg-gray-50/50 dark:bg-white/[0.02]">
                        {/* Discount Section */}
                        <div className="p-4 border-b border-dashed dark:border-white/[0.1]">
                            {!discount ? (
                                !showDiscountInput ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-9 text-[10px] font-bold uppercase tracking-widest border-dashed border-gray-300 dark:border-white/[0.08]"
                                        onClick={() => setShowDiscountInput(true)}
                                    >
                                        <Tag className="h-3.5 w-3.5 mr-2 text-violet-500" />
                                        Agregar Descuento
                                    </Button>
                                ) : (
                                    <div className="space-y-3 bg-white dark:bg-white/[0.06] p-3 rounded-xl border dark:border-white/[0.1]">
                                        <div className="flex gap-2">
                                            <Button
                                                variant={discountType === 'PERCENTAGE' ? 'default' : 'outline'}
                                                size="sm"
                                                className="flex-1 h-8 text-[10px] font-bold"
                                                onClick={() => setDiscountType('PERCENTAGE')}
                                            >
                                                <Percent className="h-3 w-3 mr-1" />
                                                PORCENTAJE
                                            </Button>
                                            <Button
                                                variant={discountType === 'FIXED' ? 'default' : 'outline'}
                                                size="sm"
                                                className="flex-1 h-8 text-[10px] font-bold"
                                                onClick={() => setDiscountType('FIXED')}
                                            >
                                                <DollarSign className="h-3 w-3 mr-1" />
                                                FIJO
                                            </Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder={discountType === 'PERCENTAGE' ? '10%' : '$5.00'}
                                                value={discountValue}
                                                onChange={(e) => setDiscountValue(e.target.value)}
                                                className="h-9 text-sm font-bold"
                                            />
                                            <Button size="sm" onClick={applyDiscount} className="h-9 font-bold">
                                                APLICAR
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 p-0 text-gray-400"
                                                onClick={() => {
                                                    setShowDiscountInput(false);
                                                    setDiscountValue('');
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-900/30">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-green-500 p-1 rounded-full">
                                            <Tag className="h-3 w-3 text-white" />
                                        </div>
                                        <span className="text-xs font-black text-green-700 dark:text-green-400 uppercase">
                                            {discount.type === 'PERCENTAGE' ? `${discount.value}%` : `$${discount.value.toFixed(2)}`} DESCUENTO
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-green-600 hover:text-red-500 hover:bg-red-50"
                                        onClick={removeDiscount}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Customer Section */}
                        <div className="p-4 border-b border-dashed dark:border-white/[0.1]">
                            <Label className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-gray-500">
                                <User className="h-3.5 w-3.5" />
                                Cliente / Entidad
                            </Label>
                            
                            {customer ? (
                                <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/10 p-3 rounded-xl border border-violet-100 dark:border-violet-900/30">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-black text-violet-700 dark:text-violet-400">
                                            {customer.razonSocial}
                                        </span>
                                        <span className="text-[10px] text-violet-600/70 dark:text-violet-400/70">
                                            {customer.numeroRUC ? `RUC: ${customer.numeroRUC}` : 'Consumidor Final'}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-violet-600 hover:text-red-500 hover:bg-red-50"
                                        onClick={() => setCustomer(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <MotorEntityCombobox 
                                        placeholder="Buscar cliente (opcional)..." 
                                        onSelect={handleCustomerSelect}
                                        preloadRecent
                                    />
                                    <p className="text-[10px] text-gray-400 pl-1">
                                        Si no se selecciona, se emite a Consumidor Final.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Notes Section */}
                        <div className="p-4 border-b border-dashed dark:border-white/[0.1]">
                            <Label className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-gray-500">
                                <StickyNote className="h-3.5 w-3.5" />
                                Notas de la venta
                            </Label>
                            <Textarea
                                placeholder="Escribe notas aquí..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[60px] text-sm resize-none bg-white dark:bg-white/[0.06] border-gray-100 dark:border-white/[0.1] focus:ring-violet-500"
                            />
                        </div>

                        {/* Payment Method */}
                        <div className="p-4">
                            <PaymentMethodSelector variant="desktop" />
                        </div>
                    </div>

                    {/* Fixed Bottom Section (Totals + Actions) */}
                    <div className="p-6 space-y-4 bg-white dark:bg-white/[0.1] shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] z-20">
                        <div className="space-y-2">
                            {(lineDiscountAmount > 0 || discountAmount > 0) && (
                                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                                    <span className="font-bold text-sm leading-none">${subtotal.toFixed(2)}</span>
                                </div>
                            )}

                            {lineDiscountAmount > 0 && (
                                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Descuento por ítem</span>
                                    <span className="font-bold text-sm leading-none">-${lineDiscountAmount.toFixed(2)}</span>
                                </div>
                            )}

                            {discountAmount > 0 && (
                                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Descuento global</span>
                                    <span className="font-bold text-sm leading-none">-${discountAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                                <span className="text-[10px] font-bold uppercase tracking-widest">ITBMS (7%)</span>
                                <span className="font-bold text-sm leading-none">${taxAmount.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-end pt-2 border-t dark:border-white/[0.1] mt-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pb-1">Total a Pagar</span>
                                <span className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">
                                    ${total.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons - UNIFIED BUTTON */}
                        <div className="grid grid-cols-1">
                            <Button
                                className="h-14 text-sm font-black uppercase tracking-[0.2em] bg-violet-600 hover:bg-violet-700 shadow-xl shadow-violet-500/30 text-white transition-all transform active:scale-[0.98] disabled:opacity-50"
                                onClick={handleCheckout}
                                disabled={cartLength === 0 || isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                        {statusText[status]}
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="mr-3 h-5 w-5" />
                                        {status === 'SUCCESS' ? 'VENTA COMPLETADA' : 'COBRAR'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Receipt Template - Dynamic based on selection */}
            {lastInvoice && (() => {
                const ReceiptComponent = RECEIPT_TEMPLATES[selectedTemplate];
                const receiptData: ReceiptData = {
                    id: "pos-receipt-template",
                    items: lastInvoice.items || cart,
                    total: total,
                    subtotal: subtotal,
                    tax: taxAmount,
                    discount: discountAmount,
                    invoiceNumber: lastInvoice.number,
                    date: lastInvoice.issueDate || new Date(),
                    cufe: lastInvoice.cufe,
                    authProtocol: lastInvoice.authProtocol,
                    paymentMethod: paymentMethod,
                    notes: notes || undefined,
                    customerInfo: customer ? {
                        name: customer.razonSocial,
                        ruc: customer.numeroRUC || undefined,
                        email: customer.correoElectronico1 || undefined
                    } : undefined,
                    businessInfo: {
                        name: "PLENTYPAY",
                        ruc: "PENDIENTE",
                        address: "Ciudad de Panamá",
                        phone: "222-2222"
                    }
                };
                return <ReceiptComponent {...receiptData} />;
            })()}

            <AlertDialog open={showDecisionModal} onOpenChange={setShowDecisionModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Seleccione Tipo de Documento</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Cómo desea procesar esta venta?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:space-x-4">
                        <AlertDialogCancel onClick={() => confirmChoice('INTERNAL')} className="bg-gray-100 hover:bg-gray-200 text-gray-800 border-0 h-12">
                            <StickyNote className="mr-2 h-4 w-4" />
                            Comprobante Interno
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmChoice('DGI')} className="bg-violet-600 hover:bg-violet-700 h-12">
                            <FileEdit className="mr-2 h-4 w-4" />
                            Factura Fiscal (DGI)
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Success Modal: Internal (sin CUFE) usa modal simple, DGI el modal con CUFE+QR. */}
            {status === 'SUCCESS' && lastInvoice && (
                lastInvoice.isInternal ? (
                    <PosInternalSuccessModal
                        invoice={{
                            id: lastInvoice.id,
                            number: lastInvoice.number || lastInvoice.invoiceNumber || '',
                            issueDate: lastInvoice.issueDate,
                        }}
                        onClose={resetSale}
                        onNewSale={resetSale}
                    />
                ) : (
                    <PosSuccessModal
                        invoice={lastInvoice}
                        onClose={resetSale}
                        onNewSale={resetSale}
                    />
                )
            )}
        </div>
    );
}
