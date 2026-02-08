import { Stroke } from '../types';
import fs from 'fs';
import path from 'path';

// In-memory stroke storage (will be replaced with Redis for production)
class StrokeStorage {
    private strokes: Map<string, Stroke> = new Map();
    private canvasStartTime: number = Date.now();
    private readonly resetIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
    private readonly archivesDir = path.join(process.cwd(), 'public', 'archives');

    constructor() {
        console.log('[StrokeStorage] Initialized at:', new Date(this.canvasStartTime).toISOString());
        console.log('[StrokeStorage] Archive directory:', this.archivesDir);

        // Ensure archives directory exists
        if (!fs.existsSync(this.archivesDir)) {
            try {
                fs.mkdirSync(this.archivesDir, { recursive: true });
                console.log('[StrokeStorage] Created archives directory');
            } catch (err) {
                console.error('[StrokeStorage] Failed to create archives dir:', err);
            }
        } else {
            // List existing archives
            try {
                const files = fs.readdirSync(this.archivesDir);
                console.log('[StrokeStorage] Found', files.length, 'existing archive(s)');
            } catch (err) {
                console.error('[StrokeStorage] Failed to read archives dir:', err);
            }
        }

        // WARNING: On cloud platforms like Render.com, filesystem is ephemeral
        if (process.env.RENDER || process.env.NODE_ENV === 'production') {
            console.warn('[StrokeStorage] ⚠️  WARNING: Running on ephemeral filesystem!');
            console.warn('[StrokeStorage] ⚠️  Archives will be lost on server restart/redeploy');
            console.warn('[StrokeStorage] ⚠️  Consider using persistent storage (S3, database, etc.)');
        }
    }

    // Add or update a stroke
    addStroke(stroke: Stroke): void {
        this.strokes.set(stroke.id, stroke);
    }

    // Delete a stroke
    deleteStroke(strokeId: string): boolean {
        const deleted = this.strokes.delete(strokeId);
        if (deleted) {
            console.log('[StrokeStorage] Deleted stroke:', strokeId);
        }
        return deleted;
    }

    // Get a specific stroke
    getStroke(id: string): Stroke | undefined {
        return this.strokes.get(id);
    }

    // Get all strokes
    getAllStrokes(): Stroke[] {
        return Array.from(this.strokes.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    // Get stroke count
    getStrokeCount(): number {
        return this.strokes.size;
    }

    // Check if canvas should reset
    shouldReset(): boolean {
        return Date.now() - this.canvasStartTime >= this.resetIntervalMs;
    }

    // Get time until reset
    getTimeUntilReset(): number {
        return Math.max(0, this.resetIntervalMs - (Date.now() - this.canvasStartTime));
    }

    // Archive current strokes
    private archiveStrokes(): void {
        if (this.strokes.size === 0) {
            console.log('[StrokeStorage] No strokes to archive, skipping');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `canvas-${timestamp}.json`;
        const filePath = path.join(this.archivesDir, filename);

        const archiveData = {
            id: timestamp,
            date: new Date().toISOString(),
            startTime: this.canvasStartTime,
            endTime: Date.now(),
            strokeCount: this.strokes.size,
            strokes: this.getAllStrokes()
        };

        try {
            console.log('[StrokeStorage] Archiving', this.strokes.size, 'strokes to:', filename);
            console.log('[StrokeStorage] Archive directory:', this.archivesDir);
            console.log('[StrokeStorage] Archive file path:', filePath);

            fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2));

            // Verify the file was created
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log('[StrokeStorage] ✅ Archive created successfully:', filename, 'Size:', stats.size, 'bytes');
            } else {
                console.error('[StrokeStorage] ❌ Archive file not found after write!');
            }
        } catch (err) {
            console.error('[StrokeStorage] ❌ Failed to archive canvas:', err);
        }
    }

    // Reset the canvas
    reset(): void {
        const now = new Date();
        console.log('[StrokeStorage] ========================================');
        console.log('[StrokeStorage] 🔄 CANVAS RESET TRIGGERED');
        console.log('[StrokeStorage] Time:', now.toISOString());
        console.log('[StrokeStorage] Current strokes:', this.strokes.size);
        console.log('[StrokeStorage] Canvas age:', Math.floor((Date.now() - this.canvasStartTime) / 1000 / 60 / 60), 'hours');
        console.log('[StrokeStorage] ========================================');

        this.archiveStrokes();

        const strokeCount = this.strokes.size;
        this.strokes.clear();
        this.canvasStartTime = Date.now();

        console.log('[StrokeStorage] ✅ Canvas reset complete. Cleared', strokeCount, 'strokes');
        console.log('[StrokeStorage] New canvas start time:', new Date(this.canvasStartTime).toISOString());
    }

    // Get canvas info
    getCanvasInfo(): { startTime: number; strokeCount: number; timeUntilReset: number } {
        return {
            startTime: this.canvasStartTime,
            strokeCount: this.strokes.size,
            timeUntilReset: this.getTimeUntilReset(),
        };
    }
}

// Singleton instance
export const strokeStorage = new StrokeStorage();
