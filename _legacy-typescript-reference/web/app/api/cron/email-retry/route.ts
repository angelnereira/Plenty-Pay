import { NextRequest, NextResponse } from "next/server";
import { prismaServer as prisma } from "@core/database";
import { sendInvoiceEmail } from "@/features/hka/model/methods/email";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max allowed by Vercel free tier or pro

export async function GET(req: NextRequest) {
  try {
    // Protección rudimentaria de Cron con Secure Token de Vercel
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Buscar entregas de email fallidas (simulación de email-retry.worker)
    const failedDeliveries = await prisma.emailDelivery.findMany({
      where: {
        status: 'FAILED'
      },
      take: 10, // Limitar para no agotar el timeout de Vercel
      include: {
        invoice: {
          select: { invoiceNumber: true, clientId: true }
        }
      }
    });

    if (failedDeliveries.length === 0) {
      return NextResponse.json({ success: true, message: 'No failed deliveries to retry.' });
    }

    let successCount = 0;
    
    for (const delivery of failedDeliveries) {
       if (!delivery.invoice?.invoiceNumber) continue;

       const res = await sendInvoiceEmail(delivery.invoice.clientId, {
           numeroDocumentoFiscal: delivery.invoice.invoiceNumber,
           correo: delivery.recipientEmail
       });

       if (res.success) {
           await prisma.emailDelivery.update({
               where: { id: delivery.id },
               data: { status: 'SENT', sentAt: new Date() }
           });
           successCount++;
       }
    }

    return NextResponse.json({ success: true, retried: successCount });
  } catch (error: any) {
    console.error("[CRON_EMAIL_RETRY]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
