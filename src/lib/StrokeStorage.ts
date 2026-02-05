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
        // Ensure archives directory exists
        if (!fs.existsSync(this.archivesDir)) {
            try {
                fs.mkdirSync(this.archivesDir, { recursive: true });
            } catch (err) {
                console.error('[StrokeStorage] Failed to create archives dir:', err);
            }
        }
    }

    // Add or update a stroke
    addStroke(stroke: Stroke): void {
        this.strokes.set(stroke.id, stroke);
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
        if (this.strokes.size === 0) return;

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
            fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2));
            console.log('[StrokeStorage] Archived canvas to:', filename);
        } catch (err) {
            console.error('[StrokeStorage] Failed to archive canvas:', err);
        }
    }

    // Reset the canvas
    reset(): void {
        console.log('[StrokeStorage] Resetting canvas...');
        this.archiveStrokes();

        const strokeCount = this.strokes.size;
        this.strokes.clear();
        this.canvasStartTime = Date.now();
        console.log('[StrokeStorage] Canvas reset complete. Cleared', strokeCount, 'strokes');
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
