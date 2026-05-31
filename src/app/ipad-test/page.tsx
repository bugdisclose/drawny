'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

export default function IPadTestPage() {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  logRef.current = log;

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-40), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Clear Excalidraw localStorage so it doesn't restore a stale tool
  useEffect(() => {
    try {
      const excalidrawKeys = Object.keys(localStorage).filter(key => key.startsWith('excalidraw'));
      excalidrawKeys.forEach(key => localStorage.removeItem(key));
      if (excalidrawKeys.length > 0) addLog(`Cleared ${excalidrawKeys.length} localStorage keys`);
    } catch {}
  }, [addLog]);

  useEffect(() => {
    addLog(`UA: ${navigator.userAgent.substring(0, 80)}`);
    addLog(`Touch: ${'ontouchstart' in window}, MaxPts: ${navigator.maxTouchPoints}`);
    addLog(`Screen: ${window.innerWidth}x${window.innerHeight}, DPR: ${window.devicePixelRatio}`);

    const onTouch = (e: TouchEvent) =>
      addLog(`${e.type} touches=${e.touches.length} target=${(e.target as Element)?.tagName}.${(e.target as Element)?.className?.substring(0, 30)}`);
    const onPointer = (e: PointerEvent) =>
      addLog(`${e.type} ptrType=${e.pointerType} target=${(e.target as Element)?.tagName}.${(e.target as Element)?.className?.substring(0, 30)}`);

    document.addEventListener('touchstart', onTouch, { passive: true, capture: true });
    document.addEventListener('touchend', onTouch, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointer, { passive: true, capture: true });
    document.addEventListener('pointermove', onPointer, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouch, true);
      document.removeEventListener('touchend', onTouch, true);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('pointermove', onPointer, true);
    };
  }, [addLog]);

  // Track Excalidraw API ref for tool setting
  const apiRef = useRef<any>(null);

  // Log Excalidraw API state when ready, and force freedraw tool
  const handleAPI = useCallback((api: any) => {
    apiRef.current = api;
    addLog('Excalidraw API ready');

    // Force freedraw tool immediately and after a delay
    // (delay overrides any localStorage restoration Excalidraw may do)
    api.setActiveTool({ type: 'freedraw' });
    setTimeout(() => {
      try {
        api.setActiveTool({ type: 'freedraw' });
        const appState = api.getAppState();
        addLog(`API state: tool=${appState.activeTool?.type}, penMode=${appState.penMode}, penDetected=${appState.penDetected}`);
        addLog(`API dims: ${appState.width}x${appState.height}`);
      } catch (e: any) {
        addLog(`API state error: ${e.message}`);
      }
    }, 300);
  }, [addLog]);

  // Stable initial data
  const initialData = useMemo(() => ({
    appState: {
      viewBackgroundColor: '#f0f0ff',
      currentItemStrokeColor: '#e94560',
      currentItemStrokeWidth: 4,
    }
  }), []);

  // Track element count changes
  const elementCountRef = useRef(0);
  const handleChange = useCallback((elements: readonly any[]) => {
    if (elements.length !== elementCountRef.current) {
      elementCountRef.current = elements.length;
      addLog(`onChange: ${elements.length} elements`);
      // Log last element type
      if (elements.length > 0) {
        const last = elements[elements.length - 1];
        addLog(`  last el: type=${last.type}, version=${last.version}, isDeleted=${last.isDeleted}`);
      }
    }
  }, [addLog]);

  // Log pointer down on Excalidraw canvas
  const handlePointerDown = useCallback(() => {
    addLog('Excalidraw onPointerDown fired');
  }, [addLog]);

  // Hide all Excalidraw UI — only the canvas is relevant
  const uiOptions = useMemo(() => ({
    canvasActions: {
      changeViewBackgroundColor: false,
      clearCanvas: false,
      export: false as const,
      loadScene: false,
      saveToActiveFile: false,
      toggleTheme: false,
      saveAsImage: false,
    },
    tools: {
      image: false,
    },
  }), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {/* Debug log */}
      <div style={{
        height: '130px',
        overflow: 'auto',
        background: '#111',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '4px 8px',
        flexShrink: 0,
        zIndex: 9999,
      }}>
        <div>iPad Test — drawing below. Log:</div>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {/* Excalidraw container — fills remaining space */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        <Excalidraw
          excalidrawAPI={handleAPI}
          initialData={initialData}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          autoFocus={true}
          zenModeEnabled={false}
          gridModeEnabled={false}
          theme="light"
          detectScroll={false}
          UIOptions={uiOptions}
        />
      </div>
    </div>
  );
}
