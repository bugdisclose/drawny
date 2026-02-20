'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { StreakState } from '@/types/streak';
import styles from './OnboardingFlow.module.css';

// --- localStorage helpers ---

const STORAGE_KEY = 'drawny_onboarding';

interface OnboardingSeen {
  welcome: boolean;
  streak: boolean;
  archive: boolean;
}

function readSeen(): OnboardingSeen {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        welcome: !!parsed.welcome,
        streak: !!parsed.streak,
        archive: !!parsed.archive,
      };
    }
  } catch {
    // ignore
  }
  return { welcome: false, streak: false, archive: false };
}

function markSeen(key: keyof OnboardingSeen) {
  const current = readSeen();
  current[key] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

// --- HintBubble sub-component ---

interface HintBubbleProps {
  icon: string;
  message: string;
  position: 'center' | 'topBar';
  onDismiss: () => void;
}

function HintBubble({ icon, message, position, onDismiss }: HintBubbleProps) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 300); // match fade-out duration
  }, [onDismiss]);

  const posClass = position === 'center' ? styles.center : styles.topBar;

  return (
    <div
      className={`${styles.hintBubble} ${posClass} ${exiting ? styles.exiting : ''}`}
    >
      <div className={styles.hintContent}>
        <div className={styles.hintIcon}>{icon}</div>
        <div className={styles.hintText}>{message}</div>
        <button
          className={styles.dismissButton}
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// --- OnboardingFlow ---

type Stage = 'idle' | 'welcome' | 'streak' | 'archive' | 'done';

interface OnboardingFlowProps {
  streakState: StreakState;
  serverStartTime: number | null;
}

export default function OnboardingFlow({ streakState, serverStartTime }: OnboardingFlowProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const seenRef = useRef<OnboardingSeen>({ welcome: false, streak: false, archive: false });
  const mountTimeRef = useRef<number>(Date.now());
  // Track whether streak hint has been triggered (prevents re-triggering)
  const streakTriggeredRef = useRef(false);

  // Read localStorage on mount
  useEffect(() => {
    const seen = readSeen();
    seenRef.current = seen;
    if (seen.welcome && seen.streak && seen.archive) {
      setStage('done');
    }
  }, []);

  // --- Welcome stage ---
  useEffect(() => {
    if (stage !== 'idle' || seenRef.current.welcome) return;

    const showTimer = setTimeout(() => {
      setStage('welcome');
    }, 800);

    return () => clearTimeout(showTimer);
  }, [stage]);

  // Welcome auto-dismiss after 6s
  useEffect(() => {
    if (stage !== 'welcome') return;

    const timer = setTimeout(() => {
      markSeen('welcome');
      seenRef.current.welcome = true;
      setStage('idle');
    }, 6000);

    return () => clearTimeout(timer);
  }, [stage]);

  // --- Streak stage ---
  useEffect(() => {
    if (streakTriggeredRef.current) return;
    if (seenRef.current.streak) return;
    if (stage !== 'idle') return;
    if (!streakState.isNewStreakDay || streakState.currentStreak !== 1) return;

    // Ensure at least 8s since mount
    const elapsed = Date.now() - mountTimeRef.current;
    const delay = Math.max(0, 8000 - elapsed);

    streakTriggeredRef.current = true;

    const timer = setTimeout(() => {
      // Re-check nothing else took over
      setStage((prev) => (prev === 'idle' ? 'streak' : prev));
    }, delay);

    return () => clearTimeout(timer);
  }, [streakState.isNewStreakDay, streakState.currentStreak, stage]);

  // Streak auto-dismiss after 5s
  useEffect(() => {
    if (stage !== 'streak') return;

    const timer = setTimeout(() => {
      markSeen('streak');
      seenRef.current.streak = true;
      setStage('idle');
    }, 5000);

    return () => clearTimeout(timer);
  }, [stage]);

  // --- Archive stage ---
  useEffect(() => {
    if (seenRef.current.archive) return;
    if (stage !== 'idle') return;

    // Wait for 45s of engagement from mount
    const elapsed = Date.now() - mountTimeRef.current;
    const delay = Math.max(0, 45000 - elapsed);

    const timer = setTimeout(() => {
      setStage((prev) => (prev === 'idle' ? 'archive' : prev));
    }, delay);

    return () => clearTimeout(timer);
  }, [stage]);

  // Archive auto-dismiss after 6s
  useEffect(() => {
    if (stage !== 'archive') return;

    const timer = setTimeout(() => {
      markSeen('archive');
      seenRef.current.archive = true;
      setStage('done');
    }, 6000);

    return () => clearTimeout(timer);
  }, [stage]);

  // --- Dismiss handlers ---
  const handleWelcomeDismiss = useCallback(() => {
    markSeen('welcome');
    seenRef.current.welcome = true;
    setStage('idle');
  }, []);

  const handleStreakDismiss = useCallback(() => {
    markSeen('streak');
    seenRef.current.streak = true;
    setStage('idle');
  }, []);

  const handleArchiveDismiss = useCallback(() => {
    markSeen('archive');
    seenRef.current.archive = true;
    setStage('done');
  }, []);

  // --- Render ---
  if (stage === 'idle' || stage === 'done') return null;

  if (stage === 'welcome') {
    return (
      <HintBubble
        icon="✨"
        message="Others are drawing right now! Tap anywhere to join."
        position="center"
        onDismiss={handleWelcomeDismiss}
      />
    );
  }

  if (stage === 'streak') {
    return (
      <HintBubble
        icon="🔥"
        message="Streak started! Draw daily to keep it going."
        position="topBar"
        onDismiss={handleStreakDismiss}
      />
    );
  }

  if (stage === 'archive') {
    let timeText = 'soon';
    if (serverStartTime) {
      const resetMs = 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, resetMs - (Date.now() - serverStartTime));
      const hours = Math.floor(remaining / 3_600_000);
      const minutes = Math.floor((remaining % 3_600_000) / 60_000);
      timeText = `${hours}h ${minutes}m`;
    }

    return (
      <HintBubble
        icon="🖼️"
        message={`This canvas archives in ${timeText} — past art lives in the Gallery`}
        position="topBar"
        onDismiss={handleArchiveDismiss}
      />
    );
  }

  return null;
}
