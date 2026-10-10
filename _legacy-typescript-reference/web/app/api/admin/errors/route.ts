/**
 * Admin Error Logs API
 * 
 * GET /api/admin/errors - Query error logs with filters
 * POST /api/admin/errors/:id/resolve - Mark error as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, requireAuth, requireRole, ValidationError } from '@core/middleware/error-handler';
import { prisma } from '@core/database';
import { logger } from '@/lib/services/logger.service';

/**
 * GET /api/admin/errors
 * Query error logs with pagination and filters
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 100)
 * - errorType: string (filter by error type)
 * - errorCode: string (filter by error code)
 * - userId: string (filter by user)
 * - clientId: string (filter by client/org)
 * - endpoint: string (filter by API endpoint)
 * - resolved: boolean (filter by resolution status)
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    // Require SUPER_ADMIN role
    await requireRole('SUPER_ADMIN');

    const { searchParams } = request.nextUrl;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Filters
    const filters: any = {};

    const errorType = searchParams.get('errorType');
    if (errorType) {
        filters.errorType = errorType;
    }

    const errorCode = searchParams.get('errorCode');
    if (errorCode) {
        filters.errorCode = errorCode;
    }

    const userId = searchParams.get('userId');
    if (userId) {
        filters.userId = userId;
    }

    const clientId = searchParams.get('clientId');
    if (clientId) {
        filters.clientId = clientId;
    }

    const endpoint = searchParams.get('endpoint');
    if (endpoint) {
        filters.endpoint = { contains: endpoint };
    }

    const resolved = searchParams.get('resolved');
    if (resolved !== null) {
        filters.resolved = resolved === 'true';
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) {
            filters.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
            filters.createdAt.lte = new Date(endDate);
        }
    }

    logger.info('Querying error logs', {
        page,
        limit,
        filters,
    });

    // Query errors
    const [errors, totalCount] = await Promise.all([
        prisma.errorLog.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        }),
        prisma.errorLog.count({ where: filters }),
    ]);

    // Calculate stats
    const stats = await prisma.errorLog.groupBy({
        by: ['errorType'],
        where: filters,
        _count: true,
    });

    const totalPages = Math.ceil(totalCount / limit);

    logger.info('Error logs retrieved', {
        count: errors.length,
        totalCount,
        page,
        totalPages,
    });

    return NextResponse.json({
        success: true,
        data: errors,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasMore: page < totalPages,
        },
        stats: stats.map((s: any) => ({
            errorType: s.errorType,
            count: s._count,
        })),
    });
});

/**
 * POST /api/admin/errors
 * Create manual error log entry (for testing/debugging)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole('SUPER_ADMIN');

    const body = await request.json();

    if (!body.errorType || !body.errorMessage) {
        throw new ValidationError('errorType and errorMessage are required');
    }

    const errorLog = await prisma.errorLog.create({
        data: {
            errorType: body.errorType,
            errorMessage: body.errorMessage,
            errorCode: body.errorCode,
            errorStack: body.errorStack,
            endpoint: body.endpoint,
            method: body.method,
            path: body.path,
            userId: body.userId,
            clientId: body.clientId,
            environment: process.env.NODE_ENV,
            metadata: body.metadata,
        },
    });

    logger.info('Manual error log created', {
        errorLogId: errorLog.id,
        errorType: errorLog.errorType,
    });

    return NextResponse.json({
        success: true,
        data: errorLog,
    }, { status: 201 });
});

/**
 * PATCH /api/admin/errors/:id/resolve
 * Mark error as resolved
 */
export const PATCH = withErrorHandler(async (request: NextRequest, context: any) => {
    const session = await requireRole('SUPER_ADMIN');

    const { id: errorId } = await context.params;
    if (!errorId) {
        throw new ValidationError('Error ID is required');
    }

    const body = await request.json();

    const errorLog = await prisma.errorLog.update({
        where: { id: errorId },
        data: {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: session.user.id,
            resolvedNote: body.note || null,
        },
    });

    logger.info('Error log marked as resolved', {
        errorLogId: errorId,
        resolvedBy: session.user.id,
    });

    return NextResponse.json({
        success: true,
        data: errorLog,
    });
});
