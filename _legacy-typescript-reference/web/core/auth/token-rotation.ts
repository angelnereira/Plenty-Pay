/**
 * Token Rotation Utilities for NextAuth v5
 * 
 * Implements Refresh Token Rotation pattern for enterprise-grade session persistence.
 * - Access tokens expire quickly (15 min) for security
 * - Refresh tokens have longer life (7 days) for UX
 * - Reuse detection invalidates compromised token chains
 * 
 * @see https://authjs.dev/guides/refresh-token-rotation
 */

import { TOKEN_EXPIRATION } from '@/lib/constants/config';

// Token expiration times in milliseconds
export const ACCESS_TOKEN_EXPIRES_IN = TOKEN_EXPIRATION.ACCESS_TOKEN; // 15 minutes
export const REFRESH_TOKEN_EXPIRES_IN = TOKEN_EXPIRATION.REFRESH_TOKEN; // 30 days

// Type for our extended JWT token with rotation support
export interface ExtendedToken {
    id: string
    email?: string
    name?: string
    role: string
    clientId: string
    facturacionEnabled: boolean
    inventoryEnabled: boolean
    posEnabled: boolean
    paydayEnabled: boolean
    logisticsEnabled: boolean
    creditosEnabled: boolean
    // Token rotation fields
    accessTokenExpires: number
    refreshToken: string
    refreshTokenExpires: number
    // Race condition protection
    isRefreshing?: boolean
    // Error state
    error?: 'RefreshTokenExpired' | 'RefreshTokenReused'
}

/**
 * Generates a new refresh token
 * Using crypto-safe random string
 */
export function generateRefreshToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Checks if the access token has expired
 */
export function isAccessTokenExpired(token: ExtendedToken): boolean {
    return Date.now() >= token.accessTokenExpires
}

/**
 * Checks if the refresh token has expired
 */
export function isRefreshTokenExpired(token: ExtendedToken): boolean {
    return Date.now() >= token.refreshTokenExpires
}

/**
 * Creates initial token timestamps for a new session
 */
export function createTokenTimestamps() {
    const now = Date.now()
    return {
        accessTokenExpires: now + ACCESS_TOKEN_EXPIRES_IN,
        refreshToken: generateRefreshToken(),
        refreshTokenExpires: now + REFRESH_TOKEN_EXPIRES_IN,
        isRefreshing: false,
    }
}

/**
 * Refreshes the access token while keeping the same refresh token
 * Called when access token expires but refresh token is still valid
 * 
 * Protection against race conditions: checks isRefreshing flag
 */
export function refreshAccessToken(token: ExtendedToken): ExtendedToken {
    // If already refreshing, return current token
    if (token.isRefreshing) {
        return token
    }

    console.log('[TokenRotation] Refreshing access token')
    return {
        ...token,
        accessTokenExpires: Date.now() + ACCESS_TOKEN_EXPIRES_IN,
        isRefreshing: false,
        error: undefined,
    }
}

/**
 * Rotates both tokens (called periodically for security)
 * This also updates the refresh token for additional security
 */
export function rotateTokens(token: ExtendedToken): ExtendedToken {
    const now = Date.now()
    return {
        ...token,
        accessTokenExpires: now + ACCESS_TOKEN_EXPIRES_IN,
        refreshToken: generateRefreshToken(),
        refreshTokenExpires: now + REFRESH_TOKEN_EXPIRES_IN,
        isRefreshing: false,
        error: undefined,
    }
}

/**
 * Marks token as having an error (expired or reused)
 */
export function markTokenError(
    token: ExtendedToken,
    error: 'RefreshTokenExpired' | 'RefreshTokenReused'
): ExtendedToken {
    return {
        ...token,
        error,
    }
}
