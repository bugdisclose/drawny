'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DrawingEngine } from '@/lib/DrawingEngine';
import { useSocket } from '@/hooks/useSocket';
import { Stroke, COLORS, BrushSize, ToolType, CursorData } from '@/types';
import Toolbar from '@/components/Toolbar';
import CountdownTimer from '@/components/CountdownTimer';
import ConnectionStatus from '@/components/ConnectionStatus';
import WelcomeHint from '@/components/WelcomeHint';
import styles from './page.module.css';

// Dynamic import for Canvas to avoid SSR issues
const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.loadingSpinner}></div>
      <span>Loading canvas...</span>
    </div>
  ),
});

// Dynamic import for CursorOverlay
const CursorOverlay = dynamic(() => import('@/components/CursorOverlay'), { ssr: false });

interface Cursor {
  id: string;
  x: number;
  y: number;
  color: string;
  lastUpdate: number;
}

export default function Home() {
  const engineRef = useRef<DrawingEngine | null>(null);
  const pendingStrokesRef = useRef<Stroke[] | null>(null); // Queue strokes until engine ready
  const [engineReady, setEngineReady] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState<BrushSize>('medium');
  const [selectedTool, setSelectedTool] = useState<ToolType>('brush');
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Undo/Redo state - track user's own strokes
  const [userStrokes, setUserStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [allStrokes, setAllStrokes] = useState<Stroke[]>([]);

  // Poll for engine availability and draw pending strokes
  useEffect(() => {
    const checkEngine = setInterval(() => {
      if (engineRef.current && pendingStrokesRef.current) {
        console.log('[page] Engine ready, drawing', pendingStrokesRef.current.length, 'pending strokes');
        engineRef.current.clear();
        engineRef.current.drawStrokes(pendingStrokesRef.current);
        pendingStrokesRef.current = null;
        setEngineReady(true);
        clearInterval(checkEngine);
      }
    }, 100);

    return () => clearInterval(checkEngine);
  }, []);

  // Clean up stale cursors every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => {
        const now = Date.now();
        const updated = new Map(prev);
        for (const [id, cursor] of updated) {
          if (now - cursor.lastUpdate > 10000) {
            updated.delete(id);
          }
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle incoming strokes from other users
  const handleStrokeReceived = useCallback((stroke: Stroke) => {
    setAllStrokes(prev => {
      const existing = prev.find(s => s.id === stroke.id);
      if (existing) {
        return prev.map(s => s.id === stroke.id ? stroke : s);
      }
      return [...prev, stroke];
    });

    if (engineRef.current) {
      // Don't draw our own strokes (they're already drawn locally)
      if (stroke.userId !== engineRef.current.getUserId()) {
        engineRef.current.drawStroke(stroke);
      }
    }
  }, []);

  // Handle stroke deletion
  const handleStrokeDeleted = useCallback((strokeId: string) => {
    console.log('[page] Stroke deleted:', strokeId);

    setAllStrokes(prev => {
      const remainingStrokes = prev.filter(s => s.id !== strokeId);

      // Redraw canvas without the deleted stroke
      if (engineRef.current) {
        engineRef.current.clear();
        engineRef.current.drawStrokes(remainingStrokes);
      }

      return remainingStrokes;
    });

    setUserStrokes(prev => prev.filter(s => s.id !== strokeId));
  }, []);

  // Handle canvas sync from server
  const handleCanvasSync = useCallback((strokes: Stroke[]) => {
    console.log('[page] Canvas sync received with', strokes.length, 'strokes, engine ready:', !!engineRef.current);
    setAllStrokes(strokes);

    // Set user's own strokes for undo/redo
    if (engineRef.current) {
      const userId = engineRef.current.getUserId();
      setUserStrokes(strokes.filter(s => s.userId === userId));
    }

    if (engineRef.current) {
      engineRef.current.clear();
      engineRef.current.drawStrokes(strokes);
    } else {
      // Queue strokes for when engine is ready
      console.log('[page] Engine not ready, queuing strokes');
      pendingStrokesRef.current = strokes;
    }
  }, []);

  // Handle canvas reset
  const handleCanvasReset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.clear();
    }
    // Server will send the new start time via canvas:state event
    console.log('[page] Canvas reset, waiting for server state update');
  }, []);

  const [serverStartTime, setServerStartTime] = useState<number | null>(null);

  const handleCanvasState = useCallback((state: { startTime: number }) => {
    console.log('[page] Received server start time:', new Date(state.startTime).toISOString());
    setServerStartTime(state.startTime);
  }, []);

  // Handle cursor updates from other users
  const handleCursorUpdate = useCallback((cursor: Cursor) => {
    // Don't show our own cursor
    if (engineRef.current && cursor.id !== engineRef.current.getUserId()) {
      setCursors(prev => {
        const updated = new Map(prev);
        updated.set(cursor.id, cursor);
        return updated;
      });
    }
  }, []);

  // Handle cursor removal
  const handleCursorRemove = useCallback((userId: string) => {
    setCursors(prev => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
  }, []);

  const {
    isConnected,
    isOfflineMode,
    usersCount,
    sendStrokeStart,
    sendStrokeUpdate,
    sendStrokeEnd,
    sendStrokeDelete,
    sendCursorMove,
    reconnect,
  } = useSocket({
    onStrokeReceived: handleStrokeReceived,
    onStrokeDeleted: handleStrokeDeleted,
    onCanvasSync: handleCanvasSync,
    onCanvasState: handleCanvasState,
    onCanvasReset: handleCanvasReset,
    onCursorUpdate: handleCursorUpdate,
    onCursorRemove: handleCursorRemove,
  });

  // Stroke callbacks
  const handleStrokeStart = useCallback((stroke: Stroke) => {
    sendStrokeStart(stroke);
  }, [sendStrokeStart]);

  const handleStrokeUpdate = useCallback((stroke: Stroke) => {
    sendStrokeUpdate(stroke);
  }, [sendStrokeUpdate]);

  const handleStrokeEnd = useCallback((stroke: Stroke) => {
    sendStrokeEnd(stroke);
    // Add to user's stroke history for undo
    setUserStrokes(prev => [...prev, stroke]);
    setAllStrokes(prev => [...prev, stroke]);
    // Clear redo stack when new stroke is made
    setUndoneStrokes([]);
  }, [sendStrokeEnd]);

  // Undo/Redo functions
  const handleUndo = useCallback(() => {
    setUserStrokes(prev => {
      if (prev.length === 0) return prev;

      const lastStroke = prev[prev.length - 1];
      console.log('[page] Undo stroke:', lastStroke.id);

      // Add to undone stack
      setUndoneStrokes(undone => [...undone, lastStroke]);

      // Send delete to server
      if (engineRef.current) {
        sendStrokeDelete(lastStroke.id, engineRef.current.getUserId());
      }

      // Remove from user strokes
      return prev.slice(0, -1);
    });
  }, [sendStrokeDelete]);

  const handleRedo = useCallback(() => {
    setUndoneStrokes(prev => {
      if (prev.length === 0) return prev;

      const strokeToRedo = prev[prev.length - 1];
      console.log('[page] Redo stroke:', strokeToRedo.id);

      // Add back to user strokes
      setUserStrokes(userStrokes => [...userStrokes, strokeToRedo]);

      // Re-send to server
      sendStrokeEnd(strokeToRedo);

      // Remove from undone stack
      return prev.slice(0, -1);
    });
  }, [sendStrokeEnd]);

  // Handle cursor movement (throttled)
  const lastCursorUpdate = useRef(0);
  const handleCursorMove = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorUpdate.current < 50) return; // Throttle to 20fps
    lastCursorUpdate.current = now;

    if (engineRef.current) {
      sendCursorMove({
        userId: engineRef.current.getUserId(),
        x,
        y,
        color: selectedColor,
      });
    }
  }, [sendCursorMove, selectedColor]);

  // Handle viewport changes from canvas
  const handleViewportChange = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    setViewport(newViewport);
  }, []);

  // Tool change handlers
  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
    engineRef.current?.setColor(color);
  }, []);

  const handleSizeChange = useCallback((size: BrushSize) => {
    setSelectedSize(size);
    engineRef.current?.setBrushSize(size);
  }, []);

  const handleToolChange = useCallback((tool: ToolType) => {
    setSelectedTool(tool);
    if (tool !== 'hand') {
      engineRef.current?.setTool(tool);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo/Redo shortcuts
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
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
  }, [handleToolChange, handleSizeChange, handleUndo, handleRedo]);

  return (
    <main className={styles.main}>
      {/* Connection status banner - only show when actively trying to connect */}
      {!isOfflineMode && !isConnected && (
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
      </div>

      {/* Header Actions */}
      <div className={styles.headerRight}>
        <Link href="/gallery" className={styles.galleryButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Gallery
        </Link>
        <CountdownTimer serverStartTime={serverStartTime} />
      </div>

      <Canvas
        engineRef={engineRef}
        onStrokeStart={handleStrokeStart}
        onStrokeUpdate={handleStrokeUpdate}
        onStrokeEnd={handleStrokeEnd}
        onCursorMove={handleCursorMove}
        onViewportChange={handleViewportChange}
        activeTool={selectedTool}
      />

      {/* Remote cursors */}
      <CursorOverlay cursors={cursors} viewport={viewport} />

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
        canUndo={userStrokes.length > 0}
        canRedo={undoneStrokes.length > 0}
      />

      <WelcomeHint />
    </main>
  );
}
