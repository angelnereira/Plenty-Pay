import { NextRequest, NextResponse } from 'next/server';
import { cartReservationService } from '@/features/pos/services/cart-reservation.service';
import { withSentryCron } from '@/lib/sentry/cron-wrapper';

/**
 * POST /api/cron/cleanup-reservations
 * Cron job to clean up expired cart reservations.
 * Should run every 5 minutes.
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-reservations",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 */
const handler = async (request: NextRequest) => {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const deletedCount = await cartReservationService.cleanupExpiredReservations();

        console.log(`[Cron] Cleaned up ${deletedCount} expired cart reservations`);

        return NextResponse.json({
            success: true,
            deletedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[Cron] Error cleaning up reservations:', error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
};

export const POST = withSentryCron(
    'cleanup-reservations',
    { schedule: '*/5 * * * *', maxRuntimeSeconds: 60 },
    handler,
);

// For Vercel cron compatibility
export async function GET(request: NextRequest) {
    return POST(request);
}
