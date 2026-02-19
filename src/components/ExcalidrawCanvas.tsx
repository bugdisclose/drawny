'use client';

import { useEffect, useState, useRef, useCallback, type MutableRefObject } from 'react';
import dynamic from 'next/dynamic';
import { Socket } from 'socket.io-client';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { ToolType, BrushSize, SimpleColor, ServerToClientEvents, ClientToServerEvents } from '@/types';
import { InkManager } from '@/lib/InkManager';
import { parseViewport, buildHash, type ViewportCoordinates } from '@/lib/deepLinkUtils';
import '@excalidraw/excalidraw/index.css';

import styles from './ExcalidrawCanvas.module.css';

// Dynamically import Excalidraw as it's client-side only
const Excalidraw = dynamic(
    () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
    { ssr: false }
);

/** Function type for snapshot capture, returns blob URL */
export type CaptureSnapshotFn = () => Promise<string | null>;

/** Undo/redo actions exposed via ref */
export interface HistoryActions {
    undo: () => void;
    redo: () => void;
}

// Pure function — no component state/props needed, so defined outside to avoid
// re-creation on every render and to keep it out of useCallback dependency lists.
function calculateElementLength(element: ExcalidrawElement): number {
    if (element.type === 'freedraw' || element.type === 'line' || element.type === 'arrow') {
        const points = (element as any).points || [];
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i][0] - points[i - 1][0];
            const dy = points[i][1] - points[i - 1][1];
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    } else if (element.type === 'rectangle' || element.type === 'diamond' || element.type === 'ellipse') {
        const width = element.width || 0;
        const height = element.height || 0;
        return 2 * (width + height);
    }
    return 0;
}

interface ExcalidrawCanvasProps {
    activeTool: ToolType;
    activeColor: string;
    activeSize: BrushSize;
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    inkManager: InkManager | null;
    onViewportChange?: (viewport: ViewportCoordinates) => void;
    snapshotRef?: MutableRefObject<CaptureSnapshotFn | null>;
    historyRef?: MutableRefObject<HistoryActions | null>;
}

