'use client';

import React, { useEffect, useState } from 'react';
import styles from './WelcomeHint.module.css';

export default function WelcomeHint() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Remove from DOM after animation completes (5s)
        const timer = setTimeout(() => {
            setVisible(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div className={styles.container}>
            This canvas resets every 24 hours. Anyone can draw. Be kind or be chaotic.
        </div>
    );
}
