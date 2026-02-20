'use client';

import React from 'react';
import type { StreakState } from '@/types/streak';
import styles from './StreakBadge.module.css';

interface StreakBadgeProps {
  streakState: StreakState;
}

export default function StreakBadge({ streakState }: StreakBadgeProps) {
  const { currentStreak, longestStreak, drewToday, isNewStreakDay } = streakState;

  // First-time users see nothing until they draw
  if (currentStreak === 0 && !drewToday) return null;

  const stateClass = drewToday ? styles.active : styles.inactive;
  const celebrateClass = isNewStreakDay ? styles.celebrating : '';

  const tooltip = `Current streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}\nLongest streak: ${longestStreak} day${longestStreak !== 1 ? 's' : ''}`;

  return (
    <div
      className={`${styles.streakBadge} ${stateClass} ${celebrateClass}`}
      title={tooltip}
    >
      {isNewStreakDay && <span className={styles.ring} />}
      <span className={styles.fireIcon} role="img" aria-label="streak">
        {drewToday ? '\uD83D\uDD25' : '\u2B50'}
      </span>
      <span className={styles.count}>{currentStreak}</span>
      <span className={styles.label}>
        {currentStreak === 1 ? 'day' : 'days'}
      </span>
    </div>
  );
}
