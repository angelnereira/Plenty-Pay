/**
 * PWA Install Counter Utility
 * 
 * Manages installation count for social proof display
 */

const STORAGE_KEY = 'pwa_install_count'
const BASE_COUNT = 10000  // Starting mock count

/**
 * Get current install count
 */
export function getInstallCount(): number {
    if (typeof window === 'undefined') return BASE_COUNT

    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? parseInt(stored, 10) : BASE_COUNT
}

/**
 * Increment install count (when user installs)
 */
export function incrementInstallCount(): number {
    const current = getInstallCount()
    const newCount = current + 1

    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newCount.toString())
    }

    return newCount
}

/**
 * Format count for display
 * Examples: 10,000+ → 10K+, 100,000+ → 100K+
 */
export function formatInstallCount(count: number): string {
    if (count >= 100000) {
        return `${Math.floor(count / 1000)}K+`
    }

    if (count >= 10000) {
        const rounded = (count / 1000).toFixed(1)
        return `${rounded}K+`
    }

    return `${count.toLocaleString()}+`
}

/**
 * Get user visit information
 */
export function getUserVisitInfo(): {
    isReturning: boolean
    visitCount: number
} {
    if (typeof window === 'undefined') {
        return { isReturning: false, visitCount: 1 }
    }

    const visited = localStorage.getItem('user_visited')
    const visitCount = parseInt(localStorage.getItem('visit_count') || '0', 10)

    if (!visited) {
        localStorage.setItem('user_visited', 'true')
        localStorage.setItem('visit_count', '1')
        return { isReturning: false, visitCount: 1 }
    }

    const newCount = visitCount + 1
    localStorage.setItem('visit_count', newCount.toString())

    return { isReturning: true, visitCount: newCount }
}

/**
 * Get personalized button text based on user visits
 */
export function getPersonalizedButtonText(visitCount: number, isReturning: boolean): string {
    if (!isReturning) {
        return 'Descargar App'
    }

    if (visitCount >= 5) {
        return '¡Instala ahora y ahorra tiempo!'
    }

    if (visitCount >= 3) {
        return `${visitCount}ª visita - ¡Instala ahora!`
    }

    return '¡Bienvenido de nuevo - Instala!'
}
