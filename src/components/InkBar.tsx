'use client';

import React, { useEffect, useState } from 'react';
import { InkState } from '@/lib/InkManager';
import styles from './InkBar.module.css';

interface InkBarProps {
  inkState: InkState;
}

export default function InkBar({ inkState }: InkBarProps) {
  const [isLow, setIsLow] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    const lowThreshold = 20; // 20% is considered low
    const wasLow = isLow;
    const wasEmpty = isEmpty;

    setIsLow(inkState.percentage <= lowThreshold && inkState.percentage > 0);
    setIsEmpty(inkState.percentage === 0);

    // Show notification when transitioning to low or empty
    if (!wasEmpty && inkState.percentage === 0) {
      setNotificationMessage('Out of ink! Please wait for regeneration...');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } else if (!wasLow && inkState.percentage <= lowThreshold && inkState.percentage > 0) {
      setNotificationMessage('Ink running low!');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2500);
    }
  }, [inkState.percentage, isLow, isEmpty]);

  const getBarColor = () => {
    if (isEmpty) return '#dc2626'; // Red
    if (isLow) return '#f59e0b'; // Orange
    return '#10b981'; // Green
  };

  const getStatusText = () => {
    if (isEmpty) return 'Ink depleted! Waiting to regenerate...';
    if (isLow) return 'Ink running low!';
    return '';
  };

  return (
    <>
      <div className={styles.inkBarWrapper}>
        {/* Icon and Label */}
        <div className={styles.iconLabel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span className={styles.labelText}>Ink</span>
        </div>

        {/* Progress Bar */}
        <div className={styles.barContainer}>
          <div
            className={`${styles.barFill} ${isLow ? styles.low : ''} ${isEmpty ? styles.empty : ''}`}
            style={{
              width: `${inkState.percentage}%`,
              backgroundColor: getBarColor(),
            }}
          />
        </div>

        {/* Percentage Display */}
        <div className={styles.percentageDisplay}>
          {Math.round(inkState.percentage)}%
        </div>
      </div>

      {/* Notification Message */}
      {showNotification && (
        <div className={`${styles.notification} ${isEmpty ? styles.notificationEmpty : styles.notificationLow}`}>
          {notificationMessage}
        </div>
      )}
    </>
  );
}

