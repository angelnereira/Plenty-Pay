import { auth } from '@core/auth';
import { redirect } from 'next/navigation';
import { DatosClient } from './datos-client';

export const dynamic = 'force-dynamic';

export default async function DatosPage() {
    const session = await auth();
    if (!session) redirect('/');

    if (!session.user?.clientId) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sin Organización</h2>
                    <p className="text-gray-600 dark:text-gray-400">Tu usuario no tiene una organización asignada</p>
                </div>
            </div>
        );
    }

    return <DatosClient />;
}
