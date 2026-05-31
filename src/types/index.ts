import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// Re-export common types
export type { ExcalidrawElement };

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface ChatHistoryData {
  messages: ChatMessage[];
  startTime: number;
}

// Socket events for real-time communication
export interface ServerToClientEvents {
  'scene:update': (data: SceneUpdate) => void;
  'scene:sync': (elements: readonly ExcalidrawElement[]) => void; // Full sync
  'scene:init': (data: SceneInitData) => void;
  'cursor:update': (cursor: CursorData) => void;
  'cursor:remove': (userId: string) => void;
  'users:count': (count: number) => void;
  'artists:count': (count: number) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (data: ChatHistoryData) => void;
}

export interface ClientToServerEvents {
  'scene:update': (elements: readonly ExcalidrawElement[]) => void; // Delta or full update
  'scene:request-sync': () => void;
  'cursor:move': (cursor: CursorData) => void;
  'chat:message': (data: { username: string; message: string }) => void;
  'chat:request-history': () => void;
}

export interface SceneUpdate {
  userId: string;
  elements: readonly ExcalidrawElement[];
}

export interface SceneInitData {
  elements: readonly ExcalidrawElement[];
  startTime: number;
  artistCount: number;
}

// Cursor data for real-time presence
export interface CursorData {
  userId: string;
  x: number;
  y: number;
  color: string;
  userName?: string;
}

// Predefined color palette (aligned with Excalidraw defaults or custom)
export const COLORS = [
  '#000000', // Black
  '#343a40', // Dark Gray
  '#495057', // Gray
  '#e03131', // Bright Red
  '#c92a2a', // Crimson
  '#a61e4d', // Pink
  '#ae3ec9', // Magenta
  '#862e9c', // Grape
  '#5f3dc4', // Violet
  '#364fc7', // Indigo
  '#1864ab', // Blue
  '#1c7ed6', // Sky Blue
  '#0b7285', // Cyan
  '#087f5b', // Teal
  '#2b8a3e', // Green
  '#5c940d', // Lime
  '#fab005', // Gold
  '#e67700', // Yellow
  '#d9480f', // Orange
  '#ffffff', // White
] as const;

// Brush sizes mapping to Excalidraw strokeWidth
export const BRUSH_SIZES = {
  small: 2,
  medium: 4,
  large: 8,
} as const;


export type BrushSize = keyof typeof BRUSH_SIZES;
export type ToolType = 'selection' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'image' | 'eraser' | 'hand' | 'brush';

// Legacy types used by Canvas.tsx and DrawingEngine.ts (the old drawing system)
export const CANVAS_CONFIG = {
  width: 4000,
  height: 4000,
  minZoom: 0.25,
  maxZoom: 3,
} as const;

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width?: number;
  size?: number;
  tool: StrokeTool;
  userId?: string;
  timestamp?: number;
}

export type StrokeTool = 'brush' | 'eraser';
export type SimpleColor = string;
