import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { auth } from '@core/auth';

/**
 * GET /api/invoices/[id]/progress
 * Returns the processing progress of an invoice through the 8-phase system
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: invoiceId } = await params;

    // Fetch invoice with phase tracking data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        currentPhase: true,
        phaseHistory: true,
        phaseErrors: true,
        lastPhaseAttempt: true,
        cufe: true,
        cafe: true,
        hkaProtocol: true,
        invoiceNumber: true,
        clientId: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check organization access
    if (invoice.clientId !== session.user.clientId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Calculate progress
    const currentPhase = invoice.currentPhase ?? 0;
    const totalPhases = 9; // Phases 0-8
    const progress = Math.round((currentPhase / (totalPhases - 1)) * 100);

    // Parse phase history
    const phaseHistory = (invoice.phaseHistory as any[]) || [];
    const phaseErrors = (invoice.phaseErrors as any) || {};

    // Build phase statuses
    const phases = [
      {
        phase: 0,
        name: 'Initialization',
        isCritical: true,
        status: calculatePhaseStatus(0, currentPhase, phaseHistory),
        error: phaseErrors.phase0,
      },
      {
        phase: 1,
        name: 'ConsultarRucDV',
        isCritical: false,
        status: calculatePhaseStatus(1, currentPhase, phaseHistory),
        error: phaseErrors.phase1,
      },
      {
        phase: 2,
        name: 'Enviar',
        isCritical: true,
        status: calculatePhaseStatus(2, currentPhase, phaseHistory),
        error: phaseErrors.phase2,
      },
      {
        phase: 3,
        name: 'EstadoDocumento',
        isCritical: true,
        status: calculatePhaseStatus(3, currentPhase, phaseHistory),
        error: phaseErrors.phase3,
      },
      {
        phase: 4,
        name: 'DescargaXML',
        isCritical: true,
        status: calculatePhaseStatus(4, currentPhase, phaseHistory),
        error: phaseErrors.phase4,
      },
      {
        phase: 5,
        name: 'DescargaPDF',
        isCritical: true,
        status: calculatePhaseStatus(5, currentPhase, phaseHistory),
        error: phaseErrors.phase5,
      },
      {
        phase: 6,
        name: 'EnvioCorreo',
        isCritical: false,
        status: calculatePhaseStatus(6, currentPhase, phaseHistory),
        error: phaseErrors.phase6,
      },
      {
        phase: 7,
        name: 'RastreoCorreo',
        isCritical: false,
        status: calculatePhaseStatus(7, currentPhase, phaseHistory),
        error: phaseErrors.phase7,
      },
      {
        phase: 8,
        name: 'FoliosRestantes',
        isCritical: false,
        status: calculatePhaseStatus(8, currentPhase, phaseHistory),
        error: phaseErrors.phase8,
      },
    ];

    // Determine overall status
    const isComplete = invoice.status === 'CERTIFIED' || invoice.status === 'ERROR';
    const isCertified = invoice.status === 'CERTIFIED';
    const hasError = invoice.status === 'ERROR';

    return NextResponse.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currentPhase,
      progress,
      isComplete,
      isCertified,
      hasError,
      phases,
      cafe: invoice.cafe,
      cufe: invoice.cufe,
      hkaProtocol: invoice.hkaProtocol,
      lastUpdate: invoice.lastPhaseAttempt,
    });
  } catch (error) {
    console.error('Error fetching invoice progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate the status of a specific phase based on history
 */
function calculatePhaseStatus(
  phase: number,
  currentPhase: number,
  phaseHistory: any[]
): 'pending' | 'running' | 'completed' | 'warning' | 'failed' {
  // Find all history entries for this phase
  const phaseEntries = phaseHistory.filter((entry) => entry.phase === phase);

  if (phaseEntries.length === 0) {
    // No history for this phase
    if (phase < currentPhase) {
      // Phase should have been completed but no record
      return 'pending';
    } else if (phase === currentPhase) {
      return 'running';
    } else {
      return 'pending';
    }
  }

  // Get the latest entry for this phase
  const latestEntry = phaseEntries[phaseEntries.length - 1];

  if (latestEntry.status === 'COMPLETED') {
    return 'completed';
  } else if (latestEntry.status === 'WARNING') {
    return 'warning';
  } else if (latestEntry.status === 'FAILED') {
    return 'failed';
  } else if (latestEntry.status === 'RUNNING') {
    return 'running';
  }

  return 'pending';
}
