import { useEffect, useCallback, useState } from 'react';
import { CartItem, usePosStore } from '../stores/pos.store';

const CHANNEL_NAME = 'plentypay-pos-sync';

export interface PosSyncData {
    cart: CartItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentMethod: string;
    customerName?: string;
    storeName?: string;
}

type SyncMessage = {
    type: 'SYNC_STATE';
    payload: PosSyncData;
} | {
    type: 'PING';
} | {
    type: 'PONG';
};

export function usePosDualScreen(role: 'HOST' | 'CLIENT' = 'HOST') {
    const [connected, setConnected] = useState(false);

    // Store access
    const cart = usePosStore(state => state.cart);
    const getSubtotal = usePosStore(state => state.getSubtotal);
    const getTaxAmount = usePosStore(state => state.getTaxAmount);
    const getDiscountAmount = usePosStore(state => state.getDiscountAmount);
    const getTotal = usePosStore(state => state.getTotal);
    const paymentMethod = usePosStore(state => state.paymentMethod);

    // Local state for CLIENT mode
    const [clientState, setClientState] = useState<PosSyncData | null>(null);

    const openCustomerWindow = useCallback(() => {
        const width = 1024;
        const height = 768;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
            '/pos-customer',
            'CustomerView',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
    }, []);

    // Broadcast Channel Logic
    useEffect(() => {
        const channel = new BroadcastChannel(CHANNEL_NAME);

        if (role === 'HOST') {
            // HOST: Listen for PING from new client windows
            channel.onmessage = (event: MessageEvent<SyncMessage>) => {
                if (event.data.type === 'PING') {
                    setConnected(true);
                    // Send immediate sync
                    channel.postMessage({
                        type: 'SYNC_STATE',
                        payload: {
                            cart,
                            subtotal: getSubtotal(),
                            tax: getTaxAmount(),
                            discount: getDiscountAmount(),
                            total: getTotal(),
                            paymentMethod
                        }
                    });
                }
            };
        } else {
            // CLIENT: Listen for SYNC_STATE
            channel.onmessage = (event: MessageEvent<SyncMessage>) => {
                if (event.data.type === 'SYNC_STATE') {
                    setClientState(event.data.payload);
                    setConnected(true);
                }
            };

            // Send initial PING to request state
            channel.postMessage({ type: 'PING' });
        }

        return () => {
            channel.close();
        };
    }, [role]);

    // HOST: Sync state on changes
    useEffect(() => {
        if (role !== 'HOST') return;

        const channel = new BroadcastChannel(CHANNEL_NAME);

        const payload: PosSyncData = {
            cart,
            subtotal: getSubtotal(),
            tax: getTaxAmount(),
            discount: getDiscountAmount(),
            total: getTotal(),
            paymentMethod
        };

        channel.postMessage({
            type: 'SYNC_STATE',
            payload
        });

        return () => channel.close();
    }, [role, cart, paymentMethod, getSubtotal, getTaxAmount, getDiscountAmount, getTotal]);

    return {
        openCustomerWindow,
        connected,
        clientState
    };
}
