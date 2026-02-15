'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Socket } from 'socket.io-client';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { ToolType, BrushSize, SimpleColor, ServerToClientEvents, ClientToServerEvents } from '@/types';
import { InkManager } from '@/lib/InkManager';
import '@excalidraw/excalidraw/index.css';

import styles from './ExcalidrawCanvas.module.css';

// Dynamically import Excalidraw as it's client-side only
const Excalidraw = dynamic(
    () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
    { ssr: false }
);

interface ExcalidrawCanvasProps {
    activeTool: ToolType;
    activeColor: string;
    activeSize: BrushSize;
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    inkManager: InkManager | null;
}

export default function ExcalidrawCanvas({
    activeTool,
    activeColor,
    activeSize,
    socket,
    inkManager
}: ExcalidrawCanvasProps) {
    console.log('[ExcalidrawCanvas] 🎨 Component rendering/mounting');

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

    // Log component mount
    useEffect(() => {
        console.log('[ExcalidrawCanvas] 🚀 Component MOUNTED');
        return () => {
            console.log('[ExcalidrawCanvas] 💀 Component UNMOUNTING');
        };
    }, []);

    // Log when API becomes available
    useEffect(() => {
        if (excalidrawAPI) {
            console.log('[Excalidraw] ✅ API is now available!');
            const currentElements = excalidrawAPI.getSceneElements();
            console.log('[Excalidraw] Current scene has', currentElements.length, 'elements');
            console.log('[Excalidraw] Pending sync has', pendingSync.current ? pendingSync.current.length : 0, 'elements');
        } else {
            console.log('[Excalidraw] ⏳ API is NOT available yet');
        }
    }, [excalidrawAPI]);

    // Track versions of elements to avoid sending unchanged data
    const latestVersionMap = useRef<Map<string, number>>(new Map());

    // Pending sync data for race conditions
    const pendingSync = useRef<readonly ExcalidrawElement[] | null>(null);

    // Flag to prevent other effects from interfering with initial load
    const hasInitialized = useRef(false);

    // Collaborators state
    const [collaborators, setCollaborators] = useState<Map<string, { pointer: { x: number; y: number }; username?: string; color?: string }>>(new Map());

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
        // Clear the activeTool from Excalidraw's localStorage
        try {
            const excalidrawKeys = Object.keys(localStorage).filter(key => key.startsWith('excalidraw'));
            excalidrawKeys.forEach(key => {
                if (key.includes('appState') || key.includes('activeTool')) {
                    console.log('[Excalidraw] Clearing localStorage key:', key);
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('[Excalidraw] Failed to clear localStorage:', e);
        }
    }, []); // Run only once on mount

    // When initialElements changes, mark as initialized (after first remount)
    useEffect(() => {
        if (initialElements && initialElements.length > 0) {
            console.log('[Excalidraw] Initial elements loaded:', initialElements.length);
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
        console.log('[Excalidraw] Syncing props - preserving', currentElements.length, 'elements');

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

        console.log('[Excalidraw] Setting active tool to:', tool, '(from activeTool:', activeTool + ')');

        // Set immediately
        excalidrawAPI.setActiveTool({ type: tool });

        // Also set with a delay to override any localStorage restoration
        const timeoutId = setTimeout(() => {
            console.log('[Excalidraw] Re-setting active tool after delay to:', tool);
            excalidrawAPI.setActiveTool({ type: tool });
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [excalidrawAPI, activeTool]);

    // Handle Socket Events - DO NOT depend on excalidrawAPI to avoid stale closures
    useEffect(() => {
        if (!socket) return;

        console.log('[Socket] 🔌 Setting up socket listeners. Socket ID:', socket.id);

        // Initial sync handler - Use state to trigger remount with correct data
        const onSceneInit = (data: { elements: readonly ExcalidrawElement[] } | readonly ExcalidrawElement[]) => {
            console.log('[Excalidraw] 📥 scene:init received! Timestamp:', new Date().toISOString());
            let elements: readonly ExcalidrawElement[];

            if (Array.isArray(data)) {
                elements = data;
            } else if ('elements' in data) {
                elements = data.elements;
            } else {
                console.error('[Excalidraw] Invalid scene data received:', data);
                return;
            }

            console.log('[Excalidraw] Scene init/sync received:', elements.length, 'elements');
            if (elements.length > 0) {
                const visibleElements = elements.filter(e => !e.isDeleted);
                const visibleCount = visibleElements.length;
                console.log('[Excalidraw] Visible elements:', visibleCount, '/', elements.length);
                if (visibleCount > 0) {
                    const first = visibleElements[0];
                    console.log('[Excalidraw] First VISIBLE element at:', first.x, first.y, 'type:', first.type);
                }
            }

            // Update version map for fresh sync
            latestVersionMap.current.clear();
            elementLengthMap.current.clear();
            elements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);

                // Initialize element length map to prevent consuming ink for existing elements
                const length = calculateElementLength(el);
                elementLengthMap.current.set(el.id, length);
            });

            // Set initial elements and force Excalidraw remount
            console.log('[Excalidraw] Setting initialElements and forcing remount');
            setInitialElements([...elements] as ExcalidrawElement[]);
            setExcalidrawKey(prev => prev + 1);
        };

        const onSceneUpdate = (data: { userId: string, elements: readonly ExcalidrawElement[] }) => {
            // Ignore updates from self
            if (data.userId === socket.id) return;

            const api = excalidrawAPIRef.current;
            if (api) {
                // First, filter for newer elements (don't update version map yet)
                const newerElements: ExcalidrawElement[] = [];
                data.elements.forEach(el => {
                    const localVer = latestVersionMap.current.get(el.id) || 0;
                    if (el.version > localVer) {
                        newerElements.push(el as ExcalidrawElement);
                    }
                });

                if (newerElements.length > 0) {
                    console.log('[Excalidraw] Live update:', newerElements.length, 'new/updated elements from', data.userId);

                    // Update version map and element length map BEFORE setting the flag to prevent re-emission
                    newerElements.forEach(el => {
                        latestVersionMap.current.set(el.id, el.version);
                        // Update element length to prevent consuming ink for remote changes
                        const length = calculateElementLength(el);
                        elementLengthMap.current.set(el.id, length);
                    });

                    isRemoteUpdate.current = true;

                    // Manual merge with current scene elements to prevent loss
                    const currentSceneElements = api.getSceneElements();
                    const mergedElementsMap = new Map<string, ExcalidrawElement>();

                    // Add current elements
                    currentSceneElements.forEach((el: ExcalidrawElement) => mergedElementsMap.set(el.id, el));

                    // Update with newer elements
                    newerElements.forEach((el: ExcalidrawElement) => mergedElementsMap.set(el.id, el));

                    api.updateScene({ elements: Array.from(mergedElementsMap.values()) });

                    // Reset flag after a very short delay - just enough to skip the immediate onChange
                    // but not so long that it blocks legitimate user drawing
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 10);
                }
            } else {
                console.log('[Excalidraw] Live update received but API not ready, ignoring');
            }
        };

        console.log('[Socket] 🔌 Setting up socket listeners');
        console.log('[Socket] Socket ID:', socket.id);
        console.log('[Socket] excalidrawAPI available?', !!excalidrawAPI);

        socket.on('scene:init', onSceneInit);
        socket.on('scene:sync', onSceneInit); // Handle sync response same as init
        socket.on('scene:update', onSceneUpdate);

        // Cursor handlers
        const onCursorUpdate = (cursor: { userId: string; x: number; y: number; color: string; userName?: string }) => {
            // skip own cursor if it comes back
            if (cursor.userId === socket.id) return;

            setCollaborators(prev => {
                const next = new Map(prev);
                next.set(cursor.userId, {
                    pointer: { x: cursor.x, y: cursor.y },
                    username: cursor.userName || 'User',
                    color: cursor.color
                });
                return next;
            });
        };

        const onCursorRemove = (userId: string) => {
            setCollaborators(prev => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
            });
        };

        socket.on('cursor:update', onCursorUpdate);
        socket.on('cursor:remove', onCursorRemove);

        console.log('[Socket] ✅ All socket listeners registered');

        // Request initial state AFTER listeners are registered to avoid race condition
        console.log('[Socket] 📤 Requesting scene sync from server');
        socket.emit('scene:request-sync');

        return () => {
            console.log('[Socket] 🔌 Cleaning up socket listeners');
            socket.off('scene:init', onSceneInit);
            socket.off('scene:sync', onSceneInit);
            socket.off('scene:update', onSceneUpdate);
            socket.off('cursor:update', onCursorUpdate);
            socket.off('cursor:remove', onCursorRemove);
        };
    }, [socket]); // Removed excalidrawAPI dependency to avoid re-registering listeners

    // Random Name Generator
    const [userName] = useState(() => {
        const adjectives = ['Happy', 'Creative', 'Swift', 'Bold', 'Mighty', 'Jolly', 'Zany', 'Witty', 'Calm', 'Eager', 'Neon', 'Cosmic'];
        const animals = ['Panda', 'Fox', 'Tiger', 'Artist', 'Doodler', 'Scribbler', 'Painter', 'Brush', 'Pencil', 'Marker', 'Badger', 'Falcon'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = animals[Math.floor(Math.random() * animals.length)];
        return `${adj} ${noun}`;
    });

    // Handle local pointer updates
    const onPointerUpdate = (payload: { pointer: { x: number; y: number }; button: 'down' | 'up'; pointersMap: Map<number, Readonly<{ x: number; y: number }>> }) => {
        if (!socket) return;
        socket.emit('cursor:move', {
            userId: socket.id || 'unknown',
            x: payload.pointer.x,
            y: payload.pointer.y,
            color: activeColor,
            userName: userName
        });
    };

    // Calculate approximate length of an element for ink consumption
    const calculateElementLength = (element: ExcalidrawElement): number => {
        if (element.type === 'freedraw') {
            // For freedraw, calculate total path length
            const points = (element as any).points || [];
            let length = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i][0] - points[i - 1][0];
                const dy = points[i][1] - points[i - 1][1];
                length += Math.sqrt(dx * dx + dy * dy);
            }
            return length;
        } else if (element.type === 'line' || element.type === 'arrow') {
            // For lines/arrows, calculate distance between points
            const points = (element as any).points || [];
            let length = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i][0] - points[i - 1][0];
                const dy = points[i][1] - points[i - 1][1];
                length += Math.sqrt(dx * dx + dy * dy);
            }
            return length;
        } else if (element.type === 'rectangle' || element.type === 'diamond' || element.type === 'ellipse') {
            // For shapes, use perimeter approximation
            const width = element.width || 0;
            const height = element.height || 0;
            return 2 * (width + height);
        }
        return 0;
    };

    // Handle local changes
    const onChange = (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        // If this change was triggered by a remote update, ignore it
        if (isRemoteUpdate.current) {
            return;
        }

        if (!socket) return;

        // Check if user has ink before allowing new drawing elements
        if (inkManager && !inkManager.canDraw()) {
            // Find new drawing elements (not in lastValidElements)
            const lastValidIds = new Set(lastValidElements.current.map(el => el.id));
            const newDrawingElements = elements.filter(el => {
                const isDrawingElement = el.type === 'freedraw' || el.type === 'line' ||
                    el.type === 'arrow' || el.type === 'rectangle' ||
                    el.type === 'diamond' || el.type === 'ellipse';
                return isDrawingElement && !lastValidIds.has(el.id);
            });

            // If there are new drawing elements and no ink, revert the scene
            if (newDrawingElements.length > 0 && excalidrawAPI) {
                console.log('[Excalidraw] ❌ Out of ink! Preventing new drawing elements.');
                isRemoteUpdate.current = true;
                excalidrawAPI.updateScene({
                    elements: lastValidElements.current as ExcalidrawElement[]
                });
                setTimeout(() => {
                    isRemoteUpdate.current = false;
                }, 0);
                return; // Don't process this change
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
                    // Only consume ink for drawing tools (not selection, text, etc.)
                    if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow' ||
                        el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse') {

                        const currentLength = calculateElementLength(el);
                        const previousLength = elementLengthMap.current.get(el.id) || 0;
                        const deltaLength = currentLength - previousLength;

                        if (deltaLength > 0) {
                            const canConsume = inkManager.consumeInk(deltaLength);

                            if (!canConsume) {
                                // Out of ink during drawing - revert to last valid state
                                console.log('[Excalidraw] ❌ Ran out of ink during drawing! Reverting.');
                                if (excalidrawAPI) {
                                    isRemoteUpdate.current = true;
                                    excalidrawAPI.updateScene({
                                        elements: lastValidElements.current as ExcalidrawElement[]
                                    });
                                    setTimeout(() => {
                                        isRemoteUpdate.current = false;
                                    }, 0);
                                }
                                return; // Don't process this change
                            }

                            // Update tracked length
                            elementLengthMap.current.set(el.id, currentLength);
                        }
                    }
                }
            }

            console.log(`[Excalidraw] Emitting ${changedElements.length} changed elements out of ${elements.length} total`);
            // Update local version map
            changedElements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);
            });

            // Store this as the last valid state (only if we successfully consumed ink or no ink was needed)
            lastValidElements.current = elements;

            // IMPORTANT: Send ALL elements, not just changed ones
            // This ensures the server has the complete state including deletions
            socket.emit('scene:update', elements);
        }
    };

    // Sync collaborators to Excalidraw
    useEffect(() => {
        if (!excalidrawAPI) return;
        excalidrawAPI.updateScene({ collaborators: collaborators as any });
    }, [excalidrawAPI, collaborators]);

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
                viewModeEnabled={activeTool === 'hand'}
                zenModeEnabled={false} // We handle UI hiding via CSS
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
