// Load environment variables from .env file
import 'dotenv/config';

import { createServer } from 'http';
import next from 'next';
import { initSocketServer } from './src/lib/SocketServer';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    // Initialize Socket.io AFTER creating the server
    // Socket.io will use default path /socket.io/
    const io = initSocketServer(httpServer);
    console.log('[Server] Socket.io initialized (default path)');

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Mode: ${dev ? 'development' : 'production'}`);
    });
});
