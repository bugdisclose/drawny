import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { attachSocketHandlers } from '../../lib/SocketServer';
import { Server as NetServer } from 'http';

export const config = {
    api: {
        bodyParser: false,
    },
};

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: NetServer & {
            io: SocketIOServer;
        };
    };
};

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
    if (!res.socket.server.io) {
        console.log('[API/Socket] Initializing Socket.io server...');

        const io = new SocketIOServer(res.socket.server, {
            path: '/api/socket',
            addTrailingSlash: false,
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
            // polling comes first for Vercel
            transports: ['polling', 'websocket'],
        });

        res.socket.server.io = io;
        attachSocketHandlers(io);
    } else {
        // console.log('[API/Socket] Socket.io already running');
    }

    res.end();
}
