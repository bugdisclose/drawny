'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildShareUrl, type ViewportCoordinates } from '@/lib/deepLinkUtils';
import styles from './ShareNudge.module.css';

// ─── Nudge messages — contextual, playful, varied ─────────────────────
const ZOOM_NUDGES = [
    { text: 'Like this spot?', cta: 'Invite friends here 📍', emoji: '📍' },
    { text: 'Building something?', cta: 'Get backup ⚡', emoji: '⚡' },
    { text: 'Found something wild?', cta: 'Share this spot 👀', emoji: '👀' },
];

const DRAW_NUDGES = [
    { text: 'Nice work!', cta: 'Show it off 🎨', emoji: '🎨' },
    { text: "Your art won't last forever", cta: "Share before it's gone ⏳", emoji: '⏳' },
];

const MULTI_USER_NUDGES = [
    { text: `Others are drawing nearby`, cta: 'Rally more artists 🤝', emoji: '🤝' },
    { text: 'The canvas is alive', cta: 'Bring your crew ⚡', emoji: '⚡' },
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
const ZOOM_THRESHOLD = 1.5; // Zoom level that triggers nudge
const ZOOM_SETTLE_MS = 3_000; // Wait 3s after zoom settles
const DRAW_TIME_TRIGGER_MS = 90_000; // 90s of accumulated time

export default function ShareNudge({ viewport, usersCount, onOpenShare }: ShareNudgeProps) {
    const [nudge, setNudge] = useState<{ text: string; cta: string; emoji: string } | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [copied, setCopied] = useState(false);

    // Session tracking refs (persist across renders, not serialized)
    const nudgeCountRef = useRef(0);
    const lastNudgeTimeRef = useRef(0);
    const lastZoomRef = useRef(1);
    const zoomSettleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionStartRef = useRef(Date.now());
    const drawTimeTriggeredRef = useRef(false);
    const multiUserTriggeredRef = useRef(false);
    const zoomTriggeredZoomLevels = useRef(new Set<number>());

    // Pick a random message from a pool
    const pickNudge = useCallback((pool: typeof ZOOM_NUDGES) => {
        return pool[Math.floor(Math.random() * pool.length)];
    }, []);

    // Can we show a nudge right now?
    const canShowNudge = useCallback(() => {
        if (nudge) return false; // Already showing
        if (nudgeCountRef.current >= MAX_NUDGES_PER_SESSION) return false;
        const elapsed = Date.now() - lastNudgeTimeRef.current;
        if (lastNudgeTimeRef.current > 0 && elapsed < COOLDOWN_MS) return false;
        return true;
    }, [nudge]);

    // Show a nudge
    const showNudge = useCallback((pool: typeof ZOOM_NUDGES) => {
        if (!canShowNudge()) return;
        const picked = pickNudge(pool);
        setNudge(picked);
        setCopied(false);
        setIsExiting(false);
        nudgeCountRef.current++;
        lastNudgeTimeRef.current = Date.now();
        console.log(`[ShareNudge] Showing: "${picked.text} ${picked.cta}" (${nudgeCountRef.current}/${MAX_NUDGES_PER_SESSION})`);
    }, [canShowNudge, pickNudge]);

    // Dismiss the nudge
    const dismissNudge = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => {
            setNudge(null);
            setIsExiting(false);
        }, 300);
        if (autoDismissTimerRef.current) {
            clearTimeout(autoDismissTimerRef.current);
            autoDismissTimerRef.current = null;
        }
    }, []);

    // Auto-dismiss timer
    useEffect(() => {
        if (!nudge) return;
        autoDismissTimerRef.current = setTimeout(dismissNudge, AUTO_DISMISS_MS);
        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
            }
        };
    }, [nudge, dismissNudge]);

    // ─── Trigger 1: Zoom-in detection ───────────────────────────────────
    useEffect(() => {
        if (!viewport) return;
        const currentZoom = viewport.zoom;

        // Only trigger when zoom crosses above threshold
        if (currentZoom >= ZOOM_THRESHOLD && lastZoomRef.current < ZOOM_THRESHOLD) {
            // Round to 1 decimal to avoid re-triggering at same level
            const roundedZoom = Math.round(currentZoom * 10);
            if (zoomTriggeredZoomLevels.current.has(roundedZoom)) {
                lastZoomRef.current = currentZoom;
                return;
            }

            // Clear previous settle timer
            if (zoomSettleTimerRef.current) {
                clearTimeout(zoomSettleTimerRef.current);
            }

            // Wait for zoom to settle
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

    // ─── Trigger 2: Drawing time (session duration as proxy) ────────────
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
            // Wait a bit before showing, don't pile on immediately
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

        // Fallback: copy link to clipboard
        const url = buildShareUrl(viewport);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            console.log('[ShareNudge] Link copied:', url);
            setTimeout(dismissNudge, 1500);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(dismissNudge, 1500);
            } catch (err) {
                console.error('[ShareNudge] Copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }, [viewport, onOpenShare, dismissNudge]);

    if (!nudge) return null;

    return (
        <div className={`${styles.nudge} ${isExiting ? styles.nudgeExit : ''}`}>
            <div className={styles.nudgeContent}>
                <span className={styles.nudgeEmoji}>{nudge.emoji}</span>
                <div className={styles.nudgeText}>
                    <span className={styles.nudgeLabel}>{nudge.text}</span>
                    <button className={styles.nudgeCta} onClick={handleAction}>
                        {copied ? '✓ Link Copied!' : nudge.cta}
                    </button>
                </div>
                <button className={styles.nudgeDismiss} onClick={dismissNudge} aria-label="Dismiss">
                    ×
                </button>
            </div>
        </div>
    );
}
