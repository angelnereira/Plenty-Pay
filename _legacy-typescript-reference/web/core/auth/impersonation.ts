/**
 * Impersonation Token Utilities
 * 
 * Provides secure token generation and verification for admin impersonation.
 * Uses HMAC-SHA256 for signing and includes timestamp expiration.
 * 
 * @module core/auth/impersonation
 */

import { TOKEN_EXPIRATION } from '@/lib/constants/config';

// Impersonation token expiration (1 hour)
export const IMPERSONATION_TOKEN_EXPIRES_IN = TOKEN_EXPIRATION.IMPERSONATION;

/**
 * Token payload structure
 */
interface ImpersonationPayload {
    targetUserId: string;
    adminId: string;
    issuedAt: number;
    expiresAt: number;
}

/**
 * Creates a secure impersonation token
 * Token format: base64(JSON payload):base64(HMAC signature)
 * 
 * @param targetUserId - User ID to impersonate
 * @param adminId - Admin user performing impersonation
 * @returns Signed impersonation token
 */
export async function createImpersonationToken(
    targetUserId: string,
    adminId: string
): Promise<string> {
    const now = Date.now();

    const payload: ImpersonationPayload = {
        targetUserId,
        adminId,
        issuedAt: now,
        expiresAt: now + IMPERSONATION_TOKEN_EXPIRES_IN,
    };

    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64');

    // Create HMAC signature using the full NEXTAUTH_SECRET
    const signature = await signPayload(payloadString);

    return `${payloadBase64}.${signature}`;
}

/**
 * Verifies an impersonation token and returns the payload if valid
 * 
 * @param token - The impersonation token to verify
 * @returns The payload if valid, null otherwise
 */
export async function verifyImpersonationToken(
    token: string
): Promise<ImpersonationPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) {
            return null;
        }

        const [payloadBase64, signature] = parts;

        // Decode payload
        const payloadString = Buffer.from(payloadBase64, 'base64').toString();

        // Verify signature
        const expectedSignature = await signPayload(payloadString);
        if (!timingSafeEqual(signature, expectedSignature)) {
            return null;
        }

        // Parse payload
        const payload: ImpersonationPayload = JSON.parse(payloadString);

        // Check expiration
        if (Date.now() >= payload.expiresAt) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Creates HMAC-SHA256 signature of payload
 */
async function signPayload(payload: string): Promise<string> {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('NEXTAUTH_SECRET is not configured');
    }

    // Use Web Crypto API for Edge compatibility
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    return Buffer.from(signature).toString('base64url');
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Pads the shorter string to prevent length information leaks.
 */
function timingSafeEqual(a: string, b: string): boolean {
    const maxLen = Math.max(a.length, b.length);
    const paddedA = a.padEnd(maxLen, '\0');
    const paddedB = b.padEnd(maxLen, '\0');

    // Always compare full length — no early returns
    let result = a.length ^ b.length; // Length mismatch counts as failure
    for (let i = 0; i < maxLen; i++) {
        result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
    }

    return result === 0;
}
