/**
 * Deep Linking Utilities for Drawny
 * 
 * Centralized module for URL hash coordinate parsing, validation,
 * share URL generation, and coordinate formatting.
 * 
 * Production domain: drawny.com
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const PRODUCTION_DOMAIN = 'drawny.com';
const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`;

/** Viewport coordinate bounds for validation */
const VIEWPORT_BOUNDS = {
  minZoom: 0.1,
  maxZoom: 5,
  // Canvas is 10,000x10,000 — allow scrolling well beyond with padding
  minCoord: -50000,
  maxCoord: 50000,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViewportCoordinates {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

// ─── Parsing & Validation ────────────────────────────────────────────────────

/**
 * Clamp a number to a range. Returns defaultVal if input is NaN/Infinity.
 */
function clamp(value: number, min: number, max: number, defaultVal: number): number {
  if (!Number.isFinite(value)) {
    console.warn(`[DeepLink] Invalid coordinate value: ${value}, using default: ${defaultVal}`);
    return defaultVal;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Parse viewport coordinates from a URL hash string.
 * Validates and clamps all values to safe ranges.
 * 
 * @param hash - The hash string (with or without leading '#')
 * @returns Parsed viewport or null if hash doesn't contain valid coordinates
 */
export function parseViewport(hash: string): ViewportCoordinates | null {
  if (!hash) return null;

  // Strip leading '#' if present
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleanHash) return null;

  try {
    const params = new URLSearchParams(cleanHash);
    const xRaw = params.get('x');
    const yRaw = params.get('y');
    const zRaw = params.get('z');

    // All three must be present
    if (xRaw === null || yRaw === null || zRaw === null) {
      return null;
    }

    const x = parseFloat(xRaw);
    const y = parseFloat(yRaw);
    const z = parseFloat(zRaw);

    // Validate: at least one must be a finite number
    if (!Number.isFinite(x) && !Number.isFinite(y) && !Number.isFinite(z)) {
      console.warn('[DeepLink] All parsed values are invalid, ignoring hash');
      return null;
    }

    const viewport: ViewportCoordinates = {
      scrollX: clamp(x, VIEWPORT_BOUNDS.minCoord, VIEWPORT_BOUNDS.maxCoord, 0),
      scrollY: clamp(y, VIEWPORT_BOUNDS.minCoord, VIEWPORT_BOUNDS.maxCoord, 0),
      zoom: clamp(z, VIEWPORT_BOUNDS.minZoom, VIEWPORT_BOUNDS.maxZoom, 1),
    };

    console.log('[DeepLink] Parsed viewport from URL:', viewport);
    return viewport;
  } catch (error) {
    console.error('[DeepLink] Failed to parse viewport from hash:', error);
    return null;
  }
}

// ─── URL Building ────────────────────────────────────────────────────────────

/**
 * Determine whether the current environment is production.
 * Works safely in SSR (returns false if `window` is unavailable).
 */
function isProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === PRODUCTION_DOMAIN || hostname === `www.${PRODUCTION_DOMAIN}`;
}

/**
 * Get the base origin for share URLs.
 * In production, always uses https://drawny.com.
 * In development, uses the current window origin.
 */
function getShareOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  return isProduction() ? PRODUCTION_ORIGIN : window.location.origin;
}

/**
 * Build a share URL with viewport coordinates encoded in the hash.
 * Uses production domain in production, localhost in dev.
 * 
 * @param viewport - Current viewport coordinates (optional)
 * @returns Full share URL string
 */
export function buildShareUrl(viewport?: ViewportCoordinates | null): string {
  const origin = getShareOrigin();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (!viewport) {
    return `${origin}${pathname}`;
  }

  const hash = `#x=${Math.round(viewport.scrollX)}&y=${Math.round(viewport.scrollY)}&z=${viewport.zoom.toFixed(2)}`;
  return `${origin}${pathname}${hash}`;
}

/**
 * Build a hash string from viewport coordinates (for replaceState).
 */
export function buildHash(viewport: ViewportCoordinates): string {
  return `#x=${Math.round(viewport.scrollX)}&y=${Math.round(viewport.scrollY)}&z=${viewport.zoom.toFixed(2)}`;
}

// ─── Display Formatting ──────────────────────────────────────────────────────

/**
 * Format viewport coordinates for human-readable display.
 * 
 * @param viewport - Current viewport coordinates
 * @returns Formatted string like "(1200, -800) · 1.5x zoom"
 */
export function formatCoordinates(viewport: ViewportCoordinates): string {
  const x = Math.round(viewport.scrollX);
  const y = Math.round(viewport.scrollY);
  const z = viewport.zoom.toFixed(1);
  return `(${x}, ${y}) · ${z}x`;
}
