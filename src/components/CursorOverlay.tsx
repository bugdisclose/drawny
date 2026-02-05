'use client';

import React, { useRef, useEffect } from 'react';
import styles from './CursorOverlay.module.css';

interface Cursor {
    id: string;
    x: number;
    y: number;
    color: string;
    lastUpdate: number;
}

interface CursorOverlayProps {
    cursors: Map<string, Cursor>;
    viewport: { x: number; y: number; zoom: number };
}

const ADJECTIVES = ['Happy', 'Swift', 'Bright', 'Calm', 'Wild', 'Silent', 'Bold', 'Jolly', 'Cosmic', 'Neon'];
const ANIMALS = ['Panda', 'Fox', 'Hawk', 'Bear', 'Wolf', 'Tiger', 'Lion', 'Eagle', 'Koala', 'Owl'];

// Generate a random pastel color for each user
const generateUserColor = (userId: string): string => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
};

const generateUserName = (userId: string): string => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const adj = ADJECTIVES[Math.abs(hash) % ADJECTIVES.length];
    const animal = ANIMALS[Math.abs(hash >> 3) % ANIMALS.length];
    return `${adj} ${animal}`;
};

export default function CursorOverlay({ cursors, viewport }: CursorOverlayProps) {
    const cursorRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Convert canvas coordinates to screen coordinates
    const canvasToScreen = (x: number, y: number) => {
        return {
            x: x * viewport.zoom - viewport.x,
            y: y * viewport.zoom - viewport.y,
        };
    };

    return (
        <div className={styles.overlay}>
            {Array.from(cursors.entries()).map(([id, cursor]) => {
                const screenPos = canvasToScreen(cursor.x, cursor.y);
                const color = cursor.color || generateUserColor(id);
                const name = generateUserName(id);

                // Check if cursor is stale (no update in 5 seconds)
                const isStale = Date.now() - cursor.lastUpdate > 5000;
                if (isStale) return null;

                return (
                    <div
                        key={id}
                        className={styles.cursor}
                        style={{
                            left: screenPos.x,
                            top: screenPos.y,
                            '--cursor-color': color,
                        } as React.CSSProperties}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            className={styles.cursorSvg}
                        >
                            <path
                                d="M5.65 3.68L20.28 10.46C21.05 10.8 21.05 11.89 20.28 12.23L14.84 14.5L11.55 21.32C11.23 22 10.23 21.9 10.04 21.18L4.28 5.07C4.06 4.23 4.92 3.44 5.65 3.68Z"
                                fill={color}
                                stroke="white"
                                strokeWidth="1.5"
                            />
                        </svg>
                        <div className={styles.cursorLabel}>
                            {name}
                        </div>
                        {/* <div
                            className={styles.cursorRing}
                            style={{ backgroundColor: color }}
                        /> */}
                    </div>
                );
            })}
        </div>
    );
}
