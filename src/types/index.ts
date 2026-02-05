// Stroke data model for real-time drawing synchronization
export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  tool: StrokeTool;
  timestamp: number;
  userId: string;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

// Socket events for real-time communication
export interface ServerToClientEvents {
  'stroke:new': (stroke: Stroke) => void;
  'stroke:update': (stroke: Stroke) => void;
  'canvas:sync': (strokes: Stroke[]) => void;
  'canvas:state': (state: { startTime: number; strokeCount: number; timeUntilReset: number }) => void;
  'canvas:reset': () => void;
  'users:count': (count: number) => void;
  'cursor:update': (cursor: CursorData) => void;
  'cursor:remove': (userId: string) => void;
}

export interface ClientToServerEvents {
  'stroke:start': (stroke: Stroke) => void;
  'stroke:update': (stroke: Stroke) => void;
  'stroke:end': (stroke: Stroke) => void;
  'canvas:request-sync': () => void;
  'cursor:move': (cursor: CursorData) => void;
}

// Cursor data for real-time presence
export interface CursorData {
  userId: string;
  x: number;
  y: number;
  color: string;
}

// Drawing tool types
export type StrokeTool = 'brush' | 'eraser';
export type ToolType = StrokeTool | 'hand';

// Predefined color palette
export const COLORS = [
  '#1a1a2e', // Dark Navy
  '#e94560', // Coral Red
  '#0f3460', // Deep Blue
  '#16c79a', // Teal
  '#f9ed69', // Yellow
  '#f38181', // Salmon
  '#aa96da', // Lavender
  '#fcbad3', // Pink
  '#a8d8ea', // Light Blue
  '#ffffff', // White
] as const;

// Brush sizes - larger for better visibility
export const BRUSH_SIZES = {
  small: 6,
  medium: 16,
  large: 32,
} as const;

export type BrushSize = keyof typeof BRUSH_SIZES;

// Canvas configuration
export const CANVAS_CONFIG = {
  width: 10000,
  height: 10000,
  minZoom: 0.1,
  maxZoom: 5,
  defaultZoom: 1,
  resetIntervalHours: 24,
} as const;
