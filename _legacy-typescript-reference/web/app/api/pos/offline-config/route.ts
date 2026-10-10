/**
 * API Route: POS Offline Config
 *
 * Returns CUFE configuration fields for offline use — NO tokens or secrets.
 * Cached by the device in IndexedDB for 24 hours.
 *
 * GET /api/pos/offline-config
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       emisorRuc, emisorDv, tipoContribuyente,
 *       branchCode, puntoFacturacionFiscal, environment,
 *       businessName, businessAddress
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import { prisma } from '@core/database';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { clientId } = session.user as { clientId: string; id: string };

    const [config, client] = await Promise.all([
      getHKAConfig(clientId),
      prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, address: true },
      }),
    ]);

    // Return only fields needed for CUFE generation — never tokens or passwords
    return NextResponse.json({
      success: true,
      data: {
        emisorRuc: config.emisorRuc ?? '',
        emisorDv: config.emisorDv ?? '',
        tipoContribuyente: config.emisorTipoContribuyente ?? '2',
        branchCode: config.branchCode,
        puntoFacturacionFiscal: config.puntoFacturacionFiscal,
        environment: config.environment,
        businessName: client?.name ?? '',
        businessAddress: client?.address ?? '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
