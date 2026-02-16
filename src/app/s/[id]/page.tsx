/**
 * Dynamic Share Page — /s/[id]
 * 
 * This page exists solely for social media crawlers.
 * It sets dynamic OG meta tags pointing to the uploaded snapshot,
 * then client-side redirects the real user to the main canvas.
 * 
 * URL format: /s/[id]?x=100&y=-200&z=1.5
 * -> OG image: /api/snapshot/[id]
 * -> Redirect: /#x=100&y=-200&z=1.5
 */

import type { Metadata } from 'next';
import ShareRedirect from './ShareRedirect';

interface SharePageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ x?: string; y?: string; z?: string }>;
}

/**
 * Generate dynamic OG metadata with the uploaded snapshot as the image.
 */
export async function generateMetadata({ params, searchParams }: SharePageProps): Promise<Metadata> {
    const { id } = await params;
    const sp = await searchParams;

    const x = sp.x || '0';
    const y = sp.y || '0';
    const z = sp.z || '1';

    const coordLabel = `(${x}, ${y}) · ${z}x zoom`;
    const title = `Drawny — Come draw here!`;
    const description = `Check out this spot at ${coordLabel} on Drawny. Draw with strangers on a shared canvas — no login needed.`;

    // Determine base URL for OG image (must be absolute)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://drawny.com';
    const ogImageUrl = `${baseUrl}/api/snapshot/${id}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            url: `${baseUrl}/s/${id}?x=${x}&y=${y}&z=${z}`,
            siteName: 'Drawny',
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `Drawing at ${coordLabel} on Drawny`,
                    type: 'image/png',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
        },
    };
}

export default async function SharePage({ searchParams }: SharePageProps) {
    const sp = await searchParams;
    const x = sp.x || '0';
    const y = sp.y || '0';
    const z = sp.z || '1';

    // Build the hash for client-side redirect
    const hash = `#x=${x}&y=${y}&z=${z}`;

    return <ShareRedirect hash={hash} />;
}
