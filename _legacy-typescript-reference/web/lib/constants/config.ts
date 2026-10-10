/**
 * Configuración de timeouts y límites del sistema
 */

/**
 * Token expiration times (in milliseconds)
 * 
 * Centralized configuration for all authentication token lifetimes.
 * Ensures consistency across the authentication system.
 * 
 * @example
 * ```typescript
 * const expiresAt = Date.now() + TOKEN_EXPIRATION.ACCESS_TOKEN;
 * ```
 */
export const TOKEN_EXPIRATION = {
    /** Access token: 15 minutes */
    ACCESS_TOKEN: 15 * 60 * 1000,
    /** Refresh token: 30 days */
    REFRESH_TOKEN: 30 * 24 * 60 * 60 * 1000,
    /** Impersonation token: 1 hour */
    IMPERSONATION: 60 * 60 * 1000,
    /** Security token (password reset): 30 minutes */
    SECURITY_TOKEN: 30 * 60 * 1000,
    /** Account setup token: 24 hours */
    ACCOUNT_SETUP_TOKEN: 24 * 60 * 60 * 1000,
} as const;

/**
 * Session configuration
 * 
 * NextAuth session settings.
 * Session duration matches refresh token expiration.
 */
export const SESSION = {
    /** Session strategy */
    STRATEGY: 'jwt' as const,
    /** Max age: 30 days (matches refresh token) */
    MAX_AGE: 30 * 24 * 60 * 60,
} as const;

/**
 * SOAP/API timeouts (in milliseconds)
 * 
 * Timeout configuration for external service calls.
 * Prevents hanging requests and improves user experience.
 * 
 * @example
 * ```typescript
 * const options = { timeout: TIMEOUTS.HKA_API };
 * ```
 */
export const TIMEOUTS = {
    /** Default SOAP timeout: 30 seconds */
    SOAP_DEFAULT: 30_000,
    /** HKA API timeout: 30 seconds */
    HKA_API: 30_000,
    /** Network first timeout: 10 seconds */
    NETWORK_FIRST: 10_000,
} as const;

/**
 * Cache expiration times (in seconds)
 */
export const CACHE_EXPIRATION = {
    /** Google Fonts: 1 year */
    GOOGLE_FONTS: 60 * 60 * 24 * 365,
    /** Static images: 30 days */
    IMAGES: 60 * 60 * 24 * 30,
    /** JS bundles: 1 year (immutable) */
    JS_BUNDLES: 60 * 60 * 24 * 365,
    /** CSS: 30 days */
    CSS: 60 * 60 * 24 * 30,
    /** Pages: 24 hours */
    PAGES: 60 * 60 * 24,
} as const;

/**
 * Retry configuration
 */
export const RETRY = {
    /** Default number of retries for SOAP calls */
    SOAP_RETRIES: 2,
    /** Maximum retry delay: 5 seconds */
    MAX_DELAY_MS: 5000,
} as const;

/**
 * Undo/Redo limits
 */
export const HISTORY = {
    /** POS undo history limit */
    POS_UNDO_LIMIT: 20,
} as const;

/**
 * Demo mode configuration
 */
export const DEMO = {
    /** Demo duration: 14 days */
    DURATION_DAYS: 14,
} as const;
