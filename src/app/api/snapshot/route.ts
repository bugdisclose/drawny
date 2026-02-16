/**
 * POST /api/snapshot
 * 
 * Accepts a PNG screenshot upload and stores it on disk.
 * Returns { id, url } so the client can build a share page URL.
 * 
 * Snapshots are stored in /tmp/drawny-snapshots/ and auto-expire
 * after 24 hours (matching the ephemeral nature of drawny).
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const SNAPSHOT_DIR = path.join(process.cwd(), '.snapshots');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Prune expired snapshots (older than 24h).
 * Runs on every upload request — lightweight check.
 */
async function pruneExpired() {
    try {
        const files = await readdir(SNAPSHOT_DIR);
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(SNAPSHOT_DIR, file);
            try {
                const fileStat = await stat(filePath);
                if (now - fileStat.mtimeMs > SNAPSHOT_TTL_MS) {
                    await unlink(filePath);
                    console.log(`[Snapshot API] 🗑️ Pruned expired: ${file}`);
                }
            } catch {
                // Skip files we can't stat
            }
        }
    } catch {
        // Directory may not exist yet
    }
}

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';

        // Accept raw PNG or form data
        let buffer: Buffer;

        if (contentType.includes('image/png') || contentType.includes('application/octet-stream')) {
            const arrayBuffer = await request.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } else if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('snapshot') as File | null;
            if (!file) {
                return NextResponse.json({ error: 'No snapshot file provided' }, { status: 400 });
            }
            const arrayBuffer = await file.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } else {
            return NextResponse.json(
                { error: 'Invalid content type. Send image/png or multipart/form-data' },
                { status: 400 }
            );
        }

        // Validate size
        if (buffer.length > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
        }

        if (buffer.length === 0) {
            return NextResponse.json({ error: 'Empty file' }, { status: 400 });
        }

        // Ensure directory exists
        await mkdir(SNAPSHOT_DIR, { recursive: true });

        // Prune old snapshots
        await pruneExpired();

        // Generate unique ID and save
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const filename = `${id}.png`;
        const filePath = path.join(SNAPSHOT_DIR, filename);

        await writeFile(filePath, buffer);
        console.log(`[Snapshot API] ✅ Saved snapshot: ${filename} (${buffer.length} bytes)`);

        return NextResponse.json({
            id,
            url: `/api/snapshot/${id}`,
        });
    } catch (error) {
        console.error('[Snapshot API] ❌ Upload failed:', error);
        return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
    }
}
