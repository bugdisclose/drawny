'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

interface AnalyticsPageviewProps {
    gaId: string;
}

/**
 * Emits a GA4 page_view on initial mount and on every App Router navigation.
 *
 * The gtag init in layout.tsx sets `send_page_view: false` so we control the
 * timing here — otherwise the initial page_view would fire before Next's
 * hydration finishes and SPA navigations would not be counted at all.
 *
 * Must be rendered inside a <Suspense> boundary because useSearchParams()
 * forces dynamic rendering in the Next 16 App Router.
 */
export default function AnalyticsPageview({ gaId }: AnalyticsPageviewProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

        const search = searchParams?.toString();
        const page_path = search ? `${pathname}?${search}` : pathname;

        window.gtag('event', 'page_view', {
            page_path,
            page_location: window.location.href,
            page_title: document.title,
            send_to: gaId,
        });
    }, [pathname, searchParams, gaId]);

    return null;
}
