/**
 * InkManager - Manages ink stamina system to prevent spam and encourage deliberate drawing
 *
 * Features:
 * - Tracks ink consumption based on stroke length
 * - Maximum ink capacity: 3000px of drawing
 * - Regeneration: 5% (150px) every 3 seconds
 * - Prevents drawing when ink is depleted
 */

export interface InkState {
  current: number;
  max: number;
  percentage: number;
  canDraw: boolean;
}

export type InkChangeCallback = (state: InkState) => void;

export class InkManager {
  private currentInk: number;
  private readonly maxInk: number = 12000; // Maximum ink in pixels
  private readonly regenRate: number = 600; // Pixels regenerated per interval (5%)
  private readonly regenInterval: number = 3000; // Regeneration interval in ms (3 seconds)
  private regenTimer: NodeJS.Timeout | null = null;
  private listeners: Set<InkChangeCallback> = new Set();

  constructor(initialInk?: number) {
    this.currentInk = initialInk ?? this.maxInk;
    this.startRegeneration();
  }

  /**
   * Get current ink state
   */
  getState(): InkState {
    return {
      current: this.currentInk,
      max: this.maxInk,
      percentage: (this.currentInk / this.maxInk) * 100,
      canDraw: this.currentInk > 0,
    };
  }

  /**
   * Check if user can draw
   */
  canDraw(): boolean {
    return this.currentInk > 0;
  }

  /**
   * Consume ink based on stroke length
   * @param pixelLength - Length of the stroke in pixels
   * @returns true if ink was consumed, false if not enough ink
   */
  consumeInk(pixelLength: number): boolean {
    if (pixelLength <= 0) return true;

    // If we don't have enough ink, prevent the action
    if (this.currentInk <= 0) {
      return false;
    }

    // Consume ink (but don't go below 0)
    this.currentInk = Math.max(0, this.currentInk - pixelLength);
    this.notifyListeners();
    
    return true;
  }

  /**
   * Calculate total length of a stroke from points
   */
  calculateStrokeLength(points: Array<{ x: number; y: number }>): number {
    if (points.length < 2) return 0;

    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return totalLength;
  }

  /**
   * Start automatic ink regeneration
   */
  private startRegeneration(): void {
    if (this.regenTimer) {
      clearInterval(this.regenTimer);
    }

    this.regenTimer = setInterval(() => {
      if (this.currentInk < this.maxInk) {
        this.currentInk = Math.min(this.maxInk, this.currentInk + this.regenRate);
        this.notifyListeners();
      }
    }, this.regenInterval);
  }

  /**
   * Stop ink regeneration (cleanup)
   */
  stopRegeneration(): void {
    if (this.regenTimer) {
      clearInterval(this.regenTimer);
      this.regenTimer = null;
    }
  }

  /**
   * Subscribe to ink state changes
   */
  subscribe(callback: InkChangeCallback): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(callback => callback(state));
  }

  /**
   * Reset ink to maximum (for testing or special events)
   */
  reset(): void {
    this.currentInk = this.maxInk;
    this.notifyListeners();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRegeneration();
    this.listeners.clear();
  }
}

