/**
 * GET /api/snapshot/[id]
 * 
 * Serves a previously uploaded snapshot PNG by its ID.
 * Used as the OG image URL for social media previews.
 * 
 * Returns the PNG with appropriate cache headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const SNAPSHOT_DIR = path.join(process.cwd(), '.snapshots');

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Sanitize: only allow alphanumeric IDs
        if (!/^[a-zA-Z0-9]+$/.test(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const filePath = path.join(SNAPSHOT_DIR, `${id}.png`);

        // Check existence
        try {
            await stat(filePath);
        } catch {
            return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
        }

        const buffer = await readFile(filePath);

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': buffer.length.toString(),
                // Cache for 1 hour, content is ephemeral
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            },
        });
    } catch (error) {
        console.error('[Snapshot API] ❌ Failed to serve snapshot:', error);
        return NextResponse.json({ error: 'Failed to serve snapshot' }, { status: 500 });
    }
}
