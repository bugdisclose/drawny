'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildShareUrl, type ViewportCoordinates } from '@/lib/deepLinkUtils';
import styles from './ShareNudge.module.css';

// ─── Nudge messages — contextual, playful, varied ─────────────────────
const ZOOM_NUDGES = [
    { text: 'Like this spot?', cta: 'Invite friends here', emoji: '📍' },
    { text: 'Building something?', cta: 'Get backup', emoji: '⚡' },
    { text: 'Found something wild?', cta: 'Share this spot', emoji: '👀' },
];

const DRAW_NUDGES = [
    { text: 'Nice work!', cta: 'Show it off', emoji: '🎨' },
    { text: "Your art won't last forever", cta: "Share before it's gone", emoji: '⏳' },
];

const MULTI_USER_NUDGES = [
    { text: 'Others are drawing nearby', cta: 'Rally more artists', emoji: '🤝' },
    { text: 'The canvas is alive', cta: 'Bring your crew', emoji: '⚡' },
];

interface ShareNudgeProps {
    viewport: ViewportCoordinates | null;
    usersCount: number;
    onOpenShare?: () => void;
}

// Session limits
const MAX_NUDGES_PER_SESSION = 3;
const COOLDOWN_MS = 60_000; // 60s between nudges
const AUTO_DISMISS_MS = 8_000; // 8s auto-dismiss
const ZOOM_THRESHOLD = 1.5;
const ZOOM_SETTLE_MS = 3_000;
const DRAW_TIME_TRIGGER_MS = 90_000;
const SWIPE_THRESHOLD = 60; // px to trigger swipe-dismiss

