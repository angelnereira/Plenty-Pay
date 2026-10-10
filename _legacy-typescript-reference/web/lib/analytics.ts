/**
 * Analytics Utility
 * 
 * Centralized event tracking for user interactions
 * Supports Google Analytics with development fallback
 */

declare global {
    interface Window {
        gtag?: (...args: any[]) => void
    }
}

export type AnalyticsEvent =
    | 'pwa_button_viewed'
    | 'pwa_button_clicked'
    | 'pwa_install_prompted'
    | 'pwa_install_accepted'
    | 'pwa_install_rejected'
    | 'pwa_install_completed'

export interface AnalyticsProperties {
    [key: string]: string | number | boolean | undefined
    user_type?: 'new' | 'returning'
    visits?: number
    install_count?: number
}

/**
 * Track an analytics event
 * @param event - The event name
 * @param properties - Optional event properties
 */
export function trackEvent(
    event: AnalyticsEvent,
    properties?: AnalyticsProperties
): void {
    // Google Analytics 4
    if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
        window.gtag('event', event, properties)
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
        console.log(
            `%c[Analytics] ${event}`,
            'color: #10b981; font-weight: bold;',
            properties || {}
        )
    }

    // Could also send to custom analytics endpoint
    // fetch('/api/analytics/track', { ... })
}

/**
 * Track page view
 */
export function trackPageView(path: string): void {
    if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_ID || '', {
            page_path: path,
        })
    }

    if (process.env.NODE_ENV === 'development') {
        console.log(
            '%c[Analytics] Page View',
            'color: #3b82f6; font-weight: bold;',
            path
        )
    }
}
