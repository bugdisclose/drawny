'use client';

import React from 'react';
import styles from './ConnectionStatus.module.css';

interface ConnectionStatusProps {
    isConnected: boolean;
    usersCount: number;
    onRetry?: () => void;
}

export default function ConnectionStatus({
    isConnected,
    usersCount,
    onRetry
}: ConnectionStatusProps) {
    if (isConnected) {
        return null; // Don't show anything when connected - status shown in toolbar
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.icon}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l10.08 12.56c.8 1 2.32 1 3.12 0L23.64 7z" opacity="0.3" />
                        <path d="M12 3C5.28 3 .81 6.66.36 7l10.08 12.56c.8 1 2.32 1 3.12 0L23.64 7c-.45-.34-4.93-4-11.64-4zm0 2c4.71 0 8.4 2.29 9.45 3.2L12 18.5 2.55 8.2C3.6 7.29 7.29 5 12 5z" />
                        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </div>
                <div className={styles.text}>
                    <span className={styles.title}>Connection Lost</span>
                    <span className={styles.subtitle}>
                        Your drawings are saved locally. Reconnecting...
                    </span>
                </div>
                {onRetry && (
                    <button onClick={onRetry} className={styles.retryButton}>
                        Retry
                    </button>
                )}
            </div>
            <div className={styles.progressBar}>
                <div className={styles.progressAnimation} />
            </div>
        </div>
    );
}
