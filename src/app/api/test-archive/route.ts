import { NextResponse } from 'next/server';
import { resetCanvas } from '@/lib/SocketServer';

// Test endpoint to manually trigger canvas reset and archive creation
// This is for testing purposes only
export async function POST() {
    try {
        console.log('[Test API] Manual canvas reset triggered');
        
        // Trigger the canvas reset which will archive current strokes
        await resetCanvas();
        
        return NextResponse.json({
            success: true,
            message: 'Canvas reset and archive created successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Test API] Failed to reset canvas:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET endpoint to check if test endpoint is available
export async function GET() {
    return NextResponse.json({
        message: 'Test archive endpoint',
        usage: 'Send POST request to trigger manual canvas reset and archive creation',
        warning: 'This will clear the current canvas and create an archive'
    });
}

