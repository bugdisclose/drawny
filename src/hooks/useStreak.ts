'use client';

import { useEffect, useRef, useState } from 'react';
import { StreakManager } from '@/lib/StreakManager';
import type { StreakState } from '@/types/streak';

const INITIAL_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastDrawDate: '',
  drewToday: false,
  isNewStreakDay: false,
};

export function useStreak() {
  const streakManagerRef = useRef<StreakManager | null>(null);
  const [streakState, setStreakState] = useState<StreakState>(INITIAL_STATE);

  useEffect(() => {
    const manager = new StreakManager();
    streakManagerRef.current = manager;

    const unsubscribe = manager.subscribe((state) => {
      setStreakState(state);
    });

    // Sync initial state from cookie
    setStreakState(manager.getState());

    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, []);

  return {
    streakState,
    streakManager: streakManagerRef.current,
  };
}
