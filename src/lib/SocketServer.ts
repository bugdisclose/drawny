import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ServerToClientEvents, ClientToServerEvents, CursorData } from '../types';
import { strokeStorage } from './StrokeStorage';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

// Track user cursors
const userCursors = new Map<string, { cursor: CursorData; socketId: string }>();

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
    if (io) {
        console.log('[SocketServer] Already initialized');
        return io;
    }

    io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    attachSocketHandlers(io);
    return io;
}

export function attachSocketHandlers(serverIo: SocketIOServer) {
    io = serverIo;
    console.log('[SocketServer] Attaching socket handlers');

    io.on('connection', (socket) => {
        console.log('[SocketServer] Client connected:', socket.id);
        broadcastUsersCount();

        // Send initial canvas state immediately on connection
        const canvasState = strokeStorage.getCanvasState();
        const visibleElements = canvasState.elements.filter(e => !e.isDeleted);
        console.log('[SocketServer] Sending scene:init with', canvasState.elements.length, 'elements to', socket.id);
        console.log('[SocketServer] Visible elements:', visibleElements.length, 'Deleted:', canvasState.elements.length - visibleElements.length);
        if (canvasState.elements.length > 0) {
            console.log('[SocketServer] First element:', canvasState.elements[0].type, 'isDeleted:', canvasState.elements[0].isDeleted);
        }
        socket.emit('scene:init', {
            elements: canvasState.elements,
            startTime: canvasState.startTime
        });

        // Handle canvas sync request (full sync)
        socket.on('scene:request-sync', () => {
            console.log('[SocketServer] Canvas sync requested by:', socket.id);
            const elements = strokeStorage.getAllElements();
            socket.emit('scene:sync', elements);
        });

        // Handle scene updates (incremental or batch)
        socket.on('scene:update', (elements) => {
            if (elements && Array.isArray(elements)) {
                console.log('[SocketServer] Received scene:update from', socket.id, 'with', elements.length, 'elements');
                // Update storage
                strokeStorage.updateElements(elements);
                console.log('[SocketServer] Storage now has', strokeStorage.getAllElements().length, 'total elements');

                // Broadcast to other clients (exclude sender)
                socket.broadcast.emit('scene:update', {
                    userId: socket.id,
                    elements: elements
                });
            }
        });

        // Handle cursor movement
        socket.on('cursor:move', (cursor: CursorData) => {
            userCursors.set(cursor.userId, { cursor, socketId: socket.id });
            socket.broadcast.emit('cursor:update', cursor);
        });

        socket.on('disconnect', () => {
            console.log('[SocketServer] Client disconnected:', socket.id);

            // Find and remove user's cursor
            for (const [userId, data] of userCursors) {
                if (data.socketId === socket.id) {
                    userCursors.delete(userId);
                    io?.emit('cursor:remove', userId);
                    break;
                }
            }

            broadcastUsersCount();
        });
    });

    // Set up canvas reset scheduler
    setupResetScheduler();

    console.log('[SocketServer] Handlers attached successfully');
}

function broadcastUsersCount() {
    if (io) {
        const count = io.engine.clientsCount;
        io.emit('users:count', count);
        console.log('[SocketServer] Broadcasting users count:', count);
    }
}

export async function resetCanvas(): Promise<void> {
    if (io) {
        await strokeStorage.reset();
        // We reuse scene:init logic or add specific reset event
        // But for compatibility let's just send empty sync + init
        const canvasState = strokeStorage.getCanvasState();
        io.emit('scene:init', {
            elements: canvasState.elements,
            startTime: canvasState.startTime
        });
        console.log('[SocketServer] Canvas reset broadcast');
    }
}

// Check for canvas reset and broadcast state
function setupResetScheduler(): void {
    // Check for reset every minute
    setInterval(() => {
        if (strokeStorage.shouldReset()) {
            console.log('[SocketServer] Canvas reset triggered by scheduler');
            resetCanvas().catch(err => console.error('[SocketServer] Error in scheduled reset:', err));
        }
    }, 60 * 1000); // Check every minute

    // We don't perform periodic broadcast for Excalidraw as it relies on event sourcing
    // But we could strictly sync clock
}

export function getSocketServer(): SocketIOServer | null {
    return io;
}

export function getCanvasInfo() {
    return strokeStorage.getCanvasInfo();
}
