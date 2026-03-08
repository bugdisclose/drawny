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
    setLog((prev) => [...prev.slice(-30), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  useEffect(() => {
    addLog(`UA: ${navigator.userAgent.substring(0, 80)}`);
    addLog(`Touch: ${'ontouchstart' in window}, MaxPts: ${navigator.maxTouchPoints}`);
    addLog(`Screen: ${window.innerWidth}x${window.innerHeight}, DPR: ${window.devicePixelRatio}`);

    const onTouch = (e: TouchEvent) => addLog(`${e.type} touches=${e.touches.length} target=${(e.target as Element)?.tagName}.${(e.target as Element)?.className?.substring(0, 40)}`);
    const onPointer = (e: PointerEvent) => addLog(`${e.type} ptrType=${e.pointerType} target=${(e.target as Element)?.tagName}.${(e.target as Element)?.className?.substring(0, 40)}`);

    document.addEventListener('touchstart', onTouch, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointer, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouch, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [addLog]);

  // Stable callback — avoids infinite re-render loop
  const handleAPI = useCallback((api: any) => {
    addLog('Excalidraw API ready');
  }, [addLog]);

  // Stable initial data
  const initialData = useMemo(() => ({
    appState: {
      viewBackgroundColor: '#f0f0ff',
      currentItemStrokeColor: '#e94560',
      currentItemStrokeWidth: 4,
    }
  }), []);

  // Stable onChange — use ref to avoid re-creating
  const elementCountRef = useRef(0);
  const handleChange = useCallback((elements: readonly any[]) => {
    if (elements.length !== elementCountRef.current) {
      elementCountRef.current = elements.length;
      addLog(`onChange: ${elements.length} elements`);
    }
  }, [addLog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Debug log */}
      <div style={{
        height: '120px',
        overflow: 'auto',
        background: '#111',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '4px 8px',
        flexShrink: 0,
        zIndex: 9999,
      }}>
        <div>BARE Excalidraw iPad Test - draw below. Events log here:</div>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {/* Bare Excalidraw - NO custom CSS, NO wrapper overrides */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Excalidraw
          excalidrawAPI={handleAPI}
          initialData={initialData}
          onChange={handleChange}
          autoFocus={true}
        />
      </div>
    </div>
  );
}