export default function ShareNudge({ viewport, usersCount, onOpenShare }: ShareNudgeProps) {
    const [nudge, setNudge] = useState<{ text: string; cta: string; emoji: string } | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [exitDirection, setExitDirection] = useState<'down' | 'left' | 'right'>('down');
    const [copied, setCopied] = useState(false);

    // Swipe tracking
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const nudgeElRef = useRef<HTMLDivElement>(null);
    const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
    const isSwiping = useRef(false);

    // Session tracking refs
    const nudgeCountRef = useRef(0);
    const lastNudgeTimeRef = useRef(0);
    const lastZoomRef = useRef(1);
    const zoomSettleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
    const drawTimeTriggeredRef = useRef(false);
    const multiUserTriggeredRef = useRef(false);
    const zoomTriggeredZoomLevels = useRef(new Set<number>());

    const pickNudge = useCallback((pool: typeof ZOOM_NUDGES) => {
        return pool[Math.floor(Math.random() * pool.length)];
    }, []);

    const canShowNudge = useCallback(() => {
        if (nudge) return false;
        if (nudgeCountRef.current >= MAX_NUDGES_PER_SESSION) return false;
        const elapsed = Date.now() - lastNudgeTimeRef.current;
        if (lastNudgeTimeRef.current > 0 && elapsed < COOLDOWN_MS) return false;
        return true;
    }, [nudge]);

    const showNudge = useCallback((pool: typeof ZOOM_NUDGES) => {
        if (!canShowNudge()) return;
        const picked = pickNudge(pool);
        setNudge(picked);
        setCopied(false);
        setIsExiting(false);
        setExitDirection('down');
        setSwipeOffset({ x: 0, y: 0 });
        nudgeCountRef.current++;
        lastNudgeTimeRef.current = Date.now();
        console.log(`[ShareNudge] Showing: "${picked.text} ${picked.cta}" (${nudgeCountRef.current}/${MAX_NUDGES_PER_SESSION})`);
    }, [canShowNudge, pickNudge]);

    const dismissNudge = useCallback((direction: 'down' | 'left' | 'right' = 'down') => {
        setExitDirection(direction);
        setIsExiting(true);
        setTimeout(() => {
            setNudge(null);
            setIsExiting(false);
            setSwipeOffset({ x: 0, y: 0 });
        }, 300);
        if (autoDismissTimerRef.current) {
            clearTimeout(autoDismissTimerRef.current);
            autoDismissTimerRef.current = null;
        }
    }, []);

    // Auto-dismiss timer
    useEffect(() => {
        if (!nudge) return;
        autoDismissTimerRef.current = setTimeout(() => dismissNudge('down'), AUTO_DISMISS_MS);
        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
            }
        };
    }, [nudge, dismissNudge]);

    // ─── Swipe-to-dismiss handlers ──────────────────────────────────────
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        isSwiping.current = false;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;

        // Only track horizontal or downward swipes
        if (Math.abs(dx) > 10 || dy > 10) {
            isSwiping.current = true;
            setSwipeOffset({ x: dx, y: Math.max(0, dy) });
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartRef.current) return;
        const { x, y } = swipeOffset;

        if (Math.abs(x) > SWIPE_THRESHOLD) {
            dismissNudge(x > 0 ? 'right' : 'left');
        } else if (y > SWIPE_THRESHOLD) {
            dismissNudge('down');
        } else {
            // Snap back
            setSwipeOffset({ x: 0, y: 0 });
        }

        touchStartRef.current = null;
        isSwiping.current = false;
    }, [swipeOffset, dismissNudge]);

    // ─── Trigger 1: Zoom-in detection ───────────────────────────────────
    useEffect(() => {
        if (!viewport) return;
        const currentZoom = viewport.zoom;

        if (currentZoom >= ZOOM_THRESHOLD && lastZoomRef.current < ZOOM_THRESHOLD) {
            const roundedZoom = Math.round(currentZoom * 10);
            if (zoomTriggeredZoomLevels.current.has(roundedZoom)) {
                lastZoomRef.current = currentZoom;
                return;
            }

            if (zoomSettleTimerRef.current) {
                clearTimeout(zoomSettleTimerRef.current);
            }

            zoomSettleTimerRef.current = setTimeout(() => {
                zoomTriggeredZoomLevels.current.add(roundedZoom);
                showNudge(ZOOM_NUDGES);
            }, ZOOM_SETTLE_MS);
        }

        lastZoomRef.current = currentZoom;

        return () => {
            if (zoomSettleTimerRef.current) {
                clearTimeout(zoomSettleTimerRef.current);
            }
        };
    }, [viewport, showNudge]);

    // ─── Trigger 2: Drawing time ────────────────────────────────────────
    useEffect(() => {
        if (drawTimeTriggeredRef.current) return;

        const timer = setTimeout(() => {
            drawTimeTriggeredRef.current = true;
            showNudge(DRAW_NUDGES);
        }, DRAW_TIME_TRIGGER_MS);

        return () => clearTimeout(timer);
    }, [showNudge]);

    // ─── Trigger 3: Multiple users present ──────────────────────────────
    useEffect(() => {
        if (multiUserTriggeredRef.current) return;
        if (usersCount >= 3) {
            const timer = setTimeout(() => {
                if (!multiUserTriggeredRef.current) {
                    multiUserTriggeredRef.current = true;
                    showNudge(MULTI_USER_NUDGES);
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [usersCount, showNudge]);

    // ─── Action: Copy link or open share modal ──────────────────────────
    const handleAction = useCallback(async () => {
        if (onOpenShare) {
            onOpenShare();
            dismissNudge();
            return;
        }

        const url = buildShareUrl(viewport);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            console.log('[ShareNudge] Link copied:', url);
            setTimeout(() => dismissNudge('down'), 1500);
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => dismissNudge('down'), 1500);
            } catch (err) {
                console.error('[ShareNudge] Copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }, [viewport, onOpenShare, dismissNudge]);

    if (!nudge) return null;

    // Compute swipe transform
    const swipeTransform = isSwiping.current
        ? `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`
        : undefined;
    const swipeOpacity = isSwiping.current
        ? Math.max(0.3, 1 - (Math.abs(swipeOffset.x) + swipeOffset.y) / 200)
        : undefined;

    const exitClass = isExiting
        ? exitDirection === 'left'
            ? styles.exitLeft
            : exitDirection === 'right'
                ? styles.exitRight
                : styles.exitDown
        : '';

    return (
        <div
            ref={nudgeElRef}
            className={`${styles.nudge} ${exitClass}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={swipeTransform ? { transform: swipeTransform, opacity: swipeOpacity, transition: 'none' } : undefined}
        >
            {/* Emoji badge */}
            <span className={styles.emojiBadge}>{nudge.emoji}</span>

            {/* Text */}
            <span className={styles.nudgeLabel}>{nudge.text}</span>

            {/* Gradient CTA */}
            <button className={styles.ctaButton} onClick={handleAction}>
                {copied ? '✓ Copied!' : nudge.cta}
            </button>

            {/* Dismiss */}
            <button className={styles.dismissBtn} onClick={() => dismissNudge('down')} aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            {/* Swipe hint line */}
            <div className={styles.swipeHint} />
        </div>
    );
}
