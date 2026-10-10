import { KioskContent } from './kiosk-content';
import { auth } from '@core/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@core/database/prisma';

export default async function PaydayKioskPage() {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/auth/signin?callbackUrl=/payday/kiosk');
    }

    // Get Client ID associated with user
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { client: true }
    });

    if (!user || !user.client) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
                    <p className="text-slate-400">Su usuario no tiene una organización asociada.</p>
                </div>
            </div>
        );
    }

    return (
        <KioskContent clientId={user.client.id} />
    );
}