export default function ExcalidrawCanvas({
    activeTool,
    activeColor,
    activeSize,
    socket,
    inkManager,
    onViewportChange,
    snapshotRef,
    historyRef
}: ExcalidrawCanvasProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    // Ref to access API in socket handlers without stale closures
    const excalidrawAPIRef = useRef<any>(null);
    // State for initial elements - when this changes, we remount Excalidraw
    const [initialElements, setInitialElements] = useState<ExcalidrawElement[] | null>(null);
    // Key to force remount when initial data changes
    const [excalidrawKey, setExcalidrawKey] = useState(0);

    // Keep ref in sync with state
    useEffect(() => {
        excalidrawAPIRef.current = excalidrawAPI;
    }, [excalidrawAPI]);

    // Flag to prevent infinite loops when updating from socket
    const isRemoteUpdate = useRef(false);

    // Track element versions for ink consumption
    const elementLengthMap = useRef<Map<string, number>>(new Map());

    // Track last valid scene state (before ink depletion)
    const lastValidElements = useRef<readonly ExcalidrawElement[]>([]);

    // Log when API becomes available
    useEffect(() => {
        if (excalidrawAPI) {
            console.log('[Excalidraw] API is now available');
        }
    }, [excalidrawAPI]);

    // Expose snapshot capture function via ref
    // Uses canvas.toDataURL() to capture the EXACT viewport the user sees
    useEffect(() => {
        if (!snapshotRef) return;

        snapshotRef.current = async (): Promise<string | null> => {
            try {
                const container = document.querySelector('.excalidraw');
                if (!container) {
                    console.warn('[Snapshot] Excalidraw container not found');
                    return null;
                }

                const canvases = container.querySelectorAll('canvas');
                if (canvases.length === 0) {
                    console.warn('[Snapshot] No canvas elements found');
                    return null;
                }

                // Pick the largest canvas (the main drawing canvas)
                let mainCanvas: HTMLCanvasElement | null = null;
                let maxArea = 0;
                canvases.forEach((c) => {
                    const area = c.width * c.height;
                    if (area > maxArea) {
                        maxArea = area;
                        mainCanvas = c;
                    }
                });

                if (!mainCanvas) {
                    console.warn('[Snapshot] Could not identify main canvas');
                    return null;
                }

                // Capture the exact viewport as the user sees it
                const dataUrl = (mainCanvas as HTMLCanvasElement).toDataURL('image/png');

                // Convert data URL to blob for memory-efficient blob URL
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);

                return url;
            } catch (error) {
                console.error('[Snapshot] Failed to capture viewport:', error);
                return null;
            }
        };

        return () => {
            if (snapshotRef) snapshotRef.current = null;
        };
    }, [snapshotRef, excalidrawAPI]);

    // Expose undo/redo functions via ref
    // Dispatches keyboard events to the .excalidraw container where Excalidraw listens
    useEffect(() => {
        if (!historyRef) return;

        const dispatchToExcalidraw = (shiftKey: boolean) => {
            const container = document.querySelector('.excalidraw');
            if (!container) return;
            const isMac = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
            const event = new KeyboardEvent('keydown', {
                key: 'z',
                code: 'KeyZ',
                ctrlKey: !isMac,
                metaKey: isMac,
                shiftKey,
                bubbles: true,
                cancelable: true,
            });
            container.dispatchEvent(event);
        };

        historyRef.current = {
            undo: () => dispatchToExcalidraw(false),
            redo: () => dispatchToExcalidraw(true),
        };

        return () => {
            if (historyRef) historyRef.current = null;
        };
    }, [historyRef, excalidrawAPI]);
    // Track versions of elements to avoid sending unchanged data
    const latestVersionMap = useRef<Map<string, number>>(new Map());

    // Pending sync data for race conditions
    const pendingSync = useRef<readonly ExcalidrawElement[] | null>(null);

    // Flag to prevent other effects from interfering with initial load
    const hasInitialized = useRef(false);

    // Collaborators managed via ref + rAF to avoid re-rendering the entire component
    // on every cursor:update event (which fires 30+ times/sec per remote user).
    const collaboratorsRef = useRef<Map<string, { pointer: { x: number; y: number }; username?: string; color?: string }>>(new Map());
    const collaboratorsDirtyRef = useRef(false);
    const collaboratorRafIdRef = useRef(0);

    // Flush collaborators to Excalidraw via requestAnimationFrame (batched)
    const flushCollaborators = useCallback(() => {
        if (collaboratorsDirtyRef.current) return; // already scheduled
        collaboratorsDirtyRef.current = true;
        collaboratorRafIdRef.current = requestAnimationFrame(() => {
            collaboratorsDirtyRef.current = false;
            const api = excalidrawAPIRef.current;
            if (api) {
                api.updateScene({ collaborators: new Map(collaboratorsRef.current) as any });
            }
        });
    }, []);

    // Sync collaborators when API first becomes available
    useEffect(() => {
        if (!excalidrawAPI) return;
        if (collaboratorsRef.current.size > 0) {
            excalidrawAPI.updateScene({ collaborators: new Map(collaboratorsRef.current) as any });
        }
    }, [excalidrawAPI]);

    // Clean up rAF on unmount
    useEffect(() => {
        return () => {
            cancelAnimationFrame(collaboratorRafIdRef.current);
        };
    }, []);

    // Viewport coordinates for deep linking
    const updateURLDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const onViewportChangeRef = useRef(onViewportChange);
    useEffect(() => {
        onViewportChangeRef.current = onViewportChange;
    });

    // Parse viewport coordinates from URL hash (lazy initializer runs only on client)
    const [initialViewport] = useState(() => {
        if (typeof window === 'undefined') return null;
        return parseViewport(window.location.hash);
    });

    // Update URL hash with viewport coordinates (debounced)
    const updateURLHash = useCallback((scrollX: number, scrollY: number, zoom: number) => {
        if (typeof window === 'undefined') return;

        if (updateURLDebounceRef.current) {
            clearTimeout(updateURLDebounceRef.current);
        }

        updateURLDebounceRef.current = setTimeout(() => {
            const viewport: ViewportCoordinates = { scrollX, scrollY, zoom };
            const hash = buildHash(viewport);
            window.history.replaceState(null, '', hash);
            onViewportChangeRef.current?.(viewport);
        }, 500);
    }, []);

    // Calculate stroke width based on size
    const getStrokeWidth = useCallback((size: BrushSize) => {
        switch (size) {
            case 'small': return 2;
            case 'medium': return 4;
            case 'large': return 8;
            default: return 4;
        }
    }, []);

    // Clear Excalidraw's localStorage on mount to prevent it from restoring the last tool
    useEffect(() => {
        try {
            const excalidrawKeys = Object.keys(localStorage).filter(key => key.startsWith('excalidraw'));
            excalidrawKeys.forEach(key => {
                if (key.includes('appState') || key.includes('activeTool')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('[Excalidraw] Failed to clear localStorage:', e);
        }
    }, []);

    // When initialElements changes, mark as initialized (after first remount)
    useEffect(() => {
        if (initialElements && initialElements.length > 0) {
            hasInitialized.current = true;
        }
    }, [initialElements]);

    // Sync Props to Excalidraw Config (Tools, Colors) - separate effect to avoid conflicts
    useEffect(() => {
        if (!excalidrawAPI) return;

        const strokeWidth = getStrokeWidth(activeSize);

        // Mark as remote update to prevent onChange from emitting
        isRemoteUpdate.current = true;

        // IMPORTANT: Get current elements FIRST to preserve them
        const currentElements = excalidrawAPI.getSceneElements();

        // Update styling state - MUST pass elements to preserve them
        excalidrawAPI.updateScene({
            elements: currentElements,
            appState: {
                currentItemStrokeColor: activeColor,
                currentItemStrokeWidth: strokeWidth,
                currentItemBackgroundColor: 'transparent',
                currentItemFillStyle: 'hachure',
                currentItemStrokeStyle: 'solid',
                currentItemRoughness: 1,
            }
        });

        // Reset flag on next tick
        setTimeout(() => {
            isRemoteUpdate.current = false;
        }, 0);
    }, [excalidrawAPI, activeColor, activeSize, getStrokeWidth]);

    // Separate effect to set the active tool - runs with delay to override Excalidraw's localStorage restoration
    useEffect(() => {
        if (!excalidrawAPI) return;

        const tool = activeTool === 'brush' ? 'freedraw' :
            activeTool === 'eraser' ? 'eraser' : 'selection';

        // Set immediately
        excalidrawAPI.setActiveTool({ type: tool });

        // Also set with a delay to override any localStorage restoration
        const timeoutId = setTimeout(() => {
            excalidrawAPI.setActiveTool({ type: tool });
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [excalidrawAPI, activeTool]);

    // Set initial viewport from URL hash - must be done after API is ready
    const hasSetInitialViewport = useRef(false);
    useEffect(() => {
        if (!excalidrawAPI || hasSetInitialViewport.current || !initialViewport) return;

        hasSetInitialViewport.current = true;

        setTimeout(() => {
            const currentElements = excalidrawAPI.getSceneElements();
            excalidrawAPI.updateScene({
                elements: currentElements,
                appState: {
                    scrollX: initialViewport.scrollX,
                    scrollY: initialViewport.scrollY,
                    zoom: { value: initialViewport.zoom as any }
                }
            });
        }, 100);
    }, [excalidrawAPI, initialViewport]);

    // Handle Socket Events - DO NOT depend on excalidrawAPI to avoid stale closures
    useEffect(() => {
        if (!socket) return;

        console.log('[Socket] Setting up socket listeners. Socket ID:', socket.id);

        // Initial sync handler - Use state to trigger remount with correct data
        const onSceneInit = (data: { elements: readonly ExcalidrawElement[] } | readonly ExcalidrawElement[]) => {
            let elements: readonly ExcalidrawElement[];

            if (Array.isArray(data)) {
                elements = data;
            } else if ('elements' in data) {
                elements = data.elements;
            } else {
                console.error('[Excalidraw] Invalid scene data received');
                return;
            }

            console.log('[Excalidraw] Scene init/sync received:', elements.length, 'elements');

            // Update version map for fresh sync
            latestVersionMap.current.clear();
            elementLengthMap.current.clear();
            elements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);
                const length = calculateElementLength(el);
                elementLengthMap.current.set(el.id, length);
            });

            // Set initial elements and force Excalidraw remount
            setInitialElements([...elements] as ExcalidrawElement[]);
            setExcalidrawKey(prev => prev + 1);
        };

        const onSceneUpdate = (data: { userId: string, elements: readonly ExcalidrawElement[] }) => {
            // Ignore updates from self
            if (data.userId === socket.id) return;

            const api = excalidrawAPIRef.current;
            if (api) {
                // Filter for newer elements
                const newerElements: ExcalidrawElement[] = [];
                data.elements.forEach(el => {
                    const localVer = latestVersionMap.current.get(el.id) || 0;
                    if (el.version > localVer) {
                        newerElements.push(el as ExcalidrawElement);
                    }
                });

                if (newerElements.length > 0) {
                    // Update version map and element length map BEFORE setting the flag to prevent re-emission
                    newerElements.forEach(el => {
                        latestVersionMap.current.set(el.id, el.version);
                        const length = calculateElementLength(el);
                        elementLengthMap.current.set(el.id, length);
                    });

                    isRemoteUpdate.current = true;

                    // Manual merge with current scene elements to prevent loss
                    const currentSceneElements = api.getSceneElements();
                    const mergedElementsMap = new Map<string, ExcalidrawElement>();

                    currentSceneElements.forEach((el: ExcalidrawElement) => mergedElementsMap.set(el.id, el));
                    newerElements.forEach((el: ExcalidrawElement) => mergedElementsMap.set(el.id, el));

                    api.updateScene({ elements: Array.from(mergedElementsMap.values()) });

                    // Reset flag after a very short delay
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 10);
                }
            }
        };

        socket.on('scene:init', onSceneInit);
        socket.on('scene:sync', onSceneInit);
        socket.on('scene:update', onSceneUpdate);

        // Cursor handlers — update ref directly, flush via rAF (no React state updates)
        const onCursorUpdate = (cursor: { userId: string; x: number; y: number; color: string; userName?: string }) => {
            if (cursor.userId === socket.id) return;

            collaboratorsRef.current.set(cursor.userId, {
                pointer: { x: cursor.x, y: cursor.y },
                username: cursor.userName || 'User',
                color: cursor.color
            });
            flushCollaborators();
        };

        const onCursorRemove = (userId: string) => {
            collaboratorsRef.current.delete(userId);
            flushCollaborators();
        };

        socket.on('cursor:update', onCursorUpdate);
        socket.on('cursor:remove', onCursorRemove);

        // Request initial state AFTER listeners are registered to avoid race condition
        socket.emit('scene:request-sync');

        return () => {
            socket.off('scene:init', onSceneInit);
            socket.off('scene:sync', onSceneInit);
            socket.off('scene:update', onSceneUpdate);
            socket.off('cursor:update', onCursorUpdate);
            socket.off('cursor:remove', onCursorRemove);
        };
    }, [socket, flushCollaborators]);

    // Random Name Generator
    const [userName] = useState(() => {
        const adjectives = ['Happy', 'Creative', 'Swift', 'Bold', 'Mighty', 'Jolly', 'Zany', 'Witty', 'Calm', 'Eager', 'Neon', 'Cosmic'];
        const animals = ['Panda', 'Fox', 'Tiger', 'Artist', 'Doodler', 'Scribbler', 'Painter', 'Brush', 'Pencil', 'Marker', 'Badger', 'Falcon'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = animals[Math.floor(Math.random() * animals.length)];
        return `${adj} ${noun}`;
    });

    // Handle local pointer updates — memoized to avoid giving Excalidraw a new
    // function reference on every render (which could trigger internal work).
    const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number }; button: 'down' | 'up'; pointersMap: Map<number, Readonly<{ x: number; y: number }>> }) => {
        if (!socket) return;
        socket.emit('cursor:move', {
            userId: socket.id || 'unknown',
            x: payload.pointer.x,
            y: payload.pointer.y,
            color: activeColor,
            userName: userName
        });
    }, [socket, activeColor, userName]);

    // Handle local changes — memoized and sends only changed elements (not the full scene).
    const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        if (isRemoteUpdate.current) return;
        if (!socket) return;

        // Check if user has ink before allowing new drawing elements
        if (inkManager && !inkManager.canDraw()) {
            const lastValidIds = new Set(lastValidElements.current.map(el => el.id));
            const newDrawingElements = elements.filter(el => {
                const isDrawingElement = el.type === 'freedraw' || el.type === 'line' ||
                    el.type === 'arrow' || el.type === 'rectangle' ||
                    el.type === 'diamond' || el.type === 'ellipse';
                return isDrawingElement && !lastValidIds.has(el.id);
            });

            if (newDrawingElements.length > 0 && excalidrawAPI) {
                isRemoteUpdate.current = true;
                excalidrawAPI.updateScene({
                    elements: lastValidElements.current as ExcalidrawElement[]
                });
                setTimeout(() => {
                    isRemoteUpdate.current = false;
                }, 0);
                return;
            }
        }

        // Filter elements that have changed
        const changedElements = elements.filter(el => {
            const lastVersion = latestVersionMap.current.get(el.id) || 0;
            return el.version > lastVersion;
        });

        if (changedElements.length > 0) {
            // Track ink consumption for new/modified drawing elements
            if (inkManager) {
                for (const el of changedElements) {
                    if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow' ||
                        el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse') {

                        const currentLength = calculateElementLength(el);
                        const previousLength = elementLengthMap.current.get(el.id) || 0;
                        const deltaLength = currentLength - previousLength;

                        if (deltaLength > 0) {
                            const canConsume = inkManager.consumeInk(deltaLength);

                            if (!canConsume) {
                                if (excalidrawAPI) {
                                    isRemoteUpdate.current = true;
                                    excalidrawAPI.updateScene({
                                        elements: lastValidElements.current as ExcalidrawElement[]
                                    });
                                    setTimeout(() => {
                                        isRemoteUpdate.current = false;
                                    }, 0);
                                }
                                return;
                            }

                            elementLengthMap.current.set(el.id, currentLength);
                        }
                    }
                }
            }

            // Update local version map
            changedElements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);
            });

            // Store this as the last valid state
            lastValidElements.current = elements;

            // Send only changed elements — the server does upsert, so partial
            // updates are correct. This avoids sending the entire scene (potentially
            // thousands of elements) on every mouse stroke.
            socket.emit('scene:update', changedElements);
        }
    }, [socket, inkManager, excalidrawAPI]);

    // Handle viewport changes for deep linking
    const onScrollChange = useCallback((scrollX: number, scrollY: number, zoom: { value: number }) => {
        updateURLHash(scrollX, scrollY, zoom.value);
    }, [updateURLHash]);

    return (
        <div className={styles.excalidrawWrapper}>
            <Excalidraw
                key={excalidrawKey} // Force remount when initial data changes
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={{
                    elements: initialElements || [],
                    appState: {
                        viewBackgroundColor: '#ffffff',
                        currentItemStrokeColor: activeColor,
                        currentItemStrokeWidth: getStrokeWidth(activeSize),
                    }
                }}
                onPointerUpdate={onPointerUpdate}
                onChange={onChange}
                onScrollChange={onScrollChange}
                viewModeEnabled={activeTool === 'hand'}
                zenModeEnabled={false}
                gridModeEnabled={false}
                theme="light"
                name="Drawny Canvas"
                UIOptions={{
                    canvasActions: {
                        changeViewBackgroundColor: false,
                        clearCanvas: false,
                        export: false,
                        loadScene: false,
                        saveToActiveFile: false,
                        toggleTheme: false,
                        saveAsImage: false,
                    },
                }}
            />
        </div>
    );
}
