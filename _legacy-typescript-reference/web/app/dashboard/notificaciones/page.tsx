import { Suspense } from 'react';
import { auth } from '@core/auth';
import { redirect } from 'next/navigation';
import { NotificacionesPageClient } from './notificaciones-page-client';

export const metadata = {
    title: 'Notificaciones | PlentyPay',
    description: 'Centro de notificaciones',
};

export default async function NotificacionesPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/');
    }

    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
            <NotificacionesPageClient userName={session.user.name || 'Usuario'} />
        </Suspense>
    );
}
