import { ExcalidrawElement } from '../types';
import fs from 'fs';
import path from 'path';
import { databaseService } from './DatabaseService';

// In-memory element storage
class StrokeStorage {
    private elements: Map<string, ExcalidrawElement> = new Map();
    private canvasStartTime: number = Date.now();
    private uniqueArtists: Set<string> = new Set();
    private readonly resetIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
    private readonly archivesDir = path.join(process.cwd(), 'public', 'archives');

    constructor() {
        console.log('[StrokeStorage] Initialized at:', new Date(this.canvasStartTime).toISOString());
        if (!fs.existsSync(this.archivesDir)) {
            try {
                fs.mkdirSync(this.archivesDir, { recursive: true });
            } catch (err) {
                console.error('[StrokeStorage] Failed to create archives dir:', err);
            }
        }
    }

    // Update elements (upsert)
    updateElements(elements: readonly ExcalidrawElement[]): void {
        elements.forEach(element => {
            this.elements.set(element.id, element);
        });
    }

    // Mark a session as having drawn at least one stroke
    // Returns true if this is a NEW unique artist (first stroke in this cycle)
    markSessionAsDrawn(sessionId: string): boolean {
        if (this.uniqueArtists.has(sessionId)) {
            return false;
        }
        this.uniqueArtists.add(sessionId);
        console.log('[StrokeStorage] New unique artist:', sessionId, '| Total unique artists:', this.uniqueArtists.size);
        return true;
    }

    // Get number of unique artists who drew in this cycle
    getUniqueArtistCount(): number {
        return this.uniqueArtists.size;
    }

    // Get all elements
    getAllElements(): ExcalidrawElement[] {
        return Array.from(this.elements.values());
    }

    // Check if canvas should reset
    shouldReset(): boolean {
        return Date.now() - this.canvasStartTime >= this.resetIntervalMs;
    }

    // Get time until reset
    getTimeUntilReset(): number {
        return Math.max(0, this.resetIntervalMs - (Date.now() - this.canvasStartTime));
    }

    // Archive current canvas
    private async archiveStrokes(): Promise<{ success: boolean; reason?: string; archiveId?: string }> {
        if (this.elements.size === 0) {
            return { success: false, reason: 'No strokes to archive (count is 0)' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `canvas-${timestamp}.json`;
        const filePath = path.join(this.archivesDir, filename);

        const archiveData = {
            id: timestamp,
            date: new Date().toISOString(),
            start_time: this.canvasStartTime,
            end_time: Date.now(),
            stroke_count: this.elements.size,
            artist_count: this.uniqueArtists.size,
            strokes: this.getAllElements() as any
        };

        // 1. Save to local filesystem (backup/dev)
        try {
            fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2));
            console.log('[StrokeStorage] Archived canvas to local FS:', filename);
        } catch (err) {
            console.error('[StrokeStorage] Failed to archive canvas to FS:', err);
        }

        // 2. Save to Database (Persistent)
        if (databaseService.isAvailable()) {
            try {
                console.log('[StrokeStorage] Attempting to save archive to DB:', archiveData.id);
                const saved = await databaseService.saveArchive({
                    id: archiveData.id,
                    date: archiveData.date,
                    start_time: archiveData.start_time,
                    end_time: archiveData.end_time,
                    stroke_count: archiveData.stroke_count,
                    artist_count: archiveData.artist_count,
                    strokes: archiveData.strokes
                });

                if (saved) {
                    console.log('[StrokeStorage] ✅ Archived canvas to Database:', archiveData.id);
                    return { success: true, archiveId: archiveData.id };
                } else {
                    console.warn('[StrokeStorage] ⚠️ Failed to save archive to Database (saveArchive returned false)');
                    return { success: false, reason: 'Database saveArchive returned false' };
                }
            } catch (err) {
                console.error('[StrokeStorage] ❌ Error saving to Database:', err);
                return { success: false, reason: `Database error: ${err instanceof Error ? err.message : String(err)}` };
            }
        } else {
            console.warn('[StrokeStorage] ⚠️ Database not available, skipping DB archival');
            // If local save worked, we might consider it partial success, but for PROD we want DB.
            return { success: false, reason: 'Database not available' };
        }
    }

    // Reset the canvas
    async reset(): Promise<{ success: boolean; result?: any }> {
        console.log('[StrokeStorage] Resetting canvas...');
        let archiveResult;

        try {
            archiveResult = await this.archiveStrokes();
            console.log('[StrokeStorage] Archive result:', archiveResult);
        } catch (err) {
            console.error('[StrokeStorage] Error during archival in reset:', err);
            archiveResult = { success: false, reason: `Unexpected error: ${err}` };
        }

        const count = this.elements.size;
        const artistCount = this.uniqueArtists.size;
        this.elements.clear();
        this.uniqueArtists.clear();
        this.canvasStartTime = Date.now();
        console.log('[StrokeStorage] Canvas reset complete. Cleared', count, 'elements,', artistCount, 'unique artists');

        return { success: true, result: archiveResult };
    }

    // Get initial canvas state data
    getCanvasState() {
        return {
            elements: this.getAllElements(),
            startTime: this.canvasStartTime,
            artistCount: this.uniqueArtists.size
        };
    }

    // Get canvas info for stats
    getCanvasInfo() {
        return {
            startTime: this.canvasStartTime,
            strokeCount: this.elements.size,
            elementCount: this.elements.size,
            artistCount: this.uniqueArtists.size,
            timeUntilReset: this.getTimeUntilReset(),
        };
    }
}

// Singleton instance with global persistence for development/HMR
const globalForStrokeStorage = globalThis as unknown as {
    strokeStorage: StrokeStorage | undefined;
};

export const strokeStorage = globalForStrokeStorage.strokeStorage ?? new StrokeStorage();

if (process.env.NODE_ENV !== 'production') {
    globalForStrokeStorage.strokeStorage = strokeStorage;
} else {
    // Even in production, if we're in a custom server setup where Next.js might be
    // re-instantiating modules or running in a way that separates instances,
    // we want to ensure we use the same one if possible.
    // However, usually module caching handles this. The multiple initializations might be
    // due to Next.js build vs runtime or server components vs API routes separation.
    // Let's try to enforce global singleton even in production for this specific use case
    // where we MUST share state between the custom server (socket.io) and Next.js handlers.
    globalForStrokeStorage.strokeStorage = strokeStorage;
}
