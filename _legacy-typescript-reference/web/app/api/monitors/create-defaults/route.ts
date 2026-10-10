/**
 * API: Crear Monitores por Defecto
 * POST /api/monitors/create-defaults
 */

import { NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { createDefaultHKAMonitors } from '@/scripts/create-default-monitors';

export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const result = await createDefaultHKAMonitors();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al crear monitores por defecto' },
      { status: 500 }
    );
  }
}

