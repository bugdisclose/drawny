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
                <span className={styles.label}>Canvas resets in</span>
                <div className={`${styles.timer} ${isLowTime ? styles.warning : ''}`}>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.hours)}
                        <span className={styles.unitLabel}>h</span>
                    </span>
                    <span className={styles.separator}>:</span>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.minutes)}
                        <span className={styles.unitLabel}>m</span>
                    </span>
                    <span className={styles.separator}>:</span>
                    <span className={styles.timeUnit}>
                        {formatTime(timeLeft.seconds)}
                        <span className={styles.unitLabel}>s</span>
                    </span>
                </div>
            </div>
            <div className={styles.progressBar}>
                <div
                    className={`${styles.progressFill} ${isLowTime ? styles.warningFill : ''}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
