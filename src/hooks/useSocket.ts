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
    const [artistCount, setArtistCount] = useState(0);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);

    // Use refs for callbacks to avoid stale closures and prevent
    // the effect from re-running (which would disconnect/reconnect the socket)
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    });

    useEffect(() => {
        console.log('[useSocket] Attempting socket connection...');

        let fallbackTimer: NodeJS.Timeout | undefined;

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
                setIsConnecting(false);
                setIsOfflineMode(false);
                // Note: scene:request-sync is handled by ExcalidrawCanvas
                // when it registers its listeners. The server also auto-sends
                // scene:init on connection, which we catch below for metadata.
            });

            socketIo.on('disconnect', () => {
                console.log('[useSocket] Disconnected from server');
                setIsConnected(false);
                setIsConnecting(false);
            });

            socketIo.on('connect_error', (error) => {
                console.log('[useSocket] Connection error:', error.message);
                setIsConnecting(false);
                if (!socketRef.current?.connected) {
                    setIsOfflineMode(true);
                }
            });

            // Fallback timeout to stop showing connecting state if nothing happens
            fallbackTimer = setTimeout(() => {
                setIsConnecting(false);
            }, 5000);

            socketIo.on('scene:init', (data) => {
                optionsRef.current.onSceneInit?.(data);
                if (typeof data.artistCount === 'number') {
                    setArtistCount(data.artistCount);
                }
            });

            socketIo.on('scene:update', (data) => {
                optionsRef.current.onSceneUpdate?.(data);
            });

            socketIo.on('scene:sync', (elements) => {
                optionsRef.current.onSceneSync?.(elements);
            });

            socketIo.on('users:count', (count) => {
                setUsersCount(count);
                optionsRef.current.onUsersCountChange?.(count);
            });

            socketIo.on('artists:count', (count) => {
                setArtistCount(count);
            });

            socketIo.on('cursor:update', (cursor: CursorData) => {
                optionsRef.current.onCursorUpdate?.({
                    id: cursor.userId,
                    x: cursor.x,
                    y: cursor.y,
                    color: cursor.color,
                    lastUpdate: Date.now(),
                    userName: cursor.userName
                });
            });

            socketIo.on('cursor:remove', (userId: string) => {
                optionsRef.current.onCursorRemove?.(userId);
            });

            return () => {
                clearTimeout(fallbackTimer);
                socketIo.disconnect();
            };
        } catch (error) {
            console.log('[useSocket] Failed to initialize socket', error);
            setIsConnecting(false);
            setIsOfflineMode(true);
            return () => {
                clearTimeout(fallbackTimer);
            };
        }
    }, []);

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
        setIsConnecting(true);
        if (socketRef.current) {
            socketRef.current.connect();
        }
    }, []);

    return {
        socket,
        isConnected,
        isConnecting,
        isOfflineMode,
        usersCount,
        artistCount,
        sendSceneUpdate,
        sendCursorMove,
        requestSync,
        reconnect,
    };
}
