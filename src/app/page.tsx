'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { useInkManager } from '@/hooks/useInkManager';
import { COLORS, BrushSize, ToolType, SceneInitData } from '@/types';
import type { ViewportCoordinates } from '@/lib/deepLinkUtils';
import Toolbar from '@/components/Toolbar';
import CountdownTimer from '@/components/CountdownTimer';
import ConnectionStatus from '@/components/ConnectionStatus';
import WelcomeHint from '@/components/WelcomeHint';
import InkBar from '@/components/InkBar';
import ShareButton from '@/components/ShareButton';
import styles from './page.module.css';

// Dynamic import for ExcalidrawCanvas
const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.loadingSpinner}></div>
      <span>Loading canvas...</span>
    </div>
  ),
});

// Import types for dynamic component refs
import type { CaptureSnapshotFn, HistoryActions } from '@/components/ExcalidrawCanvas';

export default function Home() {
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState<BrushSize>('small');
  // Initialize with a supported tool path
  const [selectedTool, setSelectedTool] = useState<ToolType>('brush');
  const [startTime, setStartTime] = useState<number | null>(null);
  // Track current viewport for share feature
  const [viewport, setViewport] = useState<ViewportCoordinates | null>(null);

  // Snapshot ref — ExcalidrawCanvas populates this with a capture function
  const snapshotRef = useRef<CaptureSnapshotFn | null>(null);

  // History ref — ExcalidrawCanvas populates this with undo/redo functions
  const historyRef = useRef<HistoryActions | null>(null);

  const handleViewportChange = useCallback((vp: ViewportCoordinates) => {
    setViewport(vp);
  }, []);

  const handleCaptureSnapshot = useCallback(async (): Promise<string | null> => {
    if (snapshotRef.current) {
      return snapshotRef.current();
    }
    console.warn('[Page] Snapshot ref not available');
    return null;
  }, []);

  // Initialize ink manager
  const { inkState, inkManager } = useInkManager();

  // Handle users count update from socket
  const handleUsersCountChange = useCallback((count: number) => {
    // console.log('Users count:', count);
  }, []);

  // Handle scene init to sync timer
  const handleSceneInit = useCallback((data: SceneInitData) => {
    // console.log('Scene init received, start time:', data.startTime);
    if (data.startTime) {
      setStartTime(data.startTime);
    }
  }, []);

  const {
    socket,
    isConnected,
    isOfflineMode,
    isConnecting,
    usersCount,
    artistCount,
    reconnect,
  } = useSocket({
    onUsersCountChange: handleUsersCountChange,
    onSceneInit: handleSceneInit
  });

  // Tool change handlers
  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
  }, []);

  const handleSizeChange = useCallback((size: BrushSize) => {
    setSelectedSize(size);
  }, []);

  const handleToolChange = useCallback((tool: ToolType) => {
    setSelectedTool(tool);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current) {
      historyRef.current.undo();
    } else {
      console.warn('[Page] History ref not available for undo');
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyRef.current) {
      historyRef.current.redo();
    } else {
      console.warn('[Page] History ref not available for redo');
    }
  }, []);

  // Keyboard shortcuts (some handled by Excalidraw, but tool switching is ours)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b':
          handleToolChange('brush');
          break;
        case 'e':
          handleToolChange('eraser');
          break;
        case '1':
          handleSizeChange('small');
          break;
        case '2':
          handleSizeChange('medium');
          break;
        case '3':
          handleSizeChange('large');
          break;
        case 'h':
          handleToolChange('hand');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToolChange, handleSizeChange]);

  return (
    <main className={styles.main}>
      {/* Connection status banner - only show when actively trying to connect */}
      {!isOfflineMode && !isConnected && !isConnecting && (
        <ConnectionStatus
          isConnected={isConnected}
          usersCount={usersCount}
          onRetry={reconnect}
        />
      )}

      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoText}>drawny</span>
        <span className={styles.logoTag}>Draw with strangers.</span>
        {artistCount > 0 && (
          <span className={styles.artistBadge}>
            {artistCount < 10
              ? '✨ Many people are drawing today'
              : `🎨 ${artistCount} artists drew today`}
          </span>
        )}
      </div>

      {/* Sleek Top Bar - Gallery, Timer, Ink, and Share */}
      <div className={styles.topBar}>
        <Link href="/gallery" className={styles.galleryButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Gallery
        </Link>

        {/* Timer synced with server start time */}
        <CountdownTimer serverStartTime={startTime} />

        {/* Ink Bar - Shows ink stamina */}
        <InkBar inkState={inkState} />

        {/* Share Button - Mobile-friendly sharing with snapshot */}
        <ShareButton viewport={viewport} onCaptureSnapshot={handleCaptureSnapshot} />
      </div>

      <ExcalidrawCanvas
        activeTool={selectedTool}
        activeColor={selectedColor}
        activeSize={selectedSize}
        socket={socket}
        inkManager={inkManager}
        onViewportChange={handleViewportChange}
        snapshotRef={snapshotRef}
        historyRef={historyRef}
      />

      <Toolbar
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        selectedTool={selectedTool}
        usersCount={usersCount}
        isConnected={isConnected}
        onColorChange={handleColorChange}
        onSizeChange={handleSizeChange}
        onToolChange={handleToolChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={true}
        canRedo={true}
      />

      <WelcomeHint />
    </main>
  );
}
