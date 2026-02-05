'use client';

import React, { useEffect, useState } from 'react';
import styles from './WelcomeHint.module.css';

export default function WelcomeHint() {
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if user has seen the hint before
        const hasSeenHint = localStorage.getItem('drawny_seen_hint');

        if (!hasSeenHint) {
            // Show hint after a brief delay for better UX
            const showTimer = setTimeout(() => {
                setVisible(true);
            }, 800);

            // Auto-hide after 8 seconds
            const hideTimer = setTimeout(() => {
                setVisible(false);
                localStorage.setItem('drawny_seen_hint', 'true');
            }, 8800);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        setVisible(false);
        localStorage.setItem('drawny_seen_hint', 'true');
    };

    if (!visible || dismissed) return null;

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.icon}>✨</div>
                <div className={styles.text}>
                    <strong>Welcome to the Drawny!</strong>
                    <p>Draw anything. Everyone shares this space. Canvas resets every 24 hours.</p>
                </div>
                <button className={styles.closeButton} onClick={handleDismiss} aria-label="Dismiss">
                    ×
                </button>
            </div>
        </div>
    );
}
