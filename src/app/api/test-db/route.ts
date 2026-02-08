import { NextResponse } from 'next/server';
import { databaseService } from '@/lib/DatabaseService';
import { strokeStorage } from '@/lib/StrokeStorage';

// Test endpoint to check database status
export async function GET() {
    const dbAvailable = databaseService.isAvailable();

    let archives: Array<{ id: string; date: string; stroke_count: number }> = [];
    if (dbAvailable) {
        archives = await databaseService.getAllArchives();
    }
    
    const canvasInfo = strokeStorage.getCanvasInfo();
    
    return NextResponse.json({
        database: {
            available: dbAvailable,
            status: dbAvailable ? 'Connected' : 'Not configured or connection failed'
        },
        canvas: {
            strokeCount: canvasInfo.strokeCount,
            startTime: new Date(canvasInfo.startTime).toISOString(),
            timeUntilReset: Math.floor(canvasInfo.timeUntilReset / 1000 / 60), // minutes
            age: Math.floor((Date.now() - canvasInfo.startTime) / 1000 / 60) // minutes
        },
        archives: {
            count: archives.length,
            list: archives.slice(0, 5) // Show first 5
        },
        timestamp: new Date().toISOString()
    });
}

