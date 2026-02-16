/**
 * Client-side redirect component for the share page.
 * Social media crawlers only read the server-rendered HTML (OG tags),
 * while real users get redirected to the main canvas.
 */

'use client';

import { useEffect } from 'react';

interface ShareRedirectProps {
    hash: string;
}

export default function ShareRedirect({ hash }: ShareRedirectProps) {
    useEffect(() => {
        // Redirect to the main canvas with coordinates
        window.location.replace(`/${hash}`);
    }, [hash]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#1a1a2e',
                color: '#fff',
                fontFamily: 'Inter, system-ui, sans-serif',
                gap: '12px',
            }}
        >
            <h1 style={{ fontSize: '28px', fontWeight: 700 }}>drawny</h1>
            <p style={{ fontSize: '16px', opacity: 0.7 }}>Taking you to the canvas...</p>
        </div>
    );
}
