'use client';

import { useEffect, useRef, useState } from 'react';
import { InkManager, InkState } from '@/lib/InkManager';

/**
 * React hook for managing ink stamina system
 */
export function useInkManager() {
  const inkManagerRef = useRef<InkManager | null>(null);
  const [inkState, setInkState] = useState<InkState>({
    current: 12000,
    max: 12000,
    percentage: 100,
    canDraw: true,
  });

  useEffect(() => {
    // Initialize InkManager
    const manager = new InkManager();
    inkManagerRef.current = manager;

    // Subscribe to ink state changes
    const unsubscribe = manager.subscribe((state) => {
      setInkState(state);
    });

    // Set initial state
    setInkState(manager.getState());

    // Cleanup on unmount
    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, []);

  return {
    inkState,
    inkManager: inkManagerRef.current,
  };
}

