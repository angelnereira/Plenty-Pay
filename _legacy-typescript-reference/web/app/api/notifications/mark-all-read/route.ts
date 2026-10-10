/**
 * API Route: Mark All Notifications as Read
 * PATCH /api/notifications/mark-all-read
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Mark all unread notifications as read for this user
        const result = await prisma.notification.updateMany({
            where: {
                userId: session.user.id,
                read: false,
            },
            data: {
                read: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: `${result.count} notificaciones marcadas como leídas`,
            count: result.count,
        });
    } catch (error) {
        console.error('[API] Error marking all notifications as read:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error interno del servidor',
            },
            { status: 500 }
        );
    }
}
