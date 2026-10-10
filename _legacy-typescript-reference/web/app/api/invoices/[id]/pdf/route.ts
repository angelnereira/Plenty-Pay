import { NextRequest, NextResponse } from 'next/server';
import { AppAction } from "@shared/lib/workflow-ids";

/**
 * GET /api/invoices/[id]/pdf
 * Hollow Backend Implementation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const action = request.headers.get("X-App-Action");

  // Backend Cleaned: Logic removed.
  console.log(`[Backend-Clean] PDF Download for ${id} (PENDING IMPLEMENTATION)`);

  return NextResponse.json(
    { error: "Descarga de PDF pendiente de implementación." },
    { status: 501 }
  );
}
