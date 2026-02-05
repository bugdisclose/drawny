import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Stroke, ServerToClientEvents, ClientToServerEvents, CursorData } from '../types';
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
        socket.emit('canvas:state', strokeStorage.getCanvasInfo());

        // Handle canvas sync request
        socket.on('canvas:request-sync', () => {
            console.log('[SocketServer] Canvas sync requested by:', socket.id);
            const strokes = strokeStorage.getAllStrokes();
            socket.emit('canvas:sync', strokes);
            socket.emit('canvas:state', strokeStorage.getCanvasInfo());
        });

        // Handle new stroke
        socket.on('stroke:start', (stroke: Stroke) => {
            console.log('[SocketServer] Stroke started:', stroke.id);
            strokeStorage.addStroke(stroke);
            socket.broadcast.emit('stroke:new', stroke);
        });

        // Handle stroke update
        socket.on('stroke:update', (stroke: Stroke) => {
            strokeStorage.addStroke(stroke);
            socket.broadcast.emit('stroke:update', stroke);
        });

        // Handle stroke end
        socket.on('stroke:end', (stroke: Stroke) => {
            console.log('[SocketServer] Stroke ended:', stroke.id);
            strokeStorage.addStroke(stroke);
            socket.broadcast.emit('stroke:new', stroke);
        });

        // Handle stroke deletion (for undo)
        socket.on('stroke:delete', (strokeId: string, userId: string) => {
            const stroke = strokeStorage.getStroke(strokeId);
            // Only allow users to delete their own strokes
            if (stroke && stroke.userId === userId) {
                strokeStorage.deleteStroke(strokeId);
                io?.emit('stroke:delete', strokeId);
                console.log('[SocketServer] Stroke deleted:', strokeId, 'by user:', userId);
            } else {
                console.log('[SocketServer] Unauthorized stroke deletion attempt:', strokeId, 'by user:', userId);
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

function broadcastUsersCount(): void {
    if (io) {
        const count = io.sockets.sockets.size;
        io.emit('users:count', count);
        console.log('[SocketServer] Broadcasting users count:', count);
    }
}

export function resetCanvas(): void {
    if (io) {
        strokeStorage.reset();
        io.emit('canvas:reset');
        // Immediately broadcast the new canvas state with updated start time
        const canvasInfo = strokeStorage.getCanvasInfo();
        io.emit('canvas:state', canvasInfo);
        console.log('[SocketServer] Canvas reset broadcast with new state:', canvasInfo);
    }
}

// Check for canvas reset every minute and broadcast state every 10 seconds
function setupResetScheduler(): void {
    // Check for reset every minute
    setInterval(() => {
        if (strokeStorage.shouldReset()) {
            console.log('[SocketServer] Canvas reset triggered by scheduler');
            resetCanvas();
        }
    }, 60 * 1000); // Check every minute

    // Broadcast canvas state to all clients every 10 seconds
    setInterval(() => {
        if (io) {
            const canvasInfo = strokeStorage.getCanvasInfo();
            io.emit('canvas:state', canvasInfo);
        }
    }, 10 * 1000); // Broadcast every 10 seconds

    console.log('[SocketServer] Reset scheduler and state broadcaster initialized');
}

export function getSocketServer(): SocketIOServer | null {
    return io;
}

export function getCanvasInfo() {
    return strokeStorage.getCanvasInfo();
}
