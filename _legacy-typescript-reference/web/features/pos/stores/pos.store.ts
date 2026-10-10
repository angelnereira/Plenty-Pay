import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { ReceiptTemplateType } from '../ui/receipt-templates';
import type { PaymentMethod, PaymentDetails, Discount, ViewMode, PosFilters, CheckoutPreference } from '../types/pos-types';
import { DEFAULT_TAX_RATE } from '@/lib/constants/fiscal';
import { HISTORY } from '@/lib/constants/config';

export interface PosProduct {
    id: string;
    name: string;
    price: number;
    sku?: string;
    barcode?: string;
    image?: string;
    taxRate: number; // 0.07 for 7%
    stock: number;
    category?: string;
}

export interface PosCustomer {
    id?: string;
    tipoClienteFE: string; // '01', '02', '03', '04'
    tipoContribuyente?: string; // '1' o '2'
    razonSocial: string;
    numeroRUC?: string;
    digitoVerificadorRUC?: string;
    correoElectronico1?: string;
    telefono1?: string;
    direccion?: string;
}

export interface CartItem extends PosProduct {
    quantity: number;
    /**
     * Descuento aplicado SÓLO a esta línea del carrito.
     * Independiente del descuento global. Si está presente:
     *   - PERCENTAGE: porcentaje sobre (price × quantity)
     *   - FIXED: monto en B/. sobre el subtotal de esta línea
     * Mapea directamente a InvoiceItem.discount → precioUnitarioDescuento HKA.
     */
    lineDiscount?: Discount | null;
}

interface PosState {
    // User/Client isolation
    clientId: string | null;
    setClientId: (clientId: string) => void;

    // Checkout Configuration
    checkoutPreference: CheckoutPreference;
    checkoutThreshold: number;
    setCheckoutConfig: (preference: CheckoutPreference, threshold: number) => void;

    // Template selection
    selectedTemplate: ReceiptTemplateType;
    setSelectedTemplate: (template: ReceiptTemplateType) => void;

    // Categories
    categories: string[];
    setCategories: (categories: string[]) => void;

    // Filters
    filters: PosFilters;
    setFilters: (filters: Partial<PosFilters>) => void;
    clearFilters: () => void;

    // View Mode
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;

    // Payment
    paymentMethod: PaymentMethod;
    paymentDetails: PaymentDetails | null;
    setPaymentMethod: (method: PaymentMethod) => void;
    setPaymentDetails: (details: PaymentDetails) => void;

    // Discount
    discount: Discount | null;
    setDiscount: (discount: Discount | null) => void;

    // Customer (Motor Entity mapping)
    customer: PosCustomer | null;
    setCustomer: (customer: PosCustomer | null) => void;

    // Favorites
    favorites: string[];
    toggleFavorite: (productId: string) => void;

    // Cart
    cart: CartItem[];
    addToCart: (product: PosProduct) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    setLineDiscount: (productId: string, lineDiscount: Discount | null) => void;
    clearCart: () => void;

    // Notes
    notes: string;
    setNotes: (notes: string) => void;

    // Computed
    getTotal: () => number;
    getSubtotal: () => number;
    /** Suma de descuentos por-línea (lineDiscount × cantidad) en B/. */
    getLineDiscountAmount: () => number;
    /** Descuento global aplicado sobre (subtotal − lineDiscountAmount). */
    getDiscountAmount: () => number;
    getTaxAmount: () => number;
    /**
     * Descuento de una línea específica del carrito en B/. (resuelto a monto
     * absoluto sea PERCENTAGE o FIXED). Útil para UI por-ítem.
     */
    getLineDiscountForItem: (productId: string) => number;
}

const DEFAULT_FILTERS: PosFilters = {
    inStockOnly: false
};

