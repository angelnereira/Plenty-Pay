'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInvoiceGenerator } from '@/components/dashboard/invoice-generator-provider';

export default function NotaCreditoPage() {
    const router = useRouter();
    const { openGenerator } = useInvoiceGenerator();

    useEffect(() => {
        openGenerator({ documentMode: 'NOTA_CREDITO' });
        router.replace('/dashboard/facturas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
