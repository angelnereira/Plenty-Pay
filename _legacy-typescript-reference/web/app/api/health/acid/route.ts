import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/health/acid
 * Health check endpoint for ACID-related metrics.
 * 
 * Returns:
 * - Pending cart reservations
 * - Expired reservations (should be 0 if cron is running)
 * - Recent concurrency conflicts from stock movements
 * - Database connectivity status
 */
export async function GET(request: NextRequest) {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Run queries in parallel
        const [
            activeReservations,
            expiredReservations,
            recentMovements,
            offlinePending,
            dbCheck
        ] = await Promise.all([
            // Active cart reservations
            prisma.cartReservation.count({
                where: { expiresAt: { gt: now } }
            }),

            // Expired but not cleaned up (indicates cron issue)
            prisma.cartReservation.count({
                where: { expiresAt: { lt: now } }
            }),

            // Recent stock movements in last hour
            prisma.stockMovement.count({
                where: { createdAt: { gt: oneHourAgo } }
            }),

            // Offline transactions pending sync
            prisma.pOSOfflineTransaction.count({
                where: { syncedAt: null }
            }),

            // Simple DB check
            prisma.$queryRaw`SELECT 1 as ok`
        ]);

        // Calculate health status
        const issues: string[] = [];

        if (expiredReservations > 0) {
            issues.push(`${expiredReservations} expired reservations not cleaned up (cron issue)`);
        }

        if (offlinePending > 10) {
            issues.push(`${offlinePending} offline transactions pending sync`);
        }

        const status = issues.length === 0 ? 'healthy' : 'degraded';

        return NextResponse.json({
            status,
            timestamp: new Date().toISOString(),
            metrics: {
                cartReservations: {
                    active: activeReservations,
                    expired: expiredReservations,
                },
                stockMovements: {
                    lastHour: recentMovements,
                },
                offlineSync: {
                    pending: offlinePending,
                },
                database: {
                    connected: true,
                },
            },
            issues: issues.length > 0 ? issues : undefined,
        });

    } catch (error: any) {
        console.error('[Health/ACID] Error:', error);

        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message || 'Database connection error',
            metrics: {
                database: { connected: false }
            }
        }, { status: 503 });
    }
}
