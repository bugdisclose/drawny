'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, ExcalidrawElement, SceneUpdate, SceneInitData, CursorData } from '@/types';

interface Cursor {
    id: string;
    x: number;
    y: number;
    color: string;
    lastUpdate: number;
    userName?: string;
}

interface UseSocketOptions {
    onSceneInit?: (data: SceneInitData) => void;
    onSceneUpdate?: (data: SceneUpdate) => void;
    onSceneSync?: (elements: readonly ExcalidrawElement[]) => void;
    onUsersCountChange?: (count: number) => void;
    onCursorUpdate?: (cursor: Cursor) => void;
    onCursorRemove?: (userId: string) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [usersCount, setUsersCount] = useState(1);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const connectionAttempted = useRef(false);

    const {
        onSceneInit,
        onSceneUpdate,
        onSceneSync,
        onUsersCountChange,
        onCursorUpdate,
        onCursorRemove
    } = options;

    useEffect(() => {
        if (connectionAttempted.current) return;
        connectionAttempted.current = true;

        console.log('[useSocket] Attempting socket connection...');

        try {
            const socketIo: Socket<ServerToClientEvents, ClientToServerEvents> = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000,
                autoConnect: true,
            });

            socketRef.current = socketIo;
            setSocket(socketIo);

            socketIo.on('connect', () => {
                console.log('[useSocket] Connected to server');
                setIsConnected(true);
                setIsOfflineMode(false);
                socketIo.emit('scene:request-sync');
            });

            socketIo.on('disconnect', () => {
                console.log('[useSocket] Disconnected from server');
                setIsConnected(false);
                // Don't switch to offline mode immediately on disconnect, wait for timeout or error
            });

            socketIo.on('connect_error', (error) => {
                console.log('[useSocket] Connection error:', error.message);
                // If we never connected, maybe switch to offline
                if (!socketRef.current?.connected) {
                    setIsOfflineMode(true);
                }
            });

            socketIo.on('scene:init', (data) => {
                onSceneInit?.(data);
            });

            socketIo.on('scene:update', (data) => {
                onSceneUpdate?.(data);
            });

            socketIo.on('scene:sync', (elements) => {
                onSceneSync?.(elements);
            });

            socketIo.on('users:count', (count) => {
                setUsersCount(count);
                onUsersCountChange?.(count);
            });

            socketIo.on('cursor:update', (cursor: CursorData) => {
                onCursorUpdate?.({
                    id: cursor.userId,
                    x: cursor.x,
                    y: cursor.y,
                    color: cursor.color,
                    lastUpdate: Date.now(),
                    userName: cursor.userName
                });
            });

            socketIo.on('cursor:remove', (userId: string) => {
                onCursorRemove?.(userId);
            });

            return () => {
                socketIo.disconnect();
            };
        } catch (error) {
            console.log('[useSocket] Failed to initialize socket', error);
            setIsOfflineMode(true);
        }
    }, [onSceneInit, onSceneUpdate, onSceneSync, onUsersCountChange, onCursorUpdate, onCursorRemove]);

    const sendSceneUpdate = useCallback((elements: readonly ExcalidrawElement[]) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('scene:update', elements);
        }
    }, []);

    const sendCursorMove = useCallback((cursor: CursorData) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('cursor:move', cursor);
        }
    }, []);

    const requestSync = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('scene:request-sync');
        }
    }, []);

    const reconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.connect();
        }
    }, []);

    return {
        socket,
        isConnected,
        isOfflineMode,
        usersCount,
        sendSceneUpdate,
        sendCursorMove,
        requestSync,
        reconnect,
    };
}
