/**
 * API Route: HKA Consultar RUC DV
 * 
 * Valida un RUC y obtiene su digito verificador y razon social
 * POST /api/hka/consultar-ruc-dv
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { validateRUC, detectRUCType } from '@/features/hka/model';

export async function POST(request: NextRequest) {
  try {
    // Autenticacion
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { clientId } = session.user;

    // Obtener body
    const body = await request.json();
    const { ruc, tipoRuc } = body;

    if (!ruc || !ruc.trim()) {
      return NextResponse.json(
        { success: false, error: 'El RUC es requerido' },
        { status: 400 }
      );
    }

    // Detectar tipo de RUC si no se proporciona
    const tipo = tipoRuc || detectRUCType(ruc.trim());

    // Llamar al servicio HKA
    const result = await validateRUC(clientId, {
      tipoRuc: tipo as '1' | '2',
      ruc: ruc.trim(),
    });

    if (!result.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Error al validar RUC',
          code: result.code 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ruc: result.ruc,
        dv: result.dv,
        razonSocial: result.razonSocial,
        tipoRuc: result.tipoRuc,
        afiliadoFE: result.afiliadoFE,
      },
    });
  } catch (error) {
    console.error('[API] Error en consultar-ruc-dv:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

