'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw as it's client-side only
const Excalidraw = dynamic(
    () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
    {
        ssr: false,
        loading: () => <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: '#666'
        }}>Loading viewer...</div>
    }
);

interface ArchiveCanvasViewerProps {
    strokes: any[]; // Using any to bypass legacy Stroke type conflict, these are ExcalidrawElement[]
}

export default function ArchiveCanvasViewer({ strokes }: ArchiveCanvasViewerProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

    // Safely parse and validate elements from props
    const elements = useMemo<ExcalidrawElement[]>(() => {
        let raw = strokes;
        // Handle double-encoded JSON string
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw);
            } catch {
                return [];
            }
        }
        if (raw && Array.isArray(raw)) {
            return raw.filter((el: any) => !el.isDeleted) as ExcalidrawElement[];
        }
        return [];
    }, [strokes]);

    // Once both the API and elements are ready, push elements via updateScene.
    // This avoids the blank-on-first-load bug where initialData is consumed
    // before the dynamic import resolves, leaving the canvas empty.
    useEffect(() => {
        if (!excalidrawAPI || elements.length === 0) return;
        excalidrawAPI.updateScene({ elements });
        // Scroll to content after a short delay to let Excalidraw layout
        setTimeout(() => {
            excalidrawAPI.scrollToContent(elements, { fitToContent: true });
        }, 100);
    }, [excalidrawAPI, elements]);

    const onExcalidrawAPI = useCallback((api: any) => {
        setExcalidrawAPI(api);
    }, []);

    if (elements.length === 0) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: 'Inter, sans-serif',
                color: '#666',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>:/</div>
                <div style={{ fontSize: '18px' }}>This archive is empty or corrupted</div>
                <Link href="/gallery" style={{
                    marginTop: '16px',
                    padding: '10px 20px',
                    background: '#1a1a2e',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500
                }}>
                    Back to Gallery
                </Link>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: '100%', height: '100%' }}>
                <Excalidraw
                    initialData={{
                        elements: elements,
                        appState: {
                            viewBackgroundColor: '#ffffff',
                            currentItemStrokeColor: '#000000',
                            currentItemBackgroundColor: 'transparent',
                        }
                    }}
                    excalidrawAPI={onExcalidrawAPI}
                    viewModeEnabled={true}
                    zenModeEnabled={true}
                    gridModeEnabled={false}
                    theme="light"
                    name="Drawny Archive"
                    UIOptions={{
                        canvasActions: {
                            changeViewBackgroundColor: false,
                            clearCanvas: false,
                            export: false,
                            loadScene: false,
                            saveToActiveFile: false,
                            toggleTheme: false,
                            saveAsImage: true,
                        },
                    }}
                />
            </div>

            <div style={{
                position: 'fixed',
                top: '20px',
                left: '20px',
                zIndex: 1000
            }}>
                <Link href="/gallery" style={{
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
                </Link>
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
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span>{elements.length} strokes</span>
                <span style={{ width: '4px', height: '4px', background: '#ccc', borderRadius: '50%' }}></span>
                <span>Read-only</span>
            </div>
        </div>
    );
}
