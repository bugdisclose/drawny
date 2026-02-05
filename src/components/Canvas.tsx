'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingEngine } from '@/lib/DrawingEngine';
import { Stroke, CANVAS_CONFIG, ToolType } from '@/types';
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
    activeTool?: ToolType;
}

export default function Canvas({
    onStrokeStart,
    onStrokeUpdate,
    onStrokeEnd,
    onCursorMove,
    onViewportChange,
    engineRef,
    readOnly = false,
    activeTool = 'brush'
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

    // Animation state for smooth zoom
    const animationFrameRef = useRef<number | null>(null);
    const targetViewportRef = useRef(viewportRef.current);
    const isAnimatingRef = useRef(false);

    // Smooth animation loop - defined once and stored in ref
    const animateViewportRef = useRef<(() => void) | undefined>(undefined);

    useEffect(() => {
        animateViewportRef.current = () => {
            if (!isAnimatingRef.current) return;

            const current = viewportRef.current;
            const target = targetViewportRef.current;

            // Smooth interpolation (ease-out) - much smoother!
            const lerp = (start: number, end: number, factor: number) => {
                return start + (end - start) * factor;
            };

            const smoothFactor = 0.35; // Increased for faster, smoother animation
            const threshold = 0.01; // Slightly higher threshold

            const newX = lerp(current.x, target.x, smoothFactor);
            const newY = lerp(current.y, target.y, smoothFactor);
            const newZoom = lerp(current.zoom, target.zoom, smoothFactor);

            // Check if we're close enough to target
            const deltaX = Math.abs(target.x - newX);
            const deltaY = Math.abs(target.y - newY);
            const deltaZoom = Math.abs(target.zoom - newZoom);

            if (deltaX < threshold && deltaY < threshold && deltaZoom < 0.001) {
                // Animation complete - snap to target
                viewportRef.current = target;
                isAnimatingRef.current = false;
            } else {
                // Continue animating
                viewportRef.current = { x: newX, y: newY, zoom: newZoom };
                animationFrameRef.current = requestAnimationFrame(animateViewportRef.current!);
            }

            // Update DOM immediately for smooth 60fps
            if (canvasRef.current) {
                const { x, y, zoom } = viewportRef.current;
                canvasRef.current.style.transform = `translate(${-x}px, ${-y}px) scale(${zoom})`;
            }

            // Update React state every frame for smooth zoom indicator
            setViewportState({ ...viewportRef.current });
            onViewportChange?.(viewportRef.current);
        };
    }, [onViewportChange]);

    // Start smooth animation to target viewport
    const smoothTransitionTo = useCallback((target: { x: number; y: number; zoom: number }) => {
        targetViewportRef.current = target;

        if (!isAnimatingRef.current) {
            isAnimatingRef.current = true;
            if (animateViewportRef.current) {
                animateViewportRef.current();
            }
        }
    }, []);

    // Direct DOM update for immediate feedback (used during dragging)
    const updateTransform = useCallback(() => {
        if (canvasRef.current) {
            const { x, y, zoom } = viewportRef.current;
            canvasRef.current.style.transform = `translate(${-x}px, ${-y}px) scale(${zoom})`;
        }
    }, []);

    // Throttled UI update
    const updateUI = useCallback(() => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 16) { // ~60fps for smoother UI
            setViewportState({ ...viewportRef.current });
            onViewportChange?.(viewportRef.current);
            lastUpdateRef.current = now;
        }
    }, [onViewportChange]);

    // Momentum panning animation
    const applyMomentum = useCallback(() => {
        const friction = 0.92; // Deceleration factor
        const minVelocity = 0.1; // Stop when velocity is very small

        const vx = panVelocityRef.current.x;
        const vy = panVelocityRef.current.y;

        if (Math.abs(vx) < minVelocity && Math.abs(vy) < minVelocity) {
            // Stop momentum
            panVelocityRef.current = { x: 0, y: 0 };
            if (momentumAnimationRef.current) {
                cancelAnimationFrame(momentumAnimationRef.current);
                momentumAnimationRef.current = null;
            }
            return;
        }

        // Apply velocity to viewport
        viewportRef.current = {
            ...viewportRef.current,
            x: viewportRef.current.x - vx,
            y: viewportRef.current.y - vy,
        };

        // Apply friction
        panVelocityRef.current = {
            x: vx * friction,
            y: vy * friction,
        };

        updateTransform();
        updateUI();

        // Continue animation
        momentumAnimationRef.current = requestAnimationFrame(applyMomentum);
    }, [updateTransform, updateUI]);

    // Start momentum animation
    const startMomentum = useCallback(() => {
        if (momentumAnimationRef.current) {
            cancelAnimationFrame(momentumAnimationRef.current);
        }
        momentumAnimationRef.current = requestAnimationFrame(applyMomentum);
    }, [applyMomentum]);

    // Stop momentum animation
    const stopMomentum = useCallback(() => {
        if (momentumAnimationRef.current) {
            cancelAnimationFrame(momentumAnimationRef.current);
            momentumAnimationRef.current = null;
        }
        panVelocityRef.current = { x: 0, y: 0 };
    }, []);

    // Cleanup animation frames on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (momentumAnimationRef.current) {
                cancelAnimationFrame(momentumAnimationRef.current);
            }
        };
    }, []);

    const [isPanning, setIsPanning] = useState(false);
    const lastPanPositionRef = useRef({ x: 0, y: 0 });
    const isSpacePressedRef = useRef(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    // Momentum panning state
    const panVelocityRef = useRef({ x: 0, y: 0 });
    const lastPanTimeRef = useRef(0);
    const momentumAnimationRef = useRef<number | null>(null);

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

    // Nuclear option for iOS touch handling: prevent scrolling/gestures on container
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const preventDefault = (e: TouchEvent) => {
            // Allow buttons to work
            if ((e.target as HTMLElement).closest('button')) return;
            e.preventDefault();
        };

        // Use non-passive listener to be able to prevent default
        container.addEventListener('touchstart', preventDefault, { passive: false });
        container.addEventListener('touchmove', preventDefault, { passive: false });
        container.addEventListener('touchend', preventDefault, { passive: false });

        return () => {
            container.removeEventListener('touchstart', preventDefault);
            container.removeEventListener('touchmove', preventDefault);
            container.removeEventListener('touchend', preventDefault);
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

        // Check for pan mode (middle mouse, space+click, readOnly, or hand tool)
        if (e.button === 1 || isSpacePressedRef.current || readOnly || activeTool === 'hand') {
            setIsPanning(true);
            lastPanPositionRef.current = { x: screenX, y: screenY };
            lastPanTimeRef.current = Date.now();
            stopMomentum(); // Stop any existing momentum
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
    }, [screenToCanvas, readOnly, activeTool, stopMomentum]);

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
            // Check if it's a single pointer pan (mouse or touch)
            if (activePointers.current.size <= 1) {
                const now = Date.now();
                const dt = now - lastPanTimeRef.current;

                const dx = screenX - lastPanPositionRef.current.x;
                const dy = screenY - lastPanPositionRef.current.y;

                // Calculate velocity for momentum
                if (dt > 0) {
                    panVelocityRef.current = {
                        x: dx / (dt / 16), // Normalize to ~60fps
                        y: dy / (dt / 16),
                    };
                }

                viewportRef.current = {
                    ...viewportRef.current,
                    x: viewportRef.current.x - dx,
                    y: viewportRef.current.y - dy,
                };
                updateTransform();
                updateUI();

                lastPanPositionRef.current = { x: screenX, y: screenY };
                lastPanTimeRef.current = now;
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

            // If we were pinching or panning, stop and apply momentum
            if (activePointers.current.size === 0) {
                if (isPanning) {
                    // Start momentum animation if velocity is significant
                    const vx = panVelocityRef.current.x;
                    const vy = panVelocityRef.current.y;
                    const speed = Math.sqrt(vx * vx + vy * vy);

                    if (speed > 0.5) {
                        startMomentum();
                    }
                }
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
            container.style.cursor = (isSpacePressedRef.current || activeTool === 'hand') ? 'grab' : 'crosshair';
        }
    }, [isPanning, startMomentum]);



    // Zoom in/out functions
    const zoomIn = useCallback(() => {
        if (typeof window === 'undefined') return;

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const currentZoom = viewportRef.current.zoom;
        const newZoom = Math.min(CANVAS_CONFIG.maxZoom, currentZoom * 1.2);

        // Calculate the canvas point at screen center
        const canvasX = (centerX + viewportRef.current.x) / currentZoom;
        const canvasY = (centerY + viewportRef.current.y) / currentZoom;

        // Calculate new viewport to keep center point centered
        const targetViewport = {
            x: centerX - canvasX * newZoom,
            y: centerY - canvasY * newZoom,
            zoom: newZoom,
        };

        smoothTransitionTo(targetViewport);
    }, [smoothTransitionTo]);

    const zoomOut = useCallback(() => {
        if (typeof window === 'undefined') return;

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const currentZoom = viewportRef.current.zoom;
        const newZoom = Math.max(CANVAS_CONFIG.minZoom, currentZoom / 1.2);

        // Calculate the canvas point at screen center
        const canvasX = (centerX + viewportRef.current.x) / currentZoom;
        const canvasY = (centerY + viewportRef.current.y) / currentZoom;

        // Calculate new viewport to keep center point centered
        const targetViewport = {
            x: centerX - canvasX * newZoom,
            y: centerY - canvasY * newZoom,
            zoom: newZoom,
        };

        smoothTransitionTo(targetViewport);
    }, [smoothTransitionTo]);

    // Reset view to center
    const resetView = useCallback(() => {
        if (typeof window === 'undefined') return;
        const newViewport = {
            x: (CANVAS_CONFIG.width - window.innerWidth) / 2,
            y: (CANVAS_CONFIG.height - window.innerHeight) / 2,
            zoom: 1,
        };
        smoothTransitionTo(newViewport);
    }, [smoothTransitionTo]);

    // Ultra-smooth wheel zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Determine zoom direction and factor
            // Use smaller steps for smoother zoom
            const delta = e.deltaY;
            const zoomIntensity = 0.002; // Very small steps for ultra-smooth zoom
            const zoomFactor = Math.exp(-delta * zoomIntensity);

            const currentZoom = viewportRef.current.zoom;
            const newZoom = Math.max(
                CANVAS_CONFIG.minZoom,
                Math.min(CANVAS_CONFIG.maxZoom, currentZoom * zoomFactor)
            );

            // Calculate the canvas point under the mouse
            const canvasX = (mouseX + viewportRef.current.x) / currentZoom;
            const canvasY = (mouseY + viewportRef.current.y) / currentZoom;

            // Calculate new viewport to keep that point under the mouse
            const targetViewport = {
                x: mouseX - canvasX * newZoom,
                y: mouseY - canvasY * newZoom,
                zoom: newZoom,
            };

            // Use smooth transition for zoom
            smoothTransitionTo(targetViewport);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, [smoothTransitionTo]);

    // Update cursor when tool changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Reset cursor when tool changes (unless we're actively panning)
        if (!isPanning) {
            if (activeTool === 'hand') {
                container.style.cursor = 'grab';
            } else if (readOnly) {
                container.style.cursor = 'grab';
            } else {
                container.style.cursor = 'crosshair';
            }
        }
    }, [activeTool, isPanning, readOnly]);

    return (
        <div
            ref={containerRef}
            className={`${styles.container} ${isSpacePressed ? styles.panMode : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
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

            {/* Zoom controls */}
            <div className={styles.zoomControls}>
                <button
                    onClick={zoomOut}
                    className={styles.zoomButton}
                    title="Zoom out"
                    disabled={viewportState.zoom <= CANVAS_CONFIG.minZoom}
                >
                    −
                </button>
                <div className={styles.zoomIndicator}>
                    {Math.round(viewportState.zoom * 100)}%
                </div>
                <button
                    onClick={zoomIn}
                    className={styles.zoomButton}
                    title="Zoom in"
                    disabled={viewportState.zoom >= CANVAS_CONFIG.maxZoom}
                >
                    +
                </button>
                <button onClick={resetView} className={styles.resetButton} title="Reset zoom">
                    Reset
                </button>
            </div>


        </div>
    );
}
