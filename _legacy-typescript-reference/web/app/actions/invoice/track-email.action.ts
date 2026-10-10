/**
 * Server Action: Track Email
 * Rastrea el estado de los correos enviados para una factura
 */

'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { 
  trackEmailDelivery, 
  type RastreoCorreoResult,
  type EmailTrackingItem,
} from '@/features/hka/model';

/**
 * Output de rastreo
 */
export interface TrackEmailOutput {
  success: boolean;
  data?: {
    envios: EmailTrackingItem[];
    totalEnviados: number;
    totalEntregados: number;
    totalRebotados: number;
  };
  error?: string;
}

/**
 * Rastrea el estado de los correos enviados para una factura
 * Utiliza el CUFE como identificador (método RastreoCorreo de HKA)
 * 
 * @param invoiceId - ID de la factura
 * @returns Lista de correos enviados con su estado
 */
export async function trackInvoiceEmailAction(invoiceId: string): Promise<TrackEmailOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Obtener factura con CUFE
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
      },
      select: {
        id: true,
        cufe: true,
        status: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    if (!invoice.cufe) {
      return { 
        success: false, 
        error: 'La factura no tiene CUFE asignado. Debe estar emitida para rastrear correos.' 
      };
    }

    // Rastrear en HKA
    const result = await trackEmailDelivery(clientId, invoice.cufe);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Error al rastrear correos en HKA',
      };
    }

    const envios = result.envios || [];

    // Calcular estadísticas
    const totalEnviados = envios.length;
    const totalEntregados = envios.filter(
      e => e.estadoNormalizado === 'DELIVERED' || e.estadoNormalizado === 'OPENED'
    ).length;
    const totalRebotados = envios.filter(
      e => e.estadoNormalizado === 'BOUNCED' || e.estadoNormalizado === 'FAILED'
    ).length;

    // Actualizar EmailDelivery en la base de datos con los estados más recientes
    for (const envio of envios) {
      await prisma.emailDelivery.updateMany({
        where: {
          invoiceId,
          recipientEmail: envio.correo,
        },
        data: {
          status: mapTrackingStatusToEmailStatus(envio.estadoNormalizado),
          deliveredAt: envio.estadoNormalizado === 'DELIVERED' 
            ? new Date(envio.fechaEnvio) 
            : undefined,
          hkaTrackingId: envio.messageId,
        },
      });
    }

    return {
      success: true,
      data: {
        envios,
        totalEnviados,
        totalEntregados,
        totalRebotados,
      },
    };
  } catch (error) {
    console.error('Error en trackInvoiceEmailAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Mapea el estado de tracking HKA al enum EmailStatus de Prisma
 */
function mapTrackingStatusToEmailStatus(
  status: EmailTrackingItem['estadoNormalizado']
): 'PENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' {
  switch (status) {
    case 'SENT':
      return 'SENT';
    case 'DELIVERED':
    case 'OPENED':
      return 'DELIVERED';
    case 'BOUNCED':
      return 'BOUNCED';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/**
 * Obtiene el historial de envíos de correo desde la base de datos local
 */
export async function getEmailHistoryAction(invoiceId: string): Promise<{
  success: boolean;
  data?: {
    recipientEmail: string;
    status: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
  }[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const deliveries = await prisma.emailDelivery.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      select: {
        recipientEmail: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
      },
    });

    return {
      success: true,
      data: deliveries,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno',
    };
  }
}

