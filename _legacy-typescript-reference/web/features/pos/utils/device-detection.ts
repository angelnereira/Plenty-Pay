import { DeviceType } from '../types/pos-types';

/**
 * Detects if the current device is a mobile phone
 */
export function isMobile(): boolean {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isSmallScreen = window.innerWidth < 768;

    return isMobileUA || isSmallScreen;
}

/**
 * Detects if the current device is a tablet
 */
export function isTablet(): boolean {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent.toLowerCase();
    const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
    const isMediumScreen = window.innerWidth >= 768 && window.innerWidth < 1024;

    return isTabletUA || isMediumScreen;
}

/**
 * Detects if the current device is desktop
 */
export function isDesktop(): boolean {
    return !isMobile() && !isTablet();
}

/**
 * Returns the device type
 */
export function getDeviceType(): DeviceType {
    if (isMobile()) return 'mobile';
    if (isTablet()) return 'tablet';
    return 'desktop';
}

/**
 * Check if device has touch capability
 */
export function isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - legacy property
        navigator.msMaxTouchPoints > 0
    );
}

/**
 * Detects if device is in landscape orientation
 */
export function isLandscape(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
}
