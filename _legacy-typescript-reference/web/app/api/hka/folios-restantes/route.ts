import { NextRequest, NextResponse } from 'next/server';
import { checkFoliosDisponibles } from '@/features/hka/model';
import { auth } from '@core/auth';

/**
 * GET /api/hka/folios-restantes
 * Consulta folios disponibles en la licencia HKA
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.clientId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Consultar folios (la función obtiene la config internamente)
        const result = await checkFoliosDisponibles(session.user.clientId);

        return NextResponse.json({
            success: true,
            data: result,
        }, {
            headers: {
                // Cache en CDN por 60s, revalidación en background por 5 mins
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        });

    } catch (error) {
        console.error('Error in folios-restantes API:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
