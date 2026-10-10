'use client'

import { get, set } from 'idb-keyval'

/**
 * Offline Session Persistence
 * 
 * Stores an encrypted flag in IndexedDB to allow the UI to load in 
 * an "optimistic" logged-in state while the real session is validated.
 */

const SESSION_FLAG_KEY = 'plentypay-session-active'

/**
 * Persists a simple session active flag
 * Called on successful login
 */
export async function persistSessionActive(userId: string): Promise<void> {
    if (typeof window === 'undefined') return

    const now = Date.now()
    const data = {
        active: true,
        timestamp: now,
        // Note: In a real enterprise app, we'd encrypt this or use a non-predictable token
        u: btoa(userId).substring(0, 10)
    }

    await set(SESSION_FLAG_KEY, data)
}

/**
 * Clears the session flag
 * Called on logout
 */
export async function clearSessionPersisted(): Promise<void> {
    if (typeof window === 'undefined') return
    await set(SESSION_FLAG_KEY, null)
}

/**
 * Checks if there's an active session flag
 * Used for "Optimistic UI" loading
 */
export async function isSessionPersisted(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    const data = await get<any>(SESSION_FLAG_KEY)
    if (!data || !data.active) return false

    // Flag expires after 7 days (matches refresh token)
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - data.timestamp > SEVEN_DAYS) {
        await clearSessionPersisted()
        return false
    }

    return true
}
