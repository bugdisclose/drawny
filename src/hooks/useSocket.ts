'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Stroke, ServerToClientEvents, ClientToServerEvents, CursorData } from '@/types';

interface Cursor {
    id: string;
    x: number;
    y: number;
    color: string;
    lastUpdate: number;
}

interface UseSocketOptions {
    onStrokeReceived?: (stroke: Stroke) => void;
    onStrokeDeleted?: (strokeId: string) => void;
    onCanvasSync?: (strokes: Stroke[]) => void;
    onCanvasState?: (state: { startTime: number; strokeCount: number; timeUntilReset: number }) => void;
    onCanvasReset?: () => void;
    onUsersCountChange?: (count: number) => void;
    onCursorUpdate?: (cursor: Cursor) => void;
    onCursorRemove?: (userId: string) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [isConnected, setIsConnected] = useState(true); // Default to true for offline-first
    const [usersCount, setUsersCount] = useState(1); // At least the current user
    const [isOfflineMode, setIsOfflineMode] = useState(true); // Start in offline mode
    const connectionAttempted = useRef(false);

    const {
        onStrokeReceived,
        onStrokeDeleted,
        onCanvasSync,
        onCanvasState,
        onCanvasReset,
        onUsersCountChange,
        onCursorUpdate,
        onCursorRemove
    } = options;

    useEffect(() => {
        // Only attempt connection once
        if (connectionAttempted.current) return;
        connectionAttempted.current = true;

        console.log('[useSocket] Attempting socket connection...');

        try {
            const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000,
                autoConnect: true,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('[useSocket] Connected to server');
                setIsConnected(true);
                setIsOfflineMode(false);
                socket.emit('canvas:request-sync');
            });

            socket.on('disconnect', () => {
                console.log('[useSocket] Disconnected from server');
                // Don't show as disconnected, just switch to offline mode
                setIsOfflineMode(true);
            });

            socket.on('connect_error', (error) => {
                console.log('[useSocket] Connection error (switching to offline mode):', error.message);
                setIsOfflineMode(true);
                setIsConnected(true); // Keep showing as "connected" in offline mode
            });

            socket.on('stroke:new', (stroke) => {
                onStrokeReceived?.(stroke);
            });

            socket.on('stroke:update', (stroke) => {
                onStrokeReceived?.(stroke);
            });

            socket.on('stroke:delete', (strokeId) => {
                console.log('[useSocket] Stroke deleted:', strokeId);
                onStrokeDeleted?.(strokeId);
            });

            socket.on('canvas:sync', (strokes) => {
                console.log('[useSocket] Canvas sync received:', strokes.length, 'strokes');
                onCanvasSync?.(strokes);
            });

            socket.on('canvas:state', (state) => {
                onCanvasState?.(state);
            });

            socket.on('canvas:reset', () => {
                console.log('[useSocket] Canvas reset received');
                onCanvasReset?.();
            });

            socket.on('users:count', (count) => {
                setUsersCount(count);
                onUsersCountChange?.(count);
            });

            socket.on('cursor:update', (cursor: CursorData) => {
                onCursorUpdate?.({
                    id: cursor.userId,
                    x: cursor.x,
                    y: cursor.y,
                    color: cursor.color,
                    lastUpdate: Date.now(),
                });
            });

            socket.on('cursor:remove', (userId: string) => {
                onCursorRemove?.(userId);
            });

            // Set a timeout to switch to offline mode if connection doesn't happen
            const timeout = setTimeout(() => {
                if (!socket.connected) {
                    console.log('[useSocket] Connection timeout, switching to offline mode');
                    setIsOfflineMode(true);
                    setIsConnected(true);
                }
            }, 3000);

            return () => {
                clearTimeout(timeout);
                socket.disconnect();
            };
        } catch (error) {
            console.log('[useSocket] Failed to initialize socket, using offline mode');
            setIsOfflineMode(true);
            setIsConnected(true);
        }
    }, [onStrokeReceived, onStrokeDeleted, onCanvasSync, onCanvasState, onCanvasReset, onUsersCountChange, onCursorUpdate, onCursorRemove]);

    const sendStrokeStart = useCallback((stroke: Stroke) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stroke:start', stroke);
        }
        // Drawing still works locally even if not connected
    }, []);

    const sendStrokeUpdate = useCallback((stroke: Stroke) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stroke:update', stroke);
        }
    }, []);

    const sendStrokeEnd = useCallback((stroke: Stroke) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stroke:end', stroke);
        }
    }, []);

    const sendCursorMove = useCallback((cursor: CursorData) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('cursor:move', cursor);
        }
    }, []);

    const sendStrokeDelete = useCallback((strokeId: string, userId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stroke:delete', strokeId, userId);
        }
    }, []);

    const requestSync = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('canvas:request-sync');
        }
    }, []);

    const reconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.connect();
        }
    }, []);

    return {
        isConnected,
        isOfflineMode,
        usersCount,
        sendStrokeStart,
        sendStrokeUpdate,
        sendStrokeEnd,
        sendStrokeDelete,
        sendCursorMove,
        requestSync,
        reconnect,
    };
}
