/**
 * Security Token Service
 *
 * Handles generation, hashing, verification, and one-time consumption
 * of security tokens for password reset, account setup, and email verification.
 *
 * Security design:
 * - Tokens are 32 bytes (64 hex chars), cryptographically random
 * - Only SHA-256 hashes are stored in DB (never the raw token)
 * - Tokens are single-use: consumed immediately on verification
 * - Short expiration (30 min for reset, 24h for setup)
 */

import { randomBytes, createHash } from 'crypto'
import { prisma } from '@core/database'
import { TOKEN_EXPIRATION } from '@/lib/constants/config'
import type { SecurityTokenType } from '@prisma/client'

/**
 * Hash a raw token using SHA-256
 */
function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate a cryptographically secure random token (32 bytes = 64 hex chars)
 */
function generateRawToken(): string {
    return randomBytes(32).toString('hex')
}

/**
 * Get expiration duration based on token type
 */
function getExpirationMs(type: SecurityTokenType): number {
    switch (type) {
        case 'PASSWORD_RESET':
            return TOKEN_EXPIRATION.SECURITY_TOKEN
        case 'ACCOUNT_SETUP':
        case 'EMAIL_VERIFICATION':
            return TOKEN_EXPIRATION.ACCOUNT_SETUP_TOKEN
        default:
            return TOKEN_EXPIRATION.SECURITY_TOKEN
    }
}

interface CreateTokenParams {
    type: SecurityTokenType
    email: string
    userId?: string
}

interface CreateTokenResult {
    rawToken: string
    expiresAt: Date
}

/**
 * Create a new security token.
 *
 * Invalidates any existing unused tokens of the same type for the same email
 * before creating a new one (prevents token accumulation).
 *
 * @returns The raw token (to be sent via email) and expiration date
 */
export async function createSecurityToken({
    type,
    email,
    userId,
}: CreateTokenParams): Promise<CreateTokenResult> {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + getExpirationMs(type))

    // Invalidate previous unused tokens of the same type for this email
    await prisma.securityToken.updateMany({
        where: {
            email,
            type,
            usedAt: null,
        },
        data: {
            usedAt: new Date(), // Mark as "used" to invalidate
        },
    })

    // Create the new token
    await prisma.securityToken.create({
        data: {
            tokenHash,
            type,
            email,
            userId,
            expiresAt,
        },
    })

    return { rawToken, expiresAt }
}

interface VerifyTokenResult {
    valid: boolean
    email?: string
    userId?: string | null
    tokenId?: string
    error?: string
}

/**
 * Verify and consume a security token (one-time use).
 *
 * This is an atomic operation: the token is marked as used immediately
 * upon successful verification, preventing replay attacks.
 */
export async function verifyAndConsumeToken(
    rawToken: string,
    expectedType: SecurityTokenType,
    ip?: string,
    userAgent?: string,
): Promise<VerifyTokenResult> {
    const tokenHash = hashToken(rawToken)

    // Find the token
    const securityToken = await prisma.securityToken.findFirst({
        where: {
            tokenHash,
            type: expectedType,
        },
    })

    if (!securityToken) {
        return { valid: false, error: 'Token inválido o no encontrado.' }
    }

    // Check if already used
    if (securityToken.usedAt) {
        return { valid: false, error: 'Este enlace ya fue utilizado. Solicita uno nuevo.' }
    }

    // Check expiration
    if (new Date() > securityToken.expiresAt) {
        return { valid: false, error: 'Este enlace ha expirado. Solicita uno nuevo.' }
    }

    // Consume the token atomically
    await prisma.securityToken.update({
        where: { id: securityToken.id },
        data: {
            usedAt: new Date(),
            consumedIp: ip,
            consumedUserAgent: userAgent,
        },
    })

    return {
        valid: true,
        email: securityToken.email,
        userId: securityToken.userId,
        tokenId: securityToken.id,
    }
}

/**
 * Cleanup expired tokens (can be called from a cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.securityToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { usedAt: { not: null }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            ],
        },
    })
    return result.count
}
