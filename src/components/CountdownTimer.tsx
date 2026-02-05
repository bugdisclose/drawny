'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './CountdownTimer.module.css';

interface CountdownTimerProps {
    resetIntervalHours?: number;
}

interface TimeLeft {
    hours: number;
    minutes: number;
    seconds: number;
}

export default function CountdownTimer({ resetIntervalHours = 24 }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0 });
    const [canvasStartTime, setCanvasStartTime] = useState<number | null>(null);

    // Get or initialize canvas start time from localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedStartTime = localStorage.getItem('drawny_canvas_start_time');
        const resetIntervalMs = resetIntervalHours * 60 * 60 * 1000;

        if (storedStartTime) {
            const startTime = parseInt(storedStartTime, 10);
            const elapsed = Date.now() - startTime;

            // Check if canvas should have reset
            if (elapsed >= resetIntervalMs) {
                // Start a new cycle
                const newStartTime = Date.now();
                localStorage.setItem('drawny_canvas_start_time', newStartTime.toString());
                setCanvasStartTime(newStartTime);
            } else {
                setCanvasStartTime(startTime);
            }
        } else {
            // First time - initialize start time
            const newStartTime = Date.now();
            localStorage.setItem('drawny_canvas_start_time', newStartTime.toString());
            setCanvasStartTime(newStartTime);
        }
    }, [resetIntervalHours]);

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
        if (!canvasStartTime) return;

        const updateTimer = () => {
            setTimeLeft(calculateTimeLeft());
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
                </div>
            </div>

        </div>
    );
}
