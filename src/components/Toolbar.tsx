'use client';

import { useState, useEffect, useRef } from 'react';
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
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
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
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
}: ToolbarProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isVisible, setIsVisible] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-hide on mobile after 4 seconds of inactivity
    useEffect(() => {
        if (!isMobile || !isVisible) return;

        const resetTimer = () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
            hideTimerRef.current = setTimeout(() => {
                setIsVisible(false);
            }, 4000);
        };

        resetTimer();

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, [isMobile, isVisible]);

    // Reset auto-hide timer on interaction
    const handleInteraction = () => {
        if (!isMobile) return;
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 4000);
    };

    const showToolbar = () => {
        setIsVisible(true);
        setIsExpanded(true);
    };

    return (
        <>
            {/* Floating Action Button - shows when toolbar is hidden on mobile */}
            {isMobile && !isVisible && (
                <button
                    className={styles.fab}
                    onClick={showToolbar}
                    aria-label="Show toolbar"
                >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
                    </svg>
                </button>
            )}

            {/* Main Toolbar */}
            <div
                className={`${styles.toolbar} ${isExpanded ? styles.expanded : styles.collapsed} ${!isVisible ? styles.hidden : ''}`}
                onTouchStart={handleInteraction}
                onMouseMove={handleInteraction}
            >
                {/* Toggle button */}
                <button
                    className={styles.toggleButton}
                    onClick={() => {
                        setIsExpanded(!isExpanded);
                        handleInteraction();
                    }}
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
                            {usersCount} {usersCount === 1 ? 'artist' : 'Artists online'}
                        </span>
                    </div>



                    {/* Tool selection */}
                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Tool</span>
                        <div className={styles.toolButtons}>
                            <button
                                className={`${styles.toolButton} ${selectedTool === 'hand' ? styles.selected : ''}`}
                                onClick={() => onToolChange('hand')}
                                title="Hand (H / Space)"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16L8 16.3V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V3.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V1.5c0-.83.67-1.5 1.5-1.5S17.5.67 17.5 1.5V12h1v-6.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z" />
                                </svg>
                            </button>
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

                    {/* Undo/Redo buttons - in place of help text */}
                    {(onUndo || onRedo) && (
                        <div className={styles.section}>
                            <span className={styles.sectionLabel}>History</span>
                            <div className={styles.toolButtons}>
                                <button
                                    className={`${styles.toolButton} ${styles.undoRedoButton}`}
                                    onClick={onUndo}
                                    disabled={!canUndo}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                        <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                                    </svg>
                                </button>
                                <button
                                    className={`${styles.toolButton} ${styles.undoRedoButton}`}
                                    onClick={onRedo}
                                    disabled={!canRedo}
                                    title="Redo (Ctrl+Shift+Z)"
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                        <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
        </>
    );
}
