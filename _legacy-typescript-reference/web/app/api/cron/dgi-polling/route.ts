import { NextRequest, NextResponse } from "next/server";
import { prismaServer as prisma } from "@core/database";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOCK_KEY = 'lock:cron:dgi-polling';
const LOCK_TTL = 300; // 5 minutos — tiempo máximo de proceso

export async function GET(req: NextRequest) {
  // ── Verificar autorización del CRON ──────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // ── Bloqueo distribuido (evita ejecuciones paralelas) ────────────────────
  // SET NX EX: solo se escribe si la clave NO existe (atómico)
  const lockAcquired = await redis.set(LOCK_KEY, '1', { nx: true, ex: LOCK_TTL });

  if (!lockAcquired) {
    console.log('[CRON_DGI_POLLING] Ya hay una ejecución activa. Saltando.');
    return NextResponse.json(
      { success: false, reason: 'locked', message: 'Another run is already in progress.' },
      { status: 409 }
    );
  }

  console.log('[CRON_DGI_POLLING] Lock adquirido. Iniciando procesamiento...');

  try {
    const pendingInvoices = await prisma.invoice.findMany({
      where: { status: 'PENDING_DGI' },
      take: 10,
    });

    if (pendingInvoices.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending invoices to process.' });
    }

    // Aquí iría la lógica de comunicarse con el InvoiceOrchestrator o HKA para verificar Status.
    // NOTA: Implementación abstraída para este Cron. Se delega al HKA wrapper.

    console.log(`[CRON_DGI_POLLING] Procesadas ${pendingInvoices.length} facturas.`);
    return NextResponse.json({ success: true, processed: pendingInvoices.length });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error("[CRON_DGI_POLLING] Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });

  } finally {
    // ── Liberar el lock SIEMPRE al finalizar (éxito o error) ─────────────
    await redis.del(LOCK_KEY);
    console.log('[CRON_DGI_POLLING] Lock liberado.');
  }
}