export const usePosStore = create<PosState>()(
    temporal(
        persist(
            (set, get) => ({
                clientId: null,
                checkoutPreference: 'ALWAYS_DGI' as CheckoutPreference,
                checkoutThreshold: 20.00,
                selectedTemplate: 'modern' as ReceiptTemplateType,
                categories: [],
                filters: DEFAULT_FILTERS,
                viewMode: 'grid' as ViewMode,
                paymentMethod: 'CASH' as PaymentMethod,
                paymentDetails: null,
                discount: null,
                cart: [],
                notes: '',
                customer: null,

                setSelectedTemplate: (template) => set({ selectedTemplate: template }),

                setCategories: (categories) => set({ categories }),

                setFilters: (newFilters) => set((state) => ({
                    filters: { ...state.filters, ...newFilters }
                })),

                clearFilters: () => set({ filters: DEFAULT_FILTERS }),

                setViewMode: (mode) => set({ viewMode: mode }),

                setPaymentMethod: (method) => set({
                    paymentMethod: method,
                    // Clear payment details when changing method
                    paymentDetails: method === 'MIXED' ? { method } : null
                }),

                setPaymentDetails: (details) => set({ paymentDetails: details }),

                setDiscount: (discount) => set({ discount }),

                setNotes: (notes) => set({ notes }),

                setCustomer: (customer) => set({ customer }),

                setCheckoutConfig: (preference, threshold) => set({
                    checkoutPreference: preference,
                    checkoutThreshold: threshold
                }),

                favorites: [],
                toggleFavorite: (productId) => set((state) => {
                    const isFavorite = state.favorites.includes(productId);
                    return {
                        favorites: isFavorite
                            ? state.favorites.filter(id => id !== productId)
                            : [...state.favorites, productId]
                    };
                }),

                setClientId: (newClientId) => {
                    const currentClientId = get().clientId;

                    // If switching to a different client, clear the cart for security
                    if (currentClientId && currentClientId !== newClientId) {
                        // Security: Clear cart when client changes
                        set({
                            clientId: newClientId,
                            cart: [],
                            discount: null,
                            notes: '',
                            paymentDetails: null,
                            customer: null
                        });
                    } else {
                        set({ clientId: newClientId });
                    }
                },

                addToCart: (product) => set((state) => {
                    const existing = state.cart.find(item => item.id === product.id);
                    if (existing) {
                        return {
                            cart: state.cart.map(item =>
                                item.id === product.id
                                    ? { ...item, quantity: item.quantity + 1 }
                                    : item
                            )
                        };
                    }
                    return { cart: [...state.cart, { ...product, quantity: 1 }] };
                }),

                removeFromCart: (productId) => set((state) => ({
                    cart: state.cart.filter(item => item.id !== productId)
                })),

                updateQuantity: (productId, quantity) => set((state) => {
                    if (quantity <= 0) {
                        return { cart: state.cart.filter(item => item.id !== productId) };
                    }
                    return {
                        cart: state.cart.map(item =>
                            item.id === productId ? { ...item, quantity } : item
                        )
                    };
                }),

                setLineDiscount: (productId, lineDiscount) => set((state) => ({
                    cart: state.cart.map(item =>
                        item.id === productId ? { ...item, lineDiscount } : item
                    )
                })),

                clearCart: () => set({
                    cart: [],
                    discount: null,
                    notes: '',
                    paymentDetails: null,
                    customer: null
                }),

                getSubtotal: () => {
                    const { cart } = get();
                    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
                },

                getLineDiscountForItem: (productId) => {
                    const { cart } = get();
                    const item = cart.find(i => i.id === productId);
                    if (!item || !item.lineDiscount) return 0;
                    const lineSubtotal = item.price * item.quantity;
                    if (item.lineDiscount.type === 'PERCENTAGE') {
                        // Cap al 100% para evitar precio negativo.
                        const pct = Math.min(Math.max(item.lineDiscount.value, 0), 100);
                        return lineSubtotal * (pct / 100);
                    }
                    // FIXED: cap al subtotal de la línea para no negativos.
                    return Math.min(Math.max(item.lineDiscount.value, 0), lineSubtotal);
                },

                getLineDiscountAmount: () => {
                    const { cart } = get();
                    return cart.reduce(
                        (acc, item) => acc + get().getLineDiscountForItem(item.id),
                        0
                    );
                },

                getDiscountAmount: () => {
                    // Descuento GLOBAL aplicado sobre (subtotal − line discounts).
                    // Si el global es FIXED: monto absoluto, capeado para no
                    // generar total negativo.
                    const { discount } = get();
                    if (!discount) return 0;

                    const subtotal = get().getSubtotal();
                    const lineDiscountAmount = get().getLineDiscountAmount();
                    const baseAfterLine = Math.max(subtotal - lineDiscountAmount, 0);

                    if (discount.type === 'PERCENTAGE') {
                        const pct = Math.min(Math.max(discount.value, 0), 100);
                        return baseAfterLine * (pct / 100);
                    }
                    return Math.min(Math.max(discount.value, 0), baseAfterLine);
                },

                getTaxAmount: () => {
                    const subtotal = get().getSubtotal();
                    const lineDiscountAmount = get().getLineDiscountAmount();
                    const globalDiscountAmount = get().getDiscountAmount();
                    const taxableAmount = Math.max(
                        subtotal - lineDiscountAmount - globalDiscountAmount,
                        0
                    );
                    return taxableAmount * DEFAULT_TAX_RATE; // 7% ITBMS
                },

                getTotal: () => {
                    const subtotal = get().getSubtotal();
                    const lineDiscountAmount = get().getLineDiscountAmount();
                    const globalDiscountAmount = get().getDiscountAmount();
                    const taxAmount = get().getTaxAmount();
                    return Math.max(
                        subtotal - lineDiscountAmount - globalDiscountAmount + taxAmount,
                        0
                    );
                }
            }),
            {
                name: 'pos-cart-storage',
                storage: createJSONStorage(() => localStorage),
                // Only persist relevant state
                partialize: (state) => ({
                    cart: state.cart,
                    clientId: state.clientId,
                    selectedTemplate: state.selectedTemplate,
                    viewMode: state.viewMode,
                    paymentMethod: state.paymentMethod,
                    filters: state.filters,
                    favorites: state.favorites,
                    customer: state.customer
                }),
                // Validate clientId on rehydration
                onRehydrateStorage: () => (state) => {
                    if (!state) return;

                    // This callback will run after hydration
                    // We need to validate clientId matches current session
                    // Note: This validation should be complemented with a check
                    // in the component that uses the store

                    // For now, we can add a flag to indicate hydration happened
                    (state as any)._hydrated = true;
                }
            }
        ),
        {
            limit: HISTORY.POS_UNDO_LIMIT, // Limit undo history
        }
    )
);

