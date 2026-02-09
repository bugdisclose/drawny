'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Socket } from 'socket.io-client';
import { ToolType, BrushSize, SimpleColor, ServerToClientEvents, ClientToServerEvents, ExcalidrawElement } from '@/types';

// These types are used by Excalidraw API but we define minimally here
type AppState = Record<string, unknown>;
type BinaryFiles = Record<string, unknown>;

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
}

export default function ExcalidrawCanvas({
    activeTool,
    activeColor,
    activeSize,
    socket
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

        // CRITICAL: Don't run this effect before initial data is loaded
        // This prevents clearing the scene before initialData is processed
        if (!hasInitialized.current && initialElements && initialElements.length > 0) {
            console.log('[Excalidraw] Skipping props sync - waiting for initialization');
            return;
        }

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

        // Update Tool - FORCE update whenever dependencies change
        // This ensures initial load gets the correct tool
        const tool = activeTool === 'brush' ? 'freedraw' :
            activeTool === 'eraser' ? 'eraser' : 'selection';

        excalidrawAPI.setActiveTool({ type: tool });

        // Reset flag on next tick
        setTimeout(() => {
            isRemoteUpdate.current = false;
        }, 0);
    }, [excalidrawAPI, activeTool, activeColor, activeSize, getStrokeWidth]);

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
            elements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);
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

                    // Update version map BEFORE setting the flag to prevent re-emission
                    newerElements.forEach(el => {
                        latestVersionMap.current.set(el.id, el.version);
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

    // Handle local changes
    const onChange = (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        // If this change was triggered by a remote update, ignore it
        if (isRemoteUpdate.current) {
            return;
        }

        if (!socket) return;

        // Filter elements that have changed
        const changedElements = elements.filter(el => {
            const lastVersion = latestVersionMap.current.get(el.id) || 0;
            return el.version > lastVersion;
        });

        if (changedElements.length > 0) {
            console.log(`[Excalidraw] Emitting ${changedElements.length} changed elements out of ${elements.length} total`);
            // Update local version map
            changedElements.forEach(el => {
                latestVersionMap.current.set(el.id, el.version);
            });

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
                    elements: (initialElements || []) as any,
                    appState: {
                        viewBackgroundColor: '#ffffff',
                        currentItemStrokeColor: activeColor,
                        currentItemStrokeWidth: getStrokeWidth(activeSize),
                    }
                }}
                onPointerUpdate={onPointerUpdate}
                onChange={onChange as any}
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
