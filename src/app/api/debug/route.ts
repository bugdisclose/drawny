import { NextResponse } from 'next/server';
import { strokeStorage } from '@/lib/StrokeStorage';
import { getSocketServer } from '@/lib/SocketServer';

export async function GET() {
    const io = getSocketServer();
    const canvasInfo = strokeStorage.getCanvasInfo();
    
    return NextResponse.json({
        server: {
            socketServer: io !== null ? 'initialized' : 'not initialized',
            connectedClients: io ? io.engine.clientsCount : 0,
        },
        canvas: {
            strokeCount: canvasInfo.strokeCount,
            startTime: new Date(canvasInfo.startTime).toISOString(),
            timeUntilReset: Math.floor(canvasInfo.timeUntilReset / 1000 / 60),
            age: Math.floor((Date.now() - canvasInfo.startTime) / 1000 / 60)
        },
        timestamp: new Date().toISOString()
    });
}

