/**
 * POS Session Management Service
 * 
 * Controls concurrent POS station access based on client limits.
 * Each client has a maxPosStations limit that determines how many
 * cashiers can operate simultaneously.
 */

import { prisma } from "@/lib/db"

export interface PosSessionCheck {
    allowed: boolean
    reason?: string
    currentSessions: number
    maxSessions: number
}

/**
 * Check if a user can start a new POS session.
 * Uses database to track active sessions.
 */
export async function canStartPosSession(
    clientId: string,
    userId: string
): Promise<PosSessionCheck> {
    // Get client limits
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
            maxPosStations: true,
            posEnabled: true,
            name: true,
        }
    })

    if (!client) {
        return {
            allowed: false,
            reason: "Cliente no encontrado",
            currentSessions: 0,
            maxSessions: 0
        }
    }

    if (!client.posEnabled) {
        return {
            allowed: false,
            reason: "El módulo POS no está habilitado para este cliente",
            currentSessions: 0,
            maxSessions: client.maxPosStations
        }
    }

    // Count active POS sessions for this client (sessions in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const activeSessions = await prisma.posSession.count({
        where: {
            clientId,
            lastActivity: { gte: fiveMinutesAgo },
            status: "ACTIVE"
        }
    })

    // Check if user already has an active session (allow reconnection)
    const existingSession = await prisma.posSession.findFirst({
        where: {
            userId,
            clientId,
            status: "ACTIVE"
        }
    })

    if (existingSession) {
        // User already has a session, allow reconnection
        return {
            allowed: true,
            reason: "Reconexión a sesión existente",
            currentSessions: activeSessions,
            maxSessions: client.maxPosStations
        }
    }

    // Check if we're at capacity
    if (activeSessions >= client.maxPosStations) {
        return {
            allowed: false,
            reason: `Límite de cajas alcanzado (${activeSessions}/${client.maxPosStations}). Cierre una caja para abrir otra.`,
            currentSessions: activeSessions,
            maxSessions: client.maxPosStations
        }
    }

    return {
        allowed: true,
        currentSessions: activeSessions,
        maxSessions: client.maxPosStations
    }
}

/**
 * Start or update a POS session for a user
 */
export async function startPosSession(clientId: string, userId: string, stationName?: string) {
    // Try to find existing session
    const existing = await prisma.posSession.findFirst({
        where: {
            userId,
            clientId,
            status: "ACTIVE"
        }
    })

    if (existing) {
        // Update last activity
        return prisma.posSession.update({
            where: { id: existing.id },
            data: { lastActivity: new Date() }
        })
    }

    // Create new session
    return prisma.posSession.create({
        data: {
            clientId,
            userId,
            stationName: stationName || `Caja-${Date.now()}`,
            status: "ACTIVE",
            startedAt: new Date(),
            lastActivity: new Date()
        }
    })
}

/**
 * End a POS session
 */
export async function endPosSession(sessionId: string) {
    return prisma.posSession.update({
        where: { id: sessionId },
        data: {
            status: "CLOSED",
            endedAt: new Date()
        }
    })
}

/**
 * Update session heartbeat (call periodically to keep session alive)
 */
export async function updateSessionHeartbeat(sessionId: string) {
    return prisma.posSession.update({
        where: { id: sessionId },
        data: { lastActivity: new Date() }
    })
}

/**
 * Get all active sessions for a client
 */
export async function getActiveSessions(clientId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    return prisma.posSession.findMany({
        where: {
            clientId,
            lastActivity: { gte: fiveMinutesAgo },
            status: "ACTIVE"
        },
        include: {
            user: {
                select: { id: true, name: true, email: true }
            }
        },
        orderBy: { startedAt: 'asc' }
    })
}

/**
 * Clean up stale sessions (older than 10 minutes without activity)
 */
export async function cleanupStaleSessions() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    return prisma.posSession.updateMany({
        where: {
            lastActivity: { lt: tenMinutesAgo },
            status: "ACTIVE"
        },
        data: {
            status: "TIMEOUT",
            endedAt: new Date()
        }
    })
}
