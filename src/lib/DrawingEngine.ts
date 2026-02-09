import { Stroke, Point, StrokeTool, BRUSH_SIZES, BrushSize, CANVAS_CONFIG } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface DrawingEngineConfig {
    canvas: HTMLCanvasElement;
    onStrokeStart?: (stroke: Stroke) => void;
    onStrokeUpdate?: (stroke: Stroke) => void;
    onStrokeEnd?: (stroke: Stroke) => void;
}

export class DrawingEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private isDrawing = false;
    private currentStroke: Stroke | null = null;
    private lastPoint: Point | null = null;

    // Drawing state
    private color = '#1e1e1e';
    private brushSize: BrushSize = 'medium';
    private tool: StrokeTool = 'brush';
    private userId: string;

    // Rate limiting: max 10 strokes per second (generous for smooth drawing)
    private strokeTimestamps: number[] = [];
    private readonly maxStrokesPerSecond = 10;

    // Advanced smoothing with Catmull-Rom splines
    private points: Point[] = [];
    private readonly minDistance = 1.5; // Minimum distance between points for smoother curves

    // Callbacks
    private onStrokeStart?: (stroke: Stroke) => void;
    private onStrokeUpdate?: (stroke: Stroke) => void;
    private onStrokeEnd?: (stroke: Stroke) => void;

    // Update throttling for network
    private lastUpdateTime = 0;
    private readonly updateInterval = 50; // Send updates every 50ms

    constructor(config: DrawingEngineConfig) {
        this.canvas = config.canvas;
        const ctx = config.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false,
        });
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        this.onStrokeStart = config.onStrokeStart;
        this.onStrokeUpdate = config.onStrokeUpdate;
        this.onStrokeEnd = config.onStrokeEnd;

        this.userId = this.getOrCreateUserId();
        this.setupCanvas();
        console.log('[DrawingEngine] Initialized with userId:', this.userId);
    }

    private getOrCreateUserId(): string {
        if (typeof window === 'undefined') return uuidv4();

        let userId = localStorage.getItem('drawny_user_id');
        if (!userId) {
            userId = uuidv4();
            localStorage.setItem('drawny_user_id', userId);
        }
        return userId;
    }

    private setupCanvas(): void {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Fill with white background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
    }

    private canDraw(): boolean {
        const now = Date.now();
        this.strokeTimestamps = this.strokeTimestamps.filter(t => now - t < 1000);
        return this.strokeTimestamps.length < this.maxStrokesPerSecond;
    }

    // Calculate distance between two points
    private distance(p1: Point, p2: Point): number {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    // Start a new stroke
    startStroke(x: number, y: number, pressure = 1): void {
        if (!this.canDraw()) return;

        this.strokeTimestamps.push(Date.now());
        this.isDrawing = true;
        this.points = [];

        const point: Point = { x, y, pressure: Math.max(0.1, pressure) };
        this.points.push(point);
        this.lastPoint = point;

        this.currentStroke = {
            id: uuidv4(),
            points: [point],
            color: this.tool === 'eraser' ? '#ffffff' : this.color,
            size: BRUSH_SIZES[this.brushSize],
            tool: this.tool,
            timestamp: Date.now(),
            userId: this.userId,
        };

        // Draw initial dot
        this.drawDot(point, this.currentStroke);

        this.onStrokeStart?.(this.currentStroke);
        console.log('[DrawingEngine] Stroke started:', this.currentStroke.id);
    }

    // Continue drawing with optimized rendering
    continueStroke(x: number, y: number, pressure = 1): void {
        if (!this.isDrawing || !this.currentStroke || !this.lastPoint) return;

        const newPoint: Point = { x, y, pressure: Math.max(0.1, pressure) };

        // Only add point if moved enough
        if (this.distance(this.lastPoint, newPoint) < this.minDistance) {
            return;
        }

        this.points.push(newPoint);
        this.currentStroke.points.push(newPoint);

        // Draw smooth curve segment
        if (this.points.length >= 2) {
            this.drawSmoothLine(this.points, this.currentStroke);
        }

        this.lastPoint = newPoint;

        // Throttle network updates
        const now = Date.now();
        if (now - this.lastUpdateTime >= this.updateInterval) {
            this.onStrokeUpdate?.(this.currentStroke);
            this.lastUpdateTime = now;
        }
    }

    // Draw a smooth line using the last few points
    private drawSmoothLine(points: Point[], stroke: Stroke): void {
        if (points.length < 2) return;

        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];

        this.ctx.beginPath();
        this.ctx.strokeStyle = stroke.color;

        // Pressure-sensitive width
        const avgPressure = ((p1.pressure || 1) + (p2.pressure || 1)) / 2;
        this.ctx.lineWidth = (stroke.size || 4) * avgPressure;

        // Always use source-over for now (eraser paints white)
        this.ctx.globalCompositeOperation = 'source-over';

        // Use quadratic curve for smoothness
        if (points.length >= 3) {
            const p0 = points[points.length - 3];
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            const midX2 = (p1.x + p2.x) / 2;
            const midY2 = (p1.y + p2.y) / 2;

            this.ctx.moveTo(midX, midY);
            this.ctx.quadraticCurveTo(p1.x, p1.y, midX2, midY2);
        } else {
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
        }

        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // Draw a single dot
    private drawDot(point: Point, stroke: Stroke): void {
        this.ctx.beginPath();

        // Always use source-over
        this.ctx.globalCompositeOperation = 'source-over';

        const radius = ((stroke.size || 4) * (point.pressure || 1)) / 2;
        this.ctx.arc(point.x, point.y, Math.max(1, radius), 0, Math.PI * 2);
        this.ctx.fillStyle = stroke.color;
        this.ctx.fill();

        this.ctx.globalCompositeOperation = 'source-over';
    }

    // End the stroke
    endStroke(): void {
        if (!this.isDrawing || !this.currentStroke) return;

        // Draw final segment if we have points
        if (this.points.length >= 2 && this.lastPoint) {
            this.drawSmoothLine(this.points, this.currentStroke);
        }

        console.log('[DrawingEngine] Stroke ended:', this.currentStroke.id, 'points:', this.currentStroke.points.length);
        this.onStrokeEnd?.(this.currentStroke);

        this.isDrawing = false;
        this.currentStroke = null;
        this.lastPoint = null;
        this.points = [];
    }

    // Draw a complete stroke (for replaying/syncing)
    drawStroke(stroke: Stroke): void {
        if (stroke.points.length === 0) return;

        const points = stroke.points;

        if (points.length === 1) {
            this.drawDot(points[0], stroke);
            return;
        }

        this.ctx.beginPath();
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.size || 4;

        // Always use source-over
        this.ctx.globalCompositeOperation = 'source-over';

        // Draw smooth curve through all points
        this.ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            this.ctx.lineTo(points[1].x, points[1].y);
        } else {
            // Use quadratic bezier curves for smoothness
            for (let i = 1; i < points.length - 1; i++) {
                const midX = (points[i].x + points[i + 1].x) / 2;
                const midY = (points[i].y + points[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
            }

            // Final segment
            const last = points[points.length - 1];
            const secondLast = points[points.length - 2];
            this.ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
        }

        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // Draw multiple strokes
    drawStrokes(strokes: Stroke[]): void {
        console.log('[DrawingEngine] Drawing', strokes.length, 'strokes');
        strokes.forEach(stroke => this.drawStroke(stroke));
    }

    // Clear the canvas
    clear(): void {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
        console.log('[DrawingEngine] Canvas cleared');
    }

    // Setters
    setColor(color: string): void {
        this.color = color;
        console.log('[DrawingEngine] Color set:', color);
    }

    setBrushSize(size: BrushSize): void {
        this.brushSize = size;
        console.log('[DrawingEngine] Brush size set:', size, '(', BRUSH_SIZES[size], 'px)');
    }

    setTool(tool: StrokeTool): void {
        this.tool = tool;
        console.log('[DrawingEngine] Tool set:', tool);
    }

    // Getters
    getColor(): string { return this.color; }
    getBrushSize(): BrushSize { return this.brushSize; }
    getTool(): StrokeTool { return this.tool; }
    getUserId(): string { return this.userId; }
}
