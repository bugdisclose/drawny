import { ExcalidrawElement } from '../types';
import fs from 'fs';
import path from 'path';
import { databaseService } from './DatabaseService';

// In-memory element storage
class StrokeStorage {
    private elements: Map<string, ExcalidrawElement> = new Map();
    private canvasStartTime: number = Date.now();
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
    private async archiveStrokes(): Promise<void> {
        if (this.elements.size === 0) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `canvas-${timestamp}.json`;
        const filePath = path.join(this.archivesDir, filename);

        const archiveData = {
            id: timestamp,
            date: new Date().toISOString(),
            start_time: this.canvasStartTime,
            end_time: Date.now(),
            stroke_count: this.elements.size,
            strokes: this.getAllElements() as any // Cast to any to match DB expected type if needed, or update types
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
                const saved = await databaseService.saveArchive({
                    id: archiveData.id,
                    date: archiveData.date,
                    start_time: archiveData.start_time,
                    end_time: archiveData.end_time,
                    stroke_count: archiveData.stroke_count,
                    strokes: archiveData.strokes
                });

                if (saved) {
                    console.log('[StrokeStorage] ✅ Archived canvas to Database:', archiveData.id);
                } else {
                    console.warn('[StrokeStorage] ⚠️ Failed to save archive to Database (saveArchive returned false)');
                }
            } catch (err) {
                console.error('[StrokeStorage] ❌ Error saving to Database:', err);
            }
        } else {
            console.warn('[StrokeStorage] ⚠️ Database not available, skipping DB archival');
        }
    }

    // Reset the canvas
    async reset(): Promise<void> {
        console.log('[StrokeStorage] Resetting canvas...');

        try {
            await this.archiveStrokes();
        } catch (err) {
            console.error('[StrokeStorage] Error during archival in reset:', err);
            // We continue to clear elements even if archival fails to prevent stale state loop,
            // but we log the error.
        }

        const count = this.elements.size;
        this.elements.clear();
        this.canvasStartTime = Date.now();
        console.log('[StrokeStorage] Canvas reset complete. Cleared', count, 'elements');
    }

    // Get initial canvas state data
    getCanvasState() {
        return {
            elements: this.getAllElements(),
            startTime: this.canvasStartTime
        };
    }

    // Get canvas info for stats
    getCanvasInfo() {
        return {
            startTime: this.canvasStartTime,
            strokeCount: this.elements.size, // Keeping property name for compatibility if needed, else rename
            elementCount: this.elements.size,
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
