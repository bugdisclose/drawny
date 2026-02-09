import { ExcalidrawElement } from '../types';
import fs from 'fs';
import path from 'path';

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
    private archiveStrokes(): void {
        if (this.elements.size === 0) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `canvas-${timestamp}.json`;
        const filePath = path.join(this.archivesDir, filename);

        const archiveData = {
            id: timestamp,
            date: new Date().toISOString(),
            startTime: this.canvasStartTime,
            endTime: Date.now(),
            elementCount: this.elements.size,
            elements: this.getAllElements()
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

// Singleton instance
export const strokeStorage = new StrokeStorage();
