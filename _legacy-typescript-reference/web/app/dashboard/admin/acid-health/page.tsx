import { Metadata } from 'next';
import { auth } from '@core/auth';
import { redirect } from 'next/navigation';
import { AcidDashboardClient } from './AcidDashboardClient';

export const metadata: Metadata = {
    title: 'ACID Health Monitor | PlentyPay',
    description: 'Monitor de métricas de transacciones ACID',
};

export default async function AcidHealthPage() {
    const session = await auth();

    // Only SUPER_ADMIN can access this page
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
        redirect('/dashboard');
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                    ACID Health Monitor
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Monitor de transacciones atómicas, reservaciones y sincronización
                </p>
            </div>

            <AcidDashboardClient />
        </div>
    );
}
