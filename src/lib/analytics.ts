/**
 * Thin wrapper over Google Analytics gtag.js for typed, SSR-safe event tracking.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/analytics';
 *   trackEvent('share_action', { method: 'native_share' });
 *
 * No-ops silently if gtag has not loaded yet (SSR, ad blockers, GA disabled).
 */

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

export type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params?: EventParams): void {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params ?? {});
}
