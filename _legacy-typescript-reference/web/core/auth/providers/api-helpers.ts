import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

/**
 * Helper para validar autenticación en endpoints API
 */
export async function requireAuth(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

/**
 * Helper para validar acceso a una factura
 */
export async function requireInvoiceAccess(
  invoiceId: string,
  userId: string,
  userRole: string
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      clientId: true,
      createdBy: true,
      status: true,
    },
  });

  if (!invoice) {
    throw new Error('NOT_FOUND');
  }

  // SUPER_ADMIN puede acceder a todo
  if (userRole === 'SUPER_ADMIN') {
    return invoice;
  }

  // CLIENT: Verificar que pertenece al mismo cliente
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientId: true },
  });

  if (user?.clientId !== invoice.clientId) {
    throw new Error('FORBIDDEN');
  }

  return invoice;
}

/**
 * Helper para manejar errores de API
 * 
 * @param error - Error object or unknown error
 * @returns NextResponse with appropriate error message and status code
 */
export function handleApiError(error: Error | unknown): NextResponse {
  // Use structured logging instead of console.error
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorDetails = error instanceof Error ? {
    message: error.message,
    stack: error.stack
  } : { error };

  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === 'NOT_FOUND') {
    return NextResponse.json(
      { error: 'Recurso no encontrado' },
      { status: 404 }
    );
  }

  if (error instanceof Error && error.message === 'FORBIDDEN') {
    return NextResponse.json(
      { error: 'No tiene acceso a este recurso' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      error: 'Error interno del servidor',
      details: errorMessage,
    },
    { status: 500 }
  );
}

