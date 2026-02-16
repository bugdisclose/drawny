'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

    // Mobile expandable pickers
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSizePicker, setShowSizePicker] = useState(false);

    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const sizePickerRef = useRef<HTMLDivElement>(null);

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close popups when clicking outside
    useEffect(() => {
        if (!isMobile) return;

        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node;
            if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(target)) {
                setShowColorPicker(false);
            }
            if (showSizePicker && sizePickerRef.current && !sizePickerRef.current.contains(target)) {
                setShowSizePicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMobile, showColorPicker, showSizePicker]);

    // Auto-hide on mobile after 4 seconds of inactivity
    useEffect(() => {
        if (!isMobile || !isVisible) return;

        const resetTimer = () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
            hideTimerRef.current = setTimeout(() => {
                setIsVisible(false);
                setShowColorPicker(false);
                setShowSizePicker(false);
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
    const handleInteraction = useCallback(() => {
        if (!isMobile) return;
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
            setShowColorPicker(false);
            setShowSizePicker(false);
        }, 4000);
    }, [isMobile]);

    const showToolbar = () => {
        setIsVisible(true);
        setIsExpanded(true);
    };

    const handleColorToggle = useCallback(() => {
        setShowColorPicker(prev => !prev);
        setShowSizePicker(false);
        handleInteraction();
    }, [handleInteraction]);

    const handleSizeToggle = useCallback(() => {
        setShowSizePicker(prev => !prev);
        setShowColorPicker(false);
        handleInteraction();
    }, [handleInteraction]);

    const handleColorSelect = useCallback((color: string) => {
        onColorChange(color);
        setShowColorPicker(false);
        handleInteraction();
    }, [onColorChange, handleInteraction]);

    const handleSizeSelect = useCallback((size: BrushSize) => {
        onSizeChange(size);
        setShowSizePicker(false);
        handleInteraction();
    }, [onSizeChange, handleInteraction]);

    // ─── Shared SVG icons ───────────────────────────────────────────────
    const HandIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16L8 16.3V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V3.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V1.5c0-.83.67-1.5 1.5-1.5S17.5.67 17.5 1.5V12h1v-6.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z" />
        </svg>
    );

    const BrushIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
        </svg>
    );

    const EraserIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.78-.78 2.05 0 2.83l4.24 4.24c.78.78 2.05.78 2.83 0l7.07-7.07 5.66-5.66c.78-.78.78-2.05 0-2.83L18.04 3.6c-.39-.39-.9-.6-1.41-.6h-.49zM11.75 17l-4.95 4.95-4.24-4.24L6.8 13.47l4.95 4.95v-1.42z" />
        </svg>
    );

    const UndoIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
        </svg>
    );

    const RedoIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
        </svg>
    );

    // ─── Mobile Horizontal Toolbar ──────────────────────────────────────
    if (isMobile) {
        return (
            <>
                {/* FAB — shows when toolbar is hidden */}
                {!isVisible && (
                    <button
                        className={styles.fab}
                        onClick={showToolbar}
                        aria-label="Show toolbar"
                    >
                        <BrushIcon />
                    </button>
                )}

                {/* Mobile horizontal toolbar */}
                <div
                    className={`${styles.mobileToolbar} ${!isVisible ? styles.mobileHidden : ''}`}
                    onTouchStart={handleInteraction}
                >
                    {isExpanded ? (
                        <div className={styles.mobileRow}>
                            {/* Hand */}
                            <button
                                className={`${styles.mBtn} ${selectedTool === 'hand' ? styles.mBtnActive : ''}`}
                                onClick={() => { onToolChange('hand'); handleInteraction(); }}
                                aria-label="Hand tool"
                            >
                                <HandIcon />
                            </button>

                            {/* Brush */}
                            <button
                                className={`${styles.mBtn} ${selectedTool === 'brush' ? styles.mBtnActive : ''}`}
                                onClick={() => { onToolChange('brush'); handleInteraction(); }}
                                aria-label="Brush tool"
                            >
                                <BrushIcon />
                            </button>

                            {/* Eraser */}
                            <button
                                className={`${styles.mBtn} ${selectedTool === 'eraser' ? styles.mBtnActive : ''}`}
                                onClick={() => { onToolChange('eraser'); handleInteraction(); }}
                                aria-label="Eraser tool"
                            >
                                <EraserIcon />
                            </button>

                            {/* Divider */}
                            <div className={styles.mDivider} />

                            {/* Color swatch (expandable) */}
                            <div className={styles.mPickerWrap} ref={colorPickerRef}>
                                <button
                                    className={`${styles.mBtn} ${showColorPicker ? styles.mBtnActive : ''}`}
                                    onClick={handleColorToggle}
                                    aria-label="Color picker"
                                >
                                    <span
                                        className={styles.mColorSwatch}
                                        style={{ backgroundColor: selectedColor }}
                                    />
                                </button>
                                {showColorPicker && (
                                    <div className={styles.mPopup}>
                                        <div className={styles.mColorGrid}>
                                            {COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    className={`${styles.mColorDot} ${selectedColor === color ? styles.mColorDotActive : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => handleColorSelect(color)}
                                                    aria-label={`Color ${color}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Size dot (expandable) */}
                            <div className={styles.mPickerWrap} ref={sizePickerRef}>
                                <button
                                    className={`${styles.mBtn} ${showSizePicker ? styles.mBtnActive : ''}`}
                                    onClick={handleSizeToggle}
                                    aria-label="Brush size"
                                >
                                    <span
                                        className={styles.mSizeDot}
                                        style={{
                                            width: `${Math.min(BRUSH_SIZES[selectedSize], 20)}px`,
                                            height: `${Math.min(BRUSH_SIZES[selectedSize], 20)}px`,
                                            backgroundColor: selectedTool === 'eraser' ? '#888' : selectedColor,
                                        }}
                                    />
                                </button>
                                {showSizePicker && (
                                    <div className={styles.mPopup}>
                                        <div className={styles.mSizeRow}>
                                            {(Object.keys(BRUSH_SIZES) as BrushSize[]).map((size) => (
                                                <button
                                                    key={size}
                                                    className={`${styles.mSizeOption} ${selectedSize === size ? styles.mSizeOptionActive : ''}`}
                                                    onClick={() => handleSizeSelect(size)}
                                                    aria-label={`Size ${size}`}
                                                >
                                                    <span
                                                        className={styles.mSizeDot}
                                                        style={{
                                                            width: `${Math.min(BRUSH_SIZES[size], 20)}px`,
                                                            height: `${Math.min(BRUSH_SIZES[size], 20)}px`,
                                                            backgroundColor: selectedTool === 'eraser' ? '#888' : selectedColor,
                                                        }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className={styles.mDivider} />

                            {/* Undo */}
                            <button
                                className={`${styles.mBtn} ${styles.mUndoRedo}`}
                                onClick={() => { onUndo?.(); handleInteraction(); }}
                                disabled={!canUndo}
                                aria-label="Undo"
                            >
                                <UndoIcon />
                            </button>

                            {/* Redo */}
                            <button
                                className={`${styles.mBtn} ${styles.mUndoRedo}`}
                                onClick={() => { onRedo?.(); handleInteraction(); }}
                                disabled={!canRedo}
                                aria-label="Redo"
                            >
                                <RedoIcon />
                            </button>

                            {/* Collapse */}
                            <button
                                className={`${styles.mBtn} ${styles.mCollapse}`}
                                onClick={() => { setIsExpanded(false); handleInteraction(); }}
                                aria-label="Collapse toolbar"
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        /* Collapsed: just the expand button */
                        <button
                            className={styles.mExpandBtn}
                            onClick={() => { setIsExpanded(true); handleInteraction(); }}
                            aria-label="Expand toolbar"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                            </svg>
                        </button>
                    )}
                </div>
            </>
        );
    }

    // ─── Desktop Vertical Toolbar (unchanged) ───────────────────────────
    return (
        <div
            className={`${styles.toolbar} ${isExpanded ? styles.expanded : styles.collapsed}`}
        >
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
                                <HandIcon />
                            </button>
                            <button
                                className={`${styles.toolButton} ${selectedTool === 'brush' ? styles.selected : ''}`}
                                onClick={() => onToolChange('brush')}
                                title="Brush (B)"
                            >
                                <BrushIcon />
                            </button>
                            <button
                                className={`${styles.toolButton} ${selectedTool === 'eraser' ? styles.selected : ''}`}
                                onClick={() => onToolChange('eraser')}
                                title="Eraser (E)"
                            >
                                <EraserIcon />
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

                    {/* Brush size */}
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

                    {/* Undo/Redo */}
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
                                    <UndoIcon />
                                </button>
                                <button
                                    className={`${styles.toolButton} ${styles.undoRedoButton}`}
                                    onClick={onRedo}
                                    disabled={!canRedo}
                                    title="Redo (Ctrl+Shift+Z)"
                                >
                                    <RedoIcon />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
