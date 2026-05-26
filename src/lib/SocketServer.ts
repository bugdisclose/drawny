import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ServerToClientEvents, ClientToServerEvents, CursorData } from '../types';
import { strokeStorage } from './StrokeStorage';
import { chatStorage } from './ChatStorage';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

// Track user cursors
const userCursors = new Map<string, { cursor: CursorData; socketId: string }>();

// Track last chat message timestamp for rate limiting
const chatRateLimits = new Map<string, number>();

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
            startTime: canvasState.startTime,
            artistCount: canvasState.artistCount
        });

        // Send initial chat history immediately on connection
        socket.emit('chat:history', {
            messages: chatStorage.getMessages(),
            startTime: chatStorage.getStartTime()
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
                // Update storage
                strokeStorage.updateElements(elements);

                // Track unique artist — only broadcast when it's a NEW session
                const isNewArtist = strokeStorage.markSessionAsDrawn(socket.id);
                if (isNewArtist) {
                    broadcastArtistsCount();
                }

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

        // Handle chat messages
        socket.on('chat:message', async (data) => {
            if (!data || typeof data.message !== 'string' || typeof data.username !== 'string') return;

            // 1. Rate Limiting Check (Max 1 message per 1.5 seconds)
            const now = Date.now();
            const lastMsgTime = chatRateLimits.get(socket.id) || 0;
            if (now - lastMsgTime < 1500) {
                // Send warning only to the spamming client
                socket.emit('chat:message', {
                    id: `system-warning-${now}`,
                    username: 'System',
                    message: 'You are sending messages too fast. Please wait a moment.',
                    timestamp: now
                });
                return;
            }
            chatRateLimits.set(socket.id, now);

            const cleanMessage = data.message.trim();
            let cleanUsername = data.username.trim() || 'Anonymous';

            // 2. Prevent System identity spoofing
            if (cleanUsername.toLowerCase() === 'system' || cleanUsername.toLowerCase().startsWith('system-')) {
                cleanUsername = 'System Spoof';
            }

            if (cleanMessage.length === 0 || cleanMessage.length > 500) return;

            const savedMsg = await chatStorage.addMessage(cleanUsername, cleanMessage);
            io?.emit('chat:message', savedMsg);
        });

        // Handle chat history request (resolves listener race condition)
        socket.on('chat:request-history', () => {
            console.log('[SocketServer] Chat history explicitly requested by:', socket.id);
            socket.emit('chat:history', {
                messages: chatStorage.getMessages(),
                startTime: chatStorage.getStartTime()
            });
        });

        socket.on('disconnect', () => {
            console.log('[SocketServer] Client disconnected:', socket.id);

            // Clean up chat rate limits
            chatRateLimits.delete(socket.id);

            // Remove all cursor entries belonging to this socket
            for (const [userId, data] of userCursors) {
                if (data.socketId === socket.id) {
                    userCursors.delete(userId);
                    io?.emit('cursor:remove', userId);
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

function broadcastArtistsCount() {
    if (io) {
        const count = strokeStorage.getUniqueArtistCount();
        io.emit('artists:count', count);
        console.log('[SocketServer] Broadcasting unique artists count:', count);
    }
}

export async function resetCanvas(): Promise<any> {
    // Always attempt to reset storage (archive + clear)
    // This allows API routes to trigger archival even if they don't have access to the 'io' instance
    // (which might happen due to module isolation in Next.js)
    console.log('[SocketServer] resetCanvas triggered. IO available:', !!io);

    let result;
    try {
        result = await strokeStorage.reset();
    } catch (err) {
        console.error('[SocketServer] Error resetting storage:', err);
        return { success: false, reason: `Storage reset failed: ${err}` };
    }

    if (io) {
        // We reuse scene:init logic or add specific reset event
        // But for compatibility let's just send empty sync + init
        const canvasState = strokeStorage.getCanvasState();
        io.emit('scene:init', {
            elements: canvasState.elements,
            startTime: canvasState.startTime,
            artistCount: canvasState.artistCount
        });
        console.log('[SocketServer] Canvas reset broadcast to clients');
    } else {
        console.warn('[SocketServer] IO not available, skipping broadcast');
    }

    return result;
}

export async function resetChat(): Promise<any> {
    console.log('[SocketServer] resetChat triggered. IO available:', !!io);

    try {
        await chatStorage.reset();
    } catch (err) {
        console.error('[SocketServer] Error resetting chat storage:', err);
        return { success: false, reason: `Chat storage reset failed: ${err}` };
    }

    if (io) {
        io.emit('chat:history', {
            messages: [],
            startTime: chatStorage.getStartTime()
        });
        console.log('[SocketServer] Chat reset broadcast to clients');
    }

    return { success: true };
}

// Check for canvas reset and broadcast state
function setupResetScheduler(): void {
    // Check for reset every minute
    setInterval(() => {
        if (strokeStorage.shouldReset()) {
            console.log('[SocketServer] Canvas reset triggered by scheduler');
            resetCanvas().catch(err => console.error('[SocketServer] Error in scheduled reset:', err));
        }

        if (chatStorage.shouldReset()) {
            console.log('[SocketServer] Chat reset triggered by scheduler');
            resetChat().catch(err => console.error('[SocketServer] Error in scheduled chat reset:', err));
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
