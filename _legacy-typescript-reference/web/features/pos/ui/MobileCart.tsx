"use client";

import { usePosStore } from "../stores/pos.store";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import {
    Trash2,
    Minus,
    Plus,
    ShoppingCart,
    CreditCard,
    ChevronDown,
    FileEdit,
    StickyNote,
    Loader2,
    Tag,
    Percent,
    DollarSign,
    X,
    AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@shared/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { cn } from "@/lib/utils";
import "./pos-mobile.css";
import { useCheckout } from "../hooks/useCheckout";
import { LineDiscountControl } from "./LineDiscountControl";
import { PosSuccessModal } from "./PosSuccessModal";
import { PosInternalSuccessModal } from "./PosInternalSuccessModal";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@shared/ui/alert-dialog";

interface MobileCartProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MobileCart({ isOpen, onClose }: MobileCartProps) {
    const {
        cart,
        removeFromCart,
        updateQuantity,
        setLineDiscount,
        getLineDiscountForItem,
        getSubtotal,
        getLineDiscountAmount,
        getDiscountAmount,
        getTaxAmount,
        getTotal,
        clearCart,
        discount,
        setDiscount,
    } = usePosStore();

    const [checkoutStep, setCheckoutStep] = useState<'cart' | 'payment'>('cart');
    const { toast } = useToast();

    const {
        handleCheckout,
        confirmChoice,
        status,
        isProcessing,
        showDecisionModal,
        setShowDecisionModal,
        lastInvoice,
        resetSale,
    } = useCheckout();

    // Estado del editor de descuento global
    const [showGlobalDiscountInput, setShowGlobalDiscountInput] = useState(false);
    const [globalDiscountType, setGlobalDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
    const [globalDiscountValue, setGlobalDiscountValue] = useState('');

    const subtotal = getSubtotal();
    const lineDiscountAmount = getLineDiscountAmount();
    const globalDiscountAmount = getDiscountAmount();
    const taxAmount = getTaxAmount();
    const total = getTotal();

    const applyGlobalDiscount = () => {
        const v = parseFloat(globalDiscountValue);
        if (!Number.isFinite(v) || v <= 0) {
            toast({
                variant: 'destructive',
                title: 'Descuento inválido',
                description: 'Ingrese un valor mayor a 0.',
            });
            return;
        }
        if (globalDiscountType === 'PERCENTAGE' && v > 100) {
            toast({
                variant: 'destructive',
                title: 'Porcentaje inválido',
                description: 'No puede exceder 100%.',
            });
            return;
        }
        if (globalDiscountType === 'FIXED' && v >= subtotal - lineDiscountAmount) {
            toast({
                variant: 'destructive',
                title: 'Descuento excede el subtotal',
                description: 'Ajuste el monto.',
            });
            return;
        }
        setDiscount({ type: globalDiscountType, value: v });
        setShowGlobalDiscountInput(false);
        setGlobalDiscountValue('');
    };

    const removeGlobalDiscount = () => {
        setDiscount(null);
        setGlobalDiscountValue('');
    };

    // Wrapper around resetSale that also closes the drawer and resets checkout step.
    // This runs when the user dismisses the success modal (via "Close" or "New Sale").
    const handleResetSale = () => {
        resetSale();
        setCheckoutStep('cart');
        onClose();
    };

    const statusText = {
        IDLE: 'Confirmar Pago',
        VALIDATING_STOCK: 'Verificando stock...',
        PROCESSING_DGI: 'Emitiendo a DGI...',
        PROCESSING_INTERNAL: 'Generando ticket...',
        SUCCESS: '¡Éxito!',
        ERROR: 'Reintentar',
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-white/[0.06] rounded-t-3xl z-50 h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            {/* Drawer Handle */}
                            <div className="w-full h-12 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing border-b dark:border-white/[0.1] relative bg-white dark:bg-white/[0.06] z-10">
                                <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/[0.08] rounded-full" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-2 h-8 w-8 rounded-full"
                                    onClick={onClose}
                                >
                                    <ChevronDown className="h-5 w-5 text-gray-400" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gray-50 dark:bg-white/[0.03]">
                                {checkoutStep === 'cart' ? (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <ShoppingCart className="h-6 w-6 text-violet-600" />
                                                Carrito ({cart.length})
                                            </h2>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearCart}
                                                disabled={cart.length === 0}
                                                className="text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" /> Vaciar
                                            </Button>
                                        </div>

                                        {cart.length === 0 ? (
                                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                                <ShoppingCart className="h-16 w-16 mb-4" />
                                                <p className="text-lg">Tu carrito está vacío</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-3 pb-4">
                                                    {cart.map((item) => {
                                                        const itemLineSubtotal = item.price * item.quantity;
                                                        const itemDiscountAmt = getLineDiscountForItem(item.id);
                                                        return (
                                                            <motion.div
                                                                key={item.id}
                                                                layoutId={item.id}
                                                                className="bg-white dark:bg-white/[0.06] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-white/[0.1] space-y-2"
                                                            >
                                                                <div className="flex gap-3">
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-semibold text-sm line-clamp-2 mb-1">{item.name}</h4>
                                                                        <div className="text-violet-600 font-bold">
                                                                            ${itemLineSubtotal.toFixed(2)}
                                                                            {itemDiscountAmt > 0 && (
                                                                                <span className="ml-2 text-xs font-bold text-green-600">
                                                                                    -${itemDiscountAmt.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg p-1 h-fit self-center">
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 rounded-md hover:bg-white shadow-sm"
                                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                            aria-label="Disminuir cantidad"
                                                                        >
                                                                            <Minus className="h-4 w-4" />
                                                                        </Button>
                                                                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 rounded-md hover:bg-white shadow-sm"
                                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                            aria-label="Aumentar cantidad"
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Descuento por línea (HKA: precioUnitarioDescuento) */}
                                                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-white/[0.06]">
                                                                    <LineDiscountControl
                                                                        lineSubtotal={itemLineSubtotal}
                                                                        lineDiscount={item.lineDiscount}
                                                                        onChange={(d) => setLineDiscount(item.id, d)}
                                                                    />
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 text-gray-300 hover:text-red-500"
                                                                        onClick={() => removeFromCart(item.id)}
                                                                        aria-label="Eliminar ítem"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Descuento global */}
                                                <div className="bg-white dark:bg-white/[0.06] p-3 rounded-xl border border-gray-100 dark:border-white/[0.1]">
                                                    {!discount ? (
                                                        !showGlobalDiscountInput ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full h-10 text-xs font-bold uppercase tracking-wider border-dashed"
                                                                onClick={() => setShowGlobalDiscountInput(true)}
                                                            >
                                                                <Tag className="h-3.5 w-3.5 mr-2 text-violet-500" />
                                                                Agregar descuento global
                                                            </Button>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant={globalDiscountType === 'PERCENTAGE' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className="flex-1 h-9 text-xs font-bold"
                                                                        onClick={() => setGlobalDiscountType('PERCENTAGE')}
                                                                    >
                                                                        <Percent className="h-3 w-3 mr-1" />
                                                                        Porcentaje
                                                                    </Button>
                                                                    <Button
                                                                        variant={globalDiscountType === 'FIXED' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className="flex-1 h-9 text-xs font-bold"
                                                                        onClick={() => setGlobalDiscountType('FIXED')}
                                                                    >
                                                                        <DollarSign className="h-3 w-3 mr-1" />
                                                                        Monto B/.
                                                                    </Button>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        placeholder={globalDiscountType === 'PERCENTAGE' ? '10' : '5.00'}
                                                                        value={globalDiscountValue}
                                                                        onChange={(e) => setGlobalDiscountValue(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') applyGlobalDiscount();
                                                                        }}
                                                                        className="h-10 text-sm font-bold"
                                                                        aria-label="Valor del descuento global"
                                                                    />
                                                                    <Button size="sm" onClick={applyGlobalDiscount} className="h-10 px-4 font-bold">
                                                                        Aplicar
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-10 w-10 text-gray-400"
                                                                        onClick={() => {
                                                                            setShowGlobalDiscountInput(false);
                                                                            setGlobalDiscountValue('');
                                                                        }}
                                                                        aria-label="Cancelar"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/10 p-2 rounded-lg border border-green-100 dark:border-green-900/30">
                                                            <div className="flex items-center gap-2">
                                                                <Tag className="h-4 w-4 text-green-600" />
                                                                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">
                                                                    {discount.type === 'PERCENTAGE'
                                                                        ? `${discount.value}%`
                                                                        : `$${discount.value.toFixed(2)}`}
                                                                    {' descuento global'}
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-green-600 hover:text-red-500"
                                                                onClick={removeGlobalDiscount}
                                                                aria-label="Quitar descuento global"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    /* Payment Step */
                                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                        <div>
                                            <h2 className="text-xl font-bold mb-4">Método de Pago</h2>
                                            <PaymentMethodSelector variant="mobile" />
                                        </div>

                                        <div className="bg-white dark:bg-white/[0.06] p-4 rounded-xl border border-gray-100 dark:border-white/[0.1] space-y-3">
                                            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Resumen</h3>
                                            <div className="space-y-2 text-sm">
                                                {cart.map((item) => {
                                                    const lineDisc = getLineDiscountForItem(item.id);
                                                    return (
                                                        <div key={item.id} className="flex justify-between">
                                                            <span className="text-muted-foreground">
                                                                {item.quantity}x {item.name}
                                                                {lineDisc > 0 && (
                                                                    <span className="ml-1 text-[10px] text-green-600">
                                                                        (-${lineDisc.toFixed(2)})
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="border-t pt-2 mt-2 space-y-1">
                                                {(lineDiscountAmount > 0 || globalDiscountAmount > 0) && (
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Subtotal</span>
                                                        <span>${subtotal.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {lineDiscountAmount > 0 && (
                                                    <div className="flex justify-between text-green-600">
                                                        <span>Descuento por ítem</span>
                                                        <span>-${lineDiscountAmount.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {globalDiscountAmount > 0 && (
                                                    <div className="flex justify-between text-green-600">
                                                        <span>Descuento global</span>
                                                        <span>-${globalDiscountAmount.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>ITBMS (7%)</span>
                                                    <span>${taxAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-lg font-black mt-2 pt-2 border-t">
                                                    <span>Total a Pagar</span>
                                                    <span className="text-violet-600">${total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Actions */}
                            <div className="p-4 pb-24 bg-white dark:bg-white/[0.06] border-t dark:border-white/[0.1] flex-shrink-0 safe-area-bottom">
                                {checkoutStep === 'cart' ? (
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <div className="text-xs text-center text-muted-foreground mb-1">Total</div>
                                            <div className="text-2xl font-black text-center text-gray-900 dark:text-white">
                                                ${total.toFixed(2)}
                                            </div>
                                        </div>
                                        <Button
                                            className="flex-[2] h-14 text-lg font-bold rounded-xl bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/30"
                                            onClick={() => setCheckoutStep('payment')}
                                            disabled={cart.length === 0}
                                        >
                                            Pagar <CreditCard className="ml-2 h-5 w-5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            className="h-14 w-14 rounded-xl flex-shrink-0"
                                            onClick={() => setCheckoutStep('cart')}
                                            disabled={isProcessing}
                                            aria-label="Volver al carrito"
                                        >
                                            <ChevronDown className="h-6 w-6 rotate-90" />
                                        </Button>
                                        <Button
                                            className={cn(
                                                "flex-1 h-14 text-lg font-bold rounded-xl shadow-lg shadow-violet-500/30",
                                                status === 'ERROR'
                                                    ? "bg-red-600 hover:bg-red-700"
                                                    : "bg-violet-600 hover:bg-violet-700"
                                            )}
                                            onClick={handleCheckout}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    {statusText[status]}
                                                </>
                                            ) : status === 'ERROR' ? (
                                                <>
                                                    <AlertCircle className="mr-2 h-5 w-5" />
                                                    Reintentar
                                                </>
                                            ) : (
                                                <>Confirmar Pago</>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Modal de elección DGI / Interno (preferencia ASK_ALWAYS) */}
            <AlertDialog open={showDecisionModal} onOpenChange={setShowDecisionModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Seleccione tipo de documento</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Cómo desea procesar esta venta?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4">
                        <AlertDialogCancel
                            onClick={() => confirmChoice('INTERNAL')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 border-0 h-12 w-full sm:w-auto"
                        >
                            <StickyNote className="mr-2 h-4 w-4" />
                            Comprobante Interno
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmChoice('DGI')}
                            className="bg-violet-600 hover:bg-violet-700 h-12 w-full sm:w-auto"
                        >
                            <FileEdit className="mr-2 h-4 w-4" />
                            Factura Fiscal (DGI)
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal de éxito.
                Internal (sin CUFE) → modal simple con número de comprobante.
                DGI → mismo modal que factura manual (CUFE, QR, descarga PDF). */}
            {status === 'SUCCESS' && lastInvoice && lastInvoice.id && (
                lastInvoice.isInternal ? (
                    <PosInternalSuccessModal
                        invoice={{
                            id: lastInvoice.id,
                            number: lastInvoice.number || lastInvoice.invoiceNumber || '',
                            issueDate: lastInvoice.issueDate,
                        }}
                        onClose={handleResetSale}
                        onNewSale={handleResetSale}
                    />
                ) : (
                    <PosSuccessModal
                        invoice={{
                            id: lastInvoice.id,
                            number: lastInvoice.number || lastInvoice.invoiceNumber || '',
                            cufe: lastInvoice.cufe,
                            qrUrl: lastInvoice.qrCode || lastInvoice.cufe,
                        }}
                        onClose={handleResetSale}
                        onNewSale={handleResetSale}
                    />
                )
            )}
        </>
    );
}
