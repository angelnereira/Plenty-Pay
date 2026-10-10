import { NextRequest, NextResponse } from 'next/server';
import { validateRUC } from '@/features/hka/model';
import { auth } from '@core/auth';

/**
 * GET /api/hka/consultar-ruc
 * Consulta información de un RUC en la DGI via HKA
 * Query params: ruc, tipo (1=Natural, 2=Jurídico)
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

        // Get query params
        const searchParams = request.nextUrl.searchParams;
        const ruc = searchParams.get('ruc');
        const tipo = searchParams.get('tipo') as '1' | '2';

        if (!ruc || !tipo) {
            return NextResponse.json(
                { success: false, error: 'Parámetros ruc y tipo son requeridos' },
                { status: 400 }
            );
        }

        // Consultar RUC (la función obtiene la config internamente)
        const result = await validateRUC(session.user.clientId, { ruc, tipoRuc: tipo });

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('Error in consultar-ruc API:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
