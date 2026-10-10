import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database/prisma';
import { Prisma } from '@prisma/client';

/**
 * Compute Euclidean distance between two face descriptors
 */
function euclideanDistance(desc1: number[], desc2: number[]): number {
    return Math.sqrt(
        desc1
            .map((val, i) => val - desc2[i])
            .reduce((sum, diff) => sum + diff * diff, 0)
    );
}

/**
 * POST /api/face/verify
 * Verifies a face descriptor against registered employees
 * 
 * Body: { faceDescriptor: number[], clientId?: string }
 * 
 * Returns the matched employee if found, or matched: false if no match
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { faceDescriptor, clientId } = body;

        // Validate input
        if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
            return NextResponse.json(
                { error: 'Invalid face descriptor format. Expected 128-float array.' },
                { status: 400 }
            );
        }

        // Validate all elements are numbers
        if (!faceDescriptor.every(val => typeof val === 'number' && !isNaN(val))) {
            return NextResponse.json(
                { error: 'Face descriptor must contain only valid numbers' },
                { status: 400 }
            );
        }

        // Build query conditions
        const whereCondition: Prisma.PaydayEmployeeWhereInput = {
            isActive: true,
            faceDescriptor: { not: Prisma.DbNull }
        };

        // Optional: scope to specific client
        if (clientId && typeof clientId === 'string') {
            whereCondition.clientId = clientId;
        }

        // Fetch candidates with registered faces
        const candidates = await prisma.paydayEmployee.findMany({
            where: whereCondition,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                cedula: true,
                faceDescriptor: true,
                clientId: true
            }
        });

        // Matching threshold (lower = stricter)
        const THRESHOLD = 0.55;

        let bestMatch: typeof candidates[0] | null = null;
        let minDistance = THRESHOLD;

        for (const candidate of candidates) {
            if (!candidate.faceDescriptor) continue;

            const storedDescriptor = candidate.faceDescriptor as unknown as number[];
            const distance = euclideanDistance(faceDescriptor, storedDescriptor);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = candidate;
            }
        }

        if (bestMatch) {
            // Calculate confidence (1 = perfect match, 0 = at threshold)
            const confidence = Math.max(0, 1 - (minDistance / THRESHOLD));

            return NextResponse.json({
                success: true,
                matched: true,
                employee: {
                    id: bestMatch.id,
                    firstName: bestMatch.firstName,
                    lastName: bestMatch.lastName,
                    cedula: bestMatch.cedula,
                    clientId: bestMatch.clientId
                },
                confidence: parseFloat(confidence.toFixed(3)),
                distance: parseFloat(minDistance.toFixed(4))
            });
        }

        return NextResponse.json({
            success: true,
            matched: false,
            message: 'No matching face found'
        });

    } catch (error) {
        console.error('[API] Face verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
