'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './CountdownTimer.module.css';

interface CountdownTimerProps {
    resetIntervalHours?: number;
    serverStartTime?: number | null;
}

interface TimeLeft {
    hours: number;
    minutes: number;
    seconds: number;
}

export default function CountdownTimer({ resetIntervalHours = 24, serverStartTime }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0 });
    const [canvasStartTime, setCanvasStartTime] = useState<number | null>(null);

    // Sync with server time - this is the ONLY source of truth
    useEffect(() => {
        if (serverStartTime) {
            console.log('[Timer] Syncing with server time:', new Date(serverStartTime).toISOString());
            setCanvasStartTime(serverStartTime);
        }
    }, [serverStartTime]);

    // Calculate time left
    const calculateTimeLeft = useCallback((): TimeLeft => {
        if (!canvasStartTime) return { hours: 0, minutes: 0, seconds: 0 };

        const resetIntervalMs = resetIntervalHours * 60 * 60 * 1000;
        const elapsed = Date.now() - canvasStartTime;
        const remaining = Math.max(0, resetIntervalMs - elapsed);

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        return { hours, minutes, seconds };
    }, [canvasStartTime, resetIntervalHours]);

    // Update countdown every second
    useEffect(() => {
        if (!canvasStartTime) {
            console.log('[Timer] No start time yet...');
            return;
        }

        console.log('[Timer] Starting countdown with:', new Date(canvasStartTime).toISOString());

        const updateTimer = () => {
            const left = calculateTimeLeft();
            // console.log('[Timer] Tick:', left); // Verbose
            setTimeLeft(left);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [canvasStartTime, calculateTimeLeft]);

    // Format time with leading zeros
    const formatTime = (n: number): string => n.toString().padStart(2, '0');

    // Calculate progress percentage
    const getProgress = (): number => {
        if (!canvasStartTime) return 0;
        const resetIntervalMs = resetIntervalHours * 60 * 60 * 1000;
        const elapsed = Date.now() - canvasStartTime;
        return Math.min(100, (elapsed / resetIntervalMs) * 100);
    };

    const progress = getProgress();
    const isLowTime = timeLeft.hours === 0 && timeLeft.minutes < 30;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={`${styles.timer} ${isLowTime ? styles.warning : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, opacity: 0.7 }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className={styles.label}>Resets in</span>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.hours)}
                    </span>
                    <span className={styles.separator}>:</span>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.minutes)}
                    </span>
                    <span className={styles.separator}>:</span>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.seconds)}
                    </span>
                </div>
            </div>

        </div>
    );
}
