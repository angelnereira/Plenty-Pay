"use client";

import { CartItem } from "../stores/pos.store";
import type { PaymentMethod } from '../types/pos-types';

export interface ReceiptData {
    id: string;
    items: CartItem[];
    total: number;
    subtotal: number;
    tax: number;
    discount?: number;
    invoiceNumber: string;
    date: Date;
    cufe?: string;
    authProtocol?: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
    footerMessage?: string;
    businessInfo: {
        name: string;
        ruc: string;
        address: string;
        phone?: string;
    };
    customerInfo?: {
        name: string;
        ruc?: string;
        email?: string;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1: MODERN - Minimal with violet accents, clean lines
// ═══════════════════════════════════════════════════════════════════════════════
export function ModernReceipt({ id, items, total, subtotal, tax, discount, invoiceNumber, date, cufe, authProtocol, paymentMethod, notes, footerMessage, businessInfo, customerInfo }: ReceiptData) {
    return (
        <div id={id} className="hidden print:block bg-white text-black p-4 w-[80mm] font-sans text-[11px]">
            {/* Header with gradient bar simulation */}
            <div className="border-b-4 border-violet-600 pb-3 mb-3">
                <h1 className="text-xl font-black tracking-tight text-center">{businessInfo.name}</h1>
                <div className="text-center text-[9px] text-gray-600 mt-1">
                    RUC: {businessInfo.ruc}<br />
                    {businessInfo.address}
                    {businessInfo.phone && <><br />Tel: {businessInfo.phone}</>}
                </div>
            </div>

            {/* Invoice Info */}
            <div className="bg-gray-100 rounded-md p-2 mb-3 text-[10px]">
                <div className="flex justify-between">
                    <span className="text-gray-500">Factura:</span>
                    <span className="font-bold">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Fecha:</span>
                    <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                </div>
                {authProtocol && (
                    <div className="flex justify-between">
                        <span className="text-gray-500">Protocolo:</span>
                        <span className="font-mono text-[8px]">{authProtocol}</span>
                    </div>
                )}
            </div>

            {/* Customer Info */}
            {customerInfo && (
                <div className="mb-3 px-2 py-1 border-l-2 border-violet-200 text-[9px] text-gray-700">
                    <div className="font-bold uppercase text-[8px] text-gray-400 mb-0.5">Cliente</div>
                    <div>{customerInfo.name}</div>
                    {customerInfo.ruc && <div>RUC: {customerInfo.ruc}</div>}
                    {customerInfo.email && <div>{customerInfo.email}</div>}
                </div>
            )}

            {/* Items */}
            <table className="w-full mb-3">
                <thead>
                    <tr className="border-b border-gray-300 text-[9px] text-gray-500">
                        <th className="text-left py-1">Producto</th>
                        <th className="text-center w-8">Qty</th>
                        <th className="text-right w-16">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                            <td className="py-1.5">
                                <div className="font-medium truncate max-w-[140px]">{item.name}</div>
                                <div className="text-[8px] text-gray-400">${item.price.toFixed(2)} c/u</div>
                            </td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right font-bold">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="border-t-2 border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex justify-between text-green-600">
                        <span>Descuento</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-gray-500">
                    <span>ITBMS (7%)</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-black border-t border-violet-600 pt-2 mt-2">
                    <span>TOTAL</span>
                    <span className="text-violet-700">${total.toFixed(2)}</span>
                </div>
                {paymentMethod && (
                    <div className="flex justify-between text-[9px] text-gray-400 pt-1">
                        <span>Pago:</span>
                        <span>{paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Mixto'}</span>
                    </div>
                )}
            </div>

            {/* Notes */}
            {notes && (
                <div className="mt-3 text-[9px] text-gray-600 italic border-t border-dashed pt-2">
                    <span className="font-semibold">Nota:</span> {notes}
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-dashed text-center text-[9px] text-gray-500">
                {footerMessage || <>¡Gracias por su compra!<br /><span className="text-[8px]">Conserve este comprobante</span></>}
            </div>

            {/* CUFE */}
            {cufe && (
                <div className="mt-3 p-2 bg-gray-100 rounded text-[7px] font-mono text-gray-600 break-all leading-tight">
                    CUFE: {cufe}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2: PROFESSIONAL - Classic business layout, formal
// ═══════════════════════════════════════════════════════════════════════════════
export function ProfessionalReceipt({ id, items, total, subtotal, tax, discount, invoiceNumber, date, cufe, authProtocol, paymentMethod, notes, footerMessage, businessInfo, customerInfo }: ReceiptData) {
    return (
        <div id={id} className="hidden print:block bg-white text-black p-3 w-[80mm] font-serif text-[10px]">
            {/* Header - Classic centered */}
            <div className="text-center border-b-2 border-black pb-2 mb-3">
                <h1 className="text-lg font-bold uppercase tracking-widest">{businessInfo.name}</h1>
                <div className="text-[9px] mt-1 space-y-0.5">
                    <div>R.U.C. {businessInfo.ruc}</div>
                    <div>{businessInfo.address}</div>
                    {businessInfo.phone && <div>Teléfono: {businessInfo.phone}</div>}
                </div>
            </div>

            {/* Document Type */}
            <div className="text-center font-bold uppercase border border-black py-1 mb-3">
                FACTURA DE VENTA
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-1 text-[9px] mb-3">
                <div>
                    <span className="font-bold">No.:</span> {invoiceNumber}
                </div>
                <div className="text-right">
                    <span className="font-bold">Fecha:</span> {date.toLocaleDateString()}
                </div>
                <div className="col-span-2">
                    <span className="font-bold">Hora:</span> {date.toLocaleTimeString()}
                </div>
                {authProtocol && (
                    <div className="col-span-2 text-[8px]">
                        <span className="font-bold">Prot. Autorización:</span> {authProtocol}
                    </div>
                )}
            </div>

            {/* Customer Info */}
            {customerInfo && (
                <div className="mb-3 border-t border-b border-black py-1 text-[9px]">
                    <div className="font-bold uppercase text-[8px] mb-0.5">Datos del Cliente</div>
                    <div>{customerInfo.name}</div>
                    {customerInfo.ruc && <div>R.U.C.: {customerInfo.ruc}</div>}
                    {customerInfo.email && <div>E-mail: {customerInfo.email}</div>}
                </div>
            )}

            {/* Items Table */}
            <table className="w-full border-collapse mb-3">
                <thead>
                    <tr className="border-t border-b border-black text-[8px] uppercase">
                        <th className="text-left py-1">Descripción</th>
                        <th className="text-center w-6">Ctd</th>
                        <th className="text-right w-12">P/U</th>
                        <th className="text-right w-14">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i} className="border-b border-dotted">
                            <td className="py-1 text-[9px]">{item.name}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right">${item.price.toFixed(2)}</td>
                            <td className="text-right font-bold">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-black pt-2">
                <div className="flex justify-between mb-1">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex justify-between mb-1 text-green-600">
                        <span>Descuento:</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between mb-1">
                    <span>I.T.B.M.S. (7%):</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-double border-black pt-1 mt-1">
                    <span>TOTAL A PAGAR:</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                {paymentMethod && (
                    <div className="flex justify-between text-[8px] text-gray-600 mt-1">
                        <span>Forma de Pago:</span>
                        <span>{paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Mixto'}</span>
                    </div>
                )}
            </div>

            {/* Notes */}
            {notes && (
                <div className="mt-2 text-[8px] text-gray-600 border-t pt-1">
                    <span className="font-bold uppercase">Observaciones:</span> {notes}
                </div>
            )}

            {/* Legal Footer */}
            <div className="mt-4 text-center text-[8px] border-t border-black pt-2">
                <div className="font-bold mb-1">ORIGINAL - CLIENTE</div>
                {footerMessage || "Gracias por su preferencia"}
            </div>

            {/* CUFE */}
            {cufe && (
                <div className="mt-2 text-[6px] font-mono text-center break-all leading-tight border-t pt-1">
                    Código Único: {cufe}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3: CREATIVE - Bold, colorful, modern retail style
// ═══════════════════════════════════════════════════════════════════════════════
export function CreativeReceipt({ id, items, total, subtotal, tax, discount, invoiceNumber, date, cufe, authProtocol, paymentMethod, notes, footerMessage, businessInfo, customerInfo }: ReceiptData) {
    return (
        <div id={id} className="hidden print:block bg-white text-black p-4 w-[80mm] font-sans text-[11px]">
            {/* Wavy Header */}
            <div className="relative mb-4">
                <div className="absolute -top-4 -left-4 -right-4 h-12 bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 opacity-90 rounded-b-[50%]"></div>
                <div className="relative pt-6 text-center">
                    <h1 className="text-2xl font-black text-white drop-shadow-md uppercase tracking-wider">
                        {businessInfo.name}
                    </h1>
                </div>
            </div>

            {/* Business Info Pill */}
            <div className="bg-gray-900 text-white rounded-full py-2 px-4 text-center text-[9px] mb-4 shadow-lg">
                <span className="font-bold">RUC:</span> {businessInfo.ruc} | {businessInfo.address}
            </div>

            {/* Receipt Number Badge */}
            <div className="flex justify-center mb-3">
                <div className="bg-gradient-to-r from-violet-500 to-pink-500 text-white px-4 py-2 rounded-lg shadow-md">
                    <div className="text-[8px] uppercase tracking-widest opacity-80">Factura</div>
                    <div className="text-lg font-black">{invoiceNumber}</div>
                </div>
            </div>

            {/* Date/Time */}
            <div className="flex justify-between text-[9px] text-gray-500 mb-3 px-2">
                <span>📅 {date.toLocaleDateString()}</span>
                <span>🕐 {date.toLocaleTimeString()}</span>
            </div>

            {/* Customer Info Badge */}
            {customerInfo && (
                <div className="mx-2 mb-4 bg-violet-50 rounded-xl p-3 border border-violet-100">
                    <div className="text-[8px] uppercase tracking-widest text-violet-400 font-bold mb-1">Entregado a:</div>
                    <div className="font-bold text-violet-800">{customerInfo.name}</div>
                    {customerInfo.ruc && <div className="text-[9px] text-violet-600">ID: {customerInfo.ruc}</div>}
                </div>
            )}

            {/* Items as Cards */}
            <div className="space-y-2 mb-4">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border-l-4 border-violet-500">
                        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-sm">
                            {item.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{item.name}</div>
                            <div className="text-[9px] text-gray-400">${item.price.toFixed(2)} cada uno</div>
                        </div>
                        <div className="font-black text-violet-600">${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                ))}
            </div>

            {/* Totals Box */}
            <div className="bg-gray-900 text-white rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-gray-400 text-[10px]">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex justify-between text-green-400 text-[10px]">
                        <span>💰 Descuento</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-gray-400 text-[10px]">
                    <span>ITBMS 7%</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-black pt-2 border-t border-gray-700">
                    <span>TOTAL</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">
                        ${total.toFixed(2)}
                    </span>
                </div>
                {paymentMethod && (
                    <div className="flex justify-between text-gray-400 text-[9px] pt-1 border-t border-gray-800">
                        <span>Pagado con:</span>
                        <span>{paymentMethod === 'CASH' ? '💵 Efectivo' : paymentMethod === 'CARD' ? '💳 Tarjeta' : paymentMethod === 'TRANSFER' ? '📱 Transferencia' : '🔀 Mixto'}</span>
                    </div>
                )}
            </div>

            {/* Notes */}
            {notes && (
                <div className="mt-3 text-[9px] text-gray-600 bg-yellow-50 p-2 rounded-lg border-l-4 border-yellow-400">
                    <span className="font-bold">📝 Nota:</span> {notes}
                </div>
            )}

            {/* Fun Footer */}
            <div className="mt-4 text-center">
                <div className="text-2xl">🎉</div>
                <div className="font-bold text-gray-700"> {footerMessage || "¡Gracias por elegirnos!"}</div>
                <div className="text-[9px] text-gray-400">Vuelve pronto</div>
            </div>

            {/* CUFE - Compact */}
            {cufe && (
                <div className="mt-3 text-[6px] font-mono text-gray-400 text-center break-all px-2">
                    {cufe}
                </div>
            )}

            {authProtocol && (
                <div className="mt-1 text-[7px] text-center text-gray-400">
                    Protocolo: {authProtocol}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4: THERMAL - High contrast, simple implementation for old printers
// ═══════════════════════════════════════════════════════════════════════════════
export function ThermalReceipt({ id, items, total, subtotal, tax, discount, invoiceNumber, date, cufe, authProtocol, paymentMethod, notes, footerMessage, businessInfo, customerInfo }: ReceiptData) {
    return (
        <div id={id} className="hidden print:block bg-white text-black p-2 w-[80mm] font-mono text-[10px] leading-tight filter grayscale contrast-125">
            <div className="text-center font-bold text-sm mb-2 uppercase">
                {businessInfo.name}
            </div>
            <div className="text-center text-[9px] mb-2 border-b border-black pb-2">
                RUC: {businessInfo.ruc}<br />
                {businessInfo.address}<br />
                {businessInfo.phone && <>Tel: {businessInfo.phone}</>}
            </div>

            <div className="mb-2">
                FECHA: {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </div>

            {/* Customer Info */}
            {customerInfo && (
                <div className="mb-2 border-b border-black pb-2">
                    CLIENTE: {customerInfo.name.toUpperCase()}<br />
                    {customerInfo.ruc && <>RUC/ID: {customerInfo.ruc}<br /></>}
                </div>
            )}

            <table className="w-full mb-2 border-collapse">
                <thead>
                    <tr className="border-b border-black text-[9px]">
                        <th className="text-left w-2/3">DESC</th>
                        <th className="text-center">CNT</th>
                        <th className="text-right">TOT</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td className="py-1 pr-1 truncate max-w-[40mm]">
                                {item.name}<br />
                                <span className="text-[8px]">${item.price.toFixed(2)}</span>
                            </td>
                            <td className="text-center align-top py-1">{item.quantity}</td>
                            <td className="text-right align-top py-1 font-bold">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t border-black pt-1 space-y-1 font-bold text-[10px]">
                <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex justify-between">
                        <span>DESC:</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>ITBMS:</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-black border-dashed pt-1 mt-1">
                    <span>TOTAL:</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                {paymentMethod && (
                    <div className="flex justify-between text-[9px] font-normal pt-1">
                        <span>PAGO:</span>
                        <span>{paymentMethod === 'CASH' ? 'EFECTIVO' : paymentMethod === 'CARD' ? 'TARJETA' : 'OTRO'}</span>
                    </div>
                )}
            </div>

            {/* CUFE */}
            {cufe && (
                <div className="mt-3 text-[8px] break-all border-t border-black pt-1">
                    CUFE:<br />{cufe}
                </div>
            )}

            <div className="mt-4 text-center text-[9px] font-bold">
                *** {footerMessage || "GRACIAS POR SU COMPRA"} ***
            </div>
        </div>
    );
}

// Template Map for easy selection
export const RECEIPT_TEMPLATES = {
    modern: ModernReceipt,
    professional: ProfessionalReceipt,
    creative: CreativeReceipt,
    thermal: ThermalReceipt,
} as const;

export type ReceiptTemplateType = keyof typeof RECEIPT_TEMPLATES;
