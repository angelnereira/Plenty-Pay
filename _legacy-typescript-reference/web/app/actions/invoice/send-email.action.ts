/**
 * Server Action: Send Email
 * Envía una factura por correo electrónico usando HKA
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { sendInvoiceEmail, type EnviarCorreoResult } from '@/features/hka/model';

/**
 * Input para envío de correo
 */
export interface SendEmailInput {
  invoiceId: string;
  /** Correo del destinatario (opcional, usa el del cliente si no se proporciona) */
  email?: string;
}

/**
 * Output de envío
 */
export interface SendEmailOutput {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Envía una factura por correo electrónico usando el servicio de HKA
 * HKA envía el correo, no el servidor de PlentyPay
 * 
 * @param input - ID de la factura y correo opcional
 * @returns Resultado del envío
 */
export async function sendInvoiceEmailAction(input: SendEmailInput): Promise<SendEmailOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Obtener factura
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        clientId: clientId,
      },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    // Verificar que la factura esté emitida
    if (!['EMITTED', 'CERTIFIED'].includes(invoice.status)) {
      return { 
        success: false, 
        error: 'Solo se pueden enviar por correo facturas emitidas' 
      };
    }

    if (!invoice.invoiceNumber) {
      return { success: false, error: 'La factura no tiene número asignado' };
    }

    // Determinar correo destinatario
    const email = input.email || invoice.receiverEmail || invoice.customer?.email;
    if (!email) {
      return { 
        success: false, 
        error: 'No hay correo electrónico para enviar la factura' 
      };
    }

    // Enviar a través de HKA
    const result = await sendInvoiceEmail(clientId, {
      numeroDocumentoFiscal: invoice.invoiceNumber,
      correo: email,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Error al enviar correo',
      };
    }

    // Registrar el envío en la base de datos
    await prisma.emailDelivery.create({
      data: {
        invoiceId: input.invoiceId,
        recipientEmail: email,
        status: 'SENT',
        sentAt: new Date(),
        includePDF: true,
        includeXML: true,
      },
    });

    // Log del envío
    await prisma.invoiceLog.create({
      data: {
        invoiceId: input.invoiceId,
        action: 'EMAIL_SENT',
        message: `Correo enviado a ${email}`,
        metadata: { email },
        userId: session.user.id,
        userEmail: session.user.email,
      },
    });

    revalidatePath(`/dashboard/facturas/${input.invoiceId}`);

    return {
      success: true,
      message: result.message || `Correo enviado exitosamente a ${email}`,
    };
  } catch (error) {
    console.error('Error en sendInvoiceEmailAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Envía una factura a múltiples correos
 */
export async function sendInvoiceToMultipleEmailsAction(
  invoiceId: string,
  emails: string[]
): Promise<{ email: string; result: SendEmailOutput }[]> {
  const results: { email: string; result: SendEmailOutput }[] = [];

  for (const email of emails) {
    const result = await sendInvoiceEmailAction({ invoiceId, email });
    results.push({ email, result });
    
    // Pausa entre envíos
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
}

/**
 * Reenvía una factura al correo del cliente
 */
export async function resendInvoiceEmail(invoiceId: string): Promise<SendEmailOutput> {
  return sendInvoiceEmailAction({ invoiceId });
}

