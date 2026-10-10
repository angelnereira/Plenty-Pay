"use client";

import { CartItem } from "../stores/pos.store";

interface ReceiptTemplateProps {
    id: string;
    items: CartItem[];
    total: number;
    subtotal: number;
    tax: number;
    invoiceNumber: string;
    date: Date;
    cufe?: string;
    authProtocol?: string;
}

export function ReceiptTemplate({ id, items, total, subtotal, tax, invoiceNumber, date, cufe, authProtocol }: ReceiptTemplateProps) {
    return (
        <div id={id} className="hidden">
            <div className="text-center font-bold text-lg mb-2">PLENTYPAY</div>
            <div className="text-center mb-2">
                RUC: 1234567-1-1234<br />
                Panamá, Ciudad de Panamá<br />
                Tel: 222-2222
            </div>

            <div className="border-t"></div>

            <div className="my-2">
                Fecha: {date.toLocaleDateString()} {date.toLocaleTimeString()}<br />
                Factura: {invoiceNumber}<br />
                {authProtocol && <>Prot. Aut.: {authProtocol}<br /></>}
                Caja: 001
            </div>

            <div className="border-t"></div>

            <table>
                <thead>
                    <tr>
                        <th className="qty">Cant</th>
                        <th>Desc</th>
                        <th className="price">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td className="qty">{item.quantity}</td>
                            <td>{item.name}</td>
                            <td className="price">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t"></div>

            <div className="flex font-bold">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex">
                <span>ITBMS (7%):</span>
                <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex font-bold text-lg my-2">
                <span>TOTAL:</span>
                <span>${total.toFixed(2)}</span>
            </div>

            <div className="text-center border-t pt-2 mt-4">
                ¡Gracias por su compra!<br />
                Original: Cliente<br />
                {cufe && (
                    <div className="mt-2 text-[8px] break-all font-mono leading-tight">
                        CUFE: {cufe}
                    </div>
                )}
            </div>
        </div>
    );
}
