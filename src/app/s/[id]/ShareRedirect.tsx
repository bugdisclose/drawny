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
            <h1
                style={{
                    fontSize: '32px',
                    fontWeight: 800,
                    letterSpacing: '-1px',
                    margin: 0,
                    background:
                        'linear-gradient(90deg, #6b3fe9 0%, #c92b7c 38%, #f35a2d 68%, #ffc847 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: 'transparent',
                    filter:
                        'drop-shadow(0 0 10px rgba(201, 43, 124, 0.5)) drop-shadow(0 0 22px rgba(243, 90, 45, 0.35))',
                }}
            >
                drawny
            </h1>
            <p style={{ fontSize: '16px', opacity: 0.7 }}>Taking you to the canvas...</p>
        </div>
    );
}
