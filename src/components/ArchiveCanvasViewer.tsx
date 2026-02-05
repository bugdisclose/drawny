'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DrawingEngine } from '@/lib/DrawingEngine';
import { Stroke } from '@/types';

// Dynamic import for Canvas to avoid SSR issues
const Canvas = dynamic(() => import('@/components/Canvas'), {
    ssr: false,
    loading: () => <div>Loading canvas...</div>
});

interface ArchiveCanvasViewerProps {
    strokes: Stroke[];
}

export default function ArchiveCanvasViewer({ strokes }: ArchiveCanvasViewerProps) {
    const engineRef = useRef<DrawingEngine | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Poll for engine availability and draw strokes
        const interval = setInterval(() => {
            if (engineRef.current) {
                console.log('[ArchiveViewer] Engine ready, drawing', strokes.length, 'strokes');
                engineRef.current.clear();
                engineRef.current.drawStrokes(strokes);
                setIsReady(true);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [strokes]);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <Canvas
                readOnly
                engineRef={engineRef}
            />

            {!isReady && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(26, 26, 46, 0.9)',
                    color: 'white',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    Loading archive...
                </div>
            )}

            <div style={{
                position: 'fixed',
                top: '20px',
                left: '20px',
                zIndex: 1000
            }}>
                <a href="/gallery" style={{
                    padding: '10px 20px',
                    background: 'rgba(26, 26, 46, 0.9)',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontFamily: 'Inter, sans-serif',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>←</span> Gallery
                </a>
            </div>

            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '10px 20px',
                borderRadius: '8px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(10px)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: '#666'
            }}>
                {strokes.length} strokes • Read-only
            </div>
        </div>
    );
}
