'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingEngine } from '@/lib/DrawingEngine';
import { Stroke, CANVAS_CONFIG } from '@/types';
import styles from './Canvas.module.css';

// Helper functions for gestures
const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
};

const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};


interface CanvasProps {
    onStrokeStart?: (stroke: Stroke) => void;
    onStrokeUpdate?: (stroke: Stroke) => void;
    onStrokeEnd?: (stroke: Stroke) => void;
    onCursorMove?: (x: number, y: number) => void;
    onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
    engineRef?: React.MutableRefObject<DrawingEngine | null>;
    readOnly?: boolean;
}

export default function Canvas({
    onStrokeStart,
    onStrokeUpdate,
    onStrokeEnd,
    onCursorMove,
    onViewportChange,
    engineRef,
    readOnly = false
}: CanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineInstanceRef = useRef<DrawingEngine | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Viewport state for pan/zoom
    const viewportRef = useRef({
        x: 0,
        y: 0,
        zoom: 1,
    });
    const [viewportState, setViewportState] = useState(viewportRef.current);
    const lastUpdateRef = useRef(0);

    // Direct DOM update for smooth performance
    const updateTransform = useCallback(() => {
        if (canvasRef.current) {
            const { x, y, zoom } = viewportRef.current;
            canvasRef.current.style.transform = `translate(${-x}px, ${-y}px) scale(${zoom})`;
        }
    }, []);

    // Throttled UI update
    const updateUI = useCallback(() => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 32) { // ~30fps for UI is sufficient
            setViewportState({ ...viewportRef.current });
            onViewportChange?.(viewportRef.current);
            lastUpdateRef.current = now;
        }
    }, [onViewportChange]);

    const [isPanning, setIsPanning] = useState(false);
    const lastPanPositionRef = useRef({ x: 0, y: 0 });
    const isSpacePressedRef = useRef(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    // Touch gesture state
    const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
    const lastPinchDist = useRef<number | null>(null);
    const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);


    // Initialize viewport on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const initialViewport = {
                x: (CANVAS_CONFIG.width - window.innerWidth) / 2,
                y: (CANVAS_CONFIG.height - window.innerHeight) / 2,
                zoom: 1,
            };
            viewportRef.current = initialViewport;
            setViewportState(initialViewport);
        }
    }, []);

    // Initialize drawing engine
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.log('[Canvas] No canvas ref yet');
            return;
        }

        if (engineInstanceRef.current) {
            console.log('[Canvas] Engine already exists');
            return;
        }

        console.log('[Canvas] Creating drawing engine...');

        const newEngine = new DrawingEngine({
            canvas: canvas,
            onStrokeStart,
            onStrokeUpdate,
            onStrokeEnd,
        });

        engineInstanceRef.current = newEngine;

        if (engineRef) {
            engineRef.current = newEngine;
        }

        setIsReady(true);
        console.log('[Canvas] Drawing engine created successfully');
    }, [onStrokeStart, onStrokeUpdate, onStrokeEnd, engineRef]);

    // Notify parent of viewport changes
    useEffect(() => {
        onViewportChange?.(viewportState);
    }, [viewportState, onViewportChange]);

    // Convert screen coordinates to canvas coordinates
    const screenToCanvas = useCallback((screenX: number, screenY: number) => {
        const viewport = viewportRef.current;
        return {
            x: (screenX + viewport.x) / viewport.zoom,
            y: (screenY + viewport.y) / viewport.zoom,
        };
    }, []);

    // Prevent native gestures on iOS/iPad
    useEffect(() => {
        const preventDefault = (e: Event) => e.preventDefault();
        document.addEventListener('gesturestart', preventDefault);
        document.addEventListener('gesturechange', preventDefault);
        document.addEventListener('gestureend', preventDefault);
        return () => {
            document.removeEventListener('gesturestart', preventDefault);
            document.removeEventListener('gesturechange', preventDefault);
            document.removeEventListener('gestureend', preventDefault);
        };
    }, []);

    // Handle keyboard events for pan mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !isSpacePressedRef.current) {
                isSpacePressedRef.current = true;
                setIsSpacePressed(true);
                e.preventDefault();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                isSpacePressedRef.current = false;
                setIsSpacePressed(false);
                setIsPanning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Handle pointer events
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const container = containerRef.current;
        const engine = engineInstanceRef.current;

        if (!container) return;

        container.setPointerCapture(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Check for multi-touch gesture
        if (activePointers.current.size === 2) {
            setIsPanning(true); // Gesture overrides drawing
            const points = Array.from(activePointers.current.values());
            lastPinchDist.current = getDistance(points[0], points[1]);
            lastPinchCenter.current = getCenter(points[0], points[1]);
            engine?.endStroke(); // Cancel any active stroke
            return;
        }

        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Check for pan mode (middle mouse, space+click, or readOnly)
        if (e.button === 1 || isSpacePressedRef.current || readOnly) {
            setIsPanning(true);
            lastPanPositionRef.current = { x: screenX, y: screenY };
            container.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        // Left click draws (only if not readOnly and single pointer)
        if (e.button === 0 && !readOnly && activePointers.current.size === 1) {
            if (!engine) {
                console.log('[Canvas] Cannot draw - engine not ready');
                return;
            }
            const { x, y } = screenToCanvas(screenX, screenY);
            engine.startStroke(x, y, e.pressure || 1);
        }
    }, [screenToCanvas, readOnly]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const container = containerRef.current;
        if (!container) return;

        // Update pointer position
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Handle multi-touch gesture (Pinch/Pan)
        if (activePointers.current.size === 2) {
            const points = Array.from(activePointers.current.values());
            const dist = getDistance(points[0], points[1]);
            const center = getCenter(points[0], points[1]);

            if (lastPinchDist.current && lastPinchCenter.current) {
                // Determine new zoom
                const zoomFactor = dist / lastPinchDist.current;
                const newZoom = Math.max(
                    CANVAS_CONFIG.minZoom,
                    Math.min(CANVAS_CONFIG.maxZoom, viewportRef.current.zoom * zoomFactor)
                );

                // Calculate viewport to keep canvas point under gesture center
                const pCanvasX = (lastPinchCenter.current.x - rect.left + viewportRef.current.x) / viewportRef.current.zoom;
                const pCanvasY = (lastPinchCenter.current.y - rect.top + viewportRef.current.y) / viewportRef.current.zoom;

                viewportRef.current = {
                    x: (center.x - rect.left) - pCanvasX * newZoom,
                    y: (center.y - rect.top) - pCanvasY * newZoom,
                    zoom: newZoom
                };
                updateTransform();
                updateUI();
            }

            lastPinchDist.current = dist;
            lastPinchCenter.current = center;
            return;
        }

        const canvasCoords = screenToCanvas(screenX, screenY);
        onCursorMove?.(canvasCoords.x, canvasCoords.y);

        if (isPanning) {
            // Check if it's a mouse pan or leftover gesture state
            if (activePointers.current.size === 0 || e.pointerType === 'mouse') {
                const dx = screenX - lastPanPositionRef.current.x;
                const dy = screenY - lastPanPositionRef.current.y;

                viewportRef.current = {
                    ...viewportRef.current,
                    x: viewportRef.current.x - dx,
                    y: viewportRef.current.y - dy,
                };
                updateTransform();
                updateUI();
                lastPanPositionRef.current = { x: screenX, y: screenY };
            }
            return;
        }

        // Continue drawing
        const engine = engineInstanceRef.current;
        if (engine && activePointers.current.size === 1) {
            // Additional check: verify the moving pointer is the one drawing?
            // Engine handles single stroke state, so if we just feed it, it works.
            engine.continueStroke(canvasCoords.x, canvasCoords.y, e.pressure || 1);
        }
    }, [isPanning, screenToCanvas, onCursorMove]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        const container = containerRef.current;
        activePointers.current.delete(e.pointerId);

        if (activePointers.current.size < 2) {
            lastPinchDist.current = null;
            lastPinchCenter.current = null;

            // If we were pinching, we might want to stop panning
            if (activePointers.current.size === 0) {
                setIsPanning(false);
            }
        }

        const engine = engineInstanceRef.current;
        if (engine) {
            engine.endStroke();
        }

        if (container) {
            try {
                container.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore
            }
            container.style.cursor = isSpacePressedRef.current ? 'grab' : 'crosshair';
        }
    }, []);

    // Handle wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const currentZoom = viewportRef.current.zoom;
        const newZoom = Math.max(
            CANVAS_CONFIG.minZoom,
            Math.min(CANVAS_CONFIG.maxZoom, currentZoom * zoomFactor)
        );

        // Adjust viewport to zoom towards mouse position
        const scale = newZoom / currentZoom;
        viewportRef.current = {
            x: mouseX + (viewportRef.current.x - mouseX) * scale,
            y: mouseY + (viewportRef.current.y - mouseY) * scale,
            zoom: newZoom,
        };
        updateTransform();
        updateUI();
    }, [updateTransform, updateUI]);

    // Reset view to center
    const resetView = useCallback(() => {
        if (typeof window === 'undefined') return;
        const newViewport = {
            x: (CANVAS_CONFIG.width - window.innerWidth) / 2,
            y: (CANVAS_CONFIG.height - window.innerHeight) / 2,
            zoom: 1,
        };
        viewportRef.current = newViewport;
        updateTransform();
        setViewportState(newViewport); // Immediate update for reset
    }, [updateTransform]);

    return (
        <div
            ref={containerRef}
            className={`${styles.container} ${isSpacePressed ? styles.panMode : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
        >
            <canvas
                ref={canvasRef}
                width={CANVAS_CONFIG.width}
                height={CANVAS_CONFIG.height}
                className={styles.canvas}
                style={{
                    transform: `translate(${-viewportState.x}px, ${-viewportState.y}px) scale(${viewportState.zoom})`,
                    transformOrigin: 'top left',
                }}
            />

            {/* Zoom indicator */}
            <div className={styles.zoomIndicator}>
                {Math.round(viewportState.zoom * 100)}%
                <button onClick={resetView} className={styles.resetButton}>
                    Reset
                </button>
            </div>

            {/* Help text with keyboard shortcuts */}
            <div className={styles.helpText}>
                <span className={styles.helpItem}>
                    <span className={styles.helpKey}>Space</span>
                    + drag to pan
                </span>
                <span className={styles.helpItem}>
                    <span className={styles.helpKey}>Scroll</span>
                    to zoom
                </span>
                <span className={styles.helpItem}>
                    <span className={styles.helpKey}>B</span>
                    brush
                </span>
                <span className={styles.helpItem}>
                    <span className={styles.helpKey}>E</span>
                    eraser
                </span>
            </div>
        </div>
    );
}
