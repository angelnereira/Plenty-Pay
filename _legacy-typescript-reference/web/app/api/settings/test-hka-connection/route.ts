import { NextResponse } from 'next/server';
import { auth } from '@core/auth';

/**
 * POST /api/settings/test-hka-connection
 *
 * Backend Cleaned: HKA connection testing removed.
 * This endpoint is now a stub pending re-implementation.
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log('[Backend-Clean] Test HKA Connection (PENDING IMPLEMENTATION)');

    return NextResponse.json({
      success: false,
      error: 'Prueba de conexión HKA pendiente de implementación',
      message: 'La lógica de comunicación con HKA ha sido removida y está pendiente de re-implementación.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Error en test-hka-connection:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al probar conexión',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
