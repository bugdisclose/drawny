'use client';

import React, { useState } from 'react';
import { COLORS, BRUSH_SIZES, BrushSize, ToolType } from '@/types';
import styles from './Toolbar.module.css';

interface ToolbarProps {
    selectedColor: string;
    selectedSize: BrushSize;
    selectedTool: ToolType;
    usersCount: number;
    isConnected: boolean;
    onColorChange: (color: string) => void;
    onSizeChange: (size: BrushSize) => void;
    onToolChange: (tool: ToolType) => void;
}

export default function Toolbar({
    selectedColor,
    selectedSize,
    selectedTool,
    usersCount,
    isConnected,
    onColorChange,
    onSizeChange,
    onToolChange,
}: ToolbarProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const sizeLabels: Record<BrushSize, string> = {
        small: 'S',
        medium: 'M',
        large: 'L',
    };

    return (
        <div className={`${styles.toolbar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            {/* Toggle button */}
            <button
                className={styles.toggleButton}
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
            >
                {isExpanded ? '◀' : '▶'}
            </button>

            {isExpanded && (
                <>
                    {/* Connection status */}
                    <div className={styles.statusSection}>
                        <div className={`${styles.connectionDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                        <span className={styles.usersCount}>
                            {usersCount} {usersCount === 1 ? 'artist' : 'artists'}
                        </span>
                    </div>

                    {/* Tool selection */}
                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Tool</span>
                        <div className={styles.toolButtons}>
                            <button
                                className={`${styles.toolButton} ${selectedTool === 'brush' ? styles.selected : ''}`}
                                onClick={() => onToolChange('brush')}
                                title="Brush (B)"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
                                </svg>
                            </button>
                            <button
                                className={`${styles.toolButton} ${selectedTool === 'eraser' ? styles.selected : ''}`}
                                onClick={() => onToolChange('eraser')}
                                title="Eraser (E)"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.78-.78 2.05 0 2.83l4.24 4.24c.78.78 2.05.78 2.83 0l7.07-7.07 5.66-5.66c.78-.78.78-2.05 0-2.83L18.04 3.6c-.39-.39-.9-.6-1.41-.6h-.49zM11.75 17l-4.95 4.95-4.24-4.24L6.8 13.47l4.95 4.95v-1.42z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Color palette */}
                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Color</span>
                        <div className={styles.colorPalette}>
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    className={`${styles.colorButton} ${selectedColor === color ? styles.selected : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => onColorChange(color)}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Brush size with visual preview */}
                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Size</span>
                        <div className={styles.sizeButtons}>
                            {(Object.keys(BRUSH_SIZES) as BrushSize[]).map((size) => (
                                <button
                                    key={size}
                                    className={`${styles.sizeButton} ${selectedSize === size ? styles.selected : ''}`}
                                    onClick={() => onSizeChange(size)}
                                    title={`${size} (${BRUSH_SIZES[size]}px)`}
                                >
                                    <span
                                        className={styles.sizeDot}
                                        style={{
                                            width: `${Math.min(BRUSH_SIZES[size], 24)}px`,
                                            height: `${Math.min(BRUSH_SIZES[size], 24)}px`,
                                            backgroundColor: selectedTool === 'eraser' ? '#888' : selectedColor,
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Help text */}
                    <div className={styles.helpSection}>
                        <div className={styles.helpText}>Space + drag to pan</div>
                        <div className={styles.helpText}>Scroll to zoom</div>
                    </div>
                </>
            )}
        </div>
    );
}
