'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TestPage() {
    const [dbStatus, setDbStatus] = useState<any>(null);
    const [archiveResult, setArchiveResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const checkDatabase = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/test-db');
            const data = await response.json();
            setDbStatus(data);
        } catch (error) {
            setDbStatus({ error: 'Failed to fetch database status' });
        }
        setLoading(false);
    };

    const triggerArchive = async () => {
        if (!confirm('This will reset the canvas and create an archive. Continue?')) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/test-archive', { method: 'POST' });
            const data = await response.json();
            setArchiveResult(data);
            
            // Refresh database status after archive
            setTimeout(checkDatabase, 1000);
        } catch (error) {
            setArchiveResult({ error: 'Failed to trigger archive' });
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '20px' }}>🧪 Archive System Test Page</h1>
            
            <div style={{ marginBottom: '30px' }}>
                <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
                    ← Back to Canvas
                </Link>
                {' | '}
                <Link href="/gallery" style={{ color: '#0070f3', textDecoration: 'none' }}>
                    View Gallery
                </Link>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <button
                    onClick={checkDatabase}
                    disabled={loading}
                    style={{
                        padding: '12px 24px',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {loading ? 'Loading...' : '🔍 Check Database Status'}
                </button>

                <button
                    onClick={triggerArchive}
                    disabled={loading}
                    style={{
                        padding: '12px 24px',
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {loading ? 'Loading...' : '🗄️ Trigger Archive (Reset Canvas)'}
                </button>
            </div>

            {dbStatus && (
                <div style={{ marginBottom: '30px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <h2 style={{ marginTop: 0 }}>Database Status</h2>
                    <pre style={{ overflow: 'auto', background: 'white', padding: '15px', borderRadius: '4px' }}>
                        {JSON.stringify(dbStatus, null, 2)}
                    </pre>
                </div>
            )}

            {archiveResult && (
                <div style={{ marginBottom: '30px', padding: '20px', background: archiveResult.success ? '#d4edda' : '#f8d7da', borderRadius: '8px' }}>
                    <h2 style={{ marginTop: 0 }}>Archive Result</h2>
                    <pre style={{ overflow: 'auto', background: 'white', padding: '15px', borderRadius: '4px' }}>
                        {JSON.stringify(archiveResult, null, 2)}
                    </pre>
                </div>
            )}

            <div style={{ padding: '20px', background: '#fff3cd', borderRadius: '8px', marginTop: '30px' }}>
                <h3 style={{ marginTop: 0 }}>📝 Instructions</h3>
                <ol style={{ lineHeight: '1.8' }}>
                    <li><strong>Check Database Status:</strong> Click to see if database is connected and view current canvas state</li>
                    <li><strong>Draw Something:</strong> Go to the main canvas and draw a few strokes</li>
                    <li><strong>Trigger Archive:</strong> Click the red button to manually reset canvas and create archive</li>
                    <li><strong>Check Gallery:</strong> Visit /gallery to see if the archive appears</li>
                    <li><strong>Check Database:</strong> Click status button again to see archives in database</li>
                </ol>
            </div>

            <div style={{ padding: '20px', background: '#e7f3ff', borderRadius: '8px', marginTop: '20px' }}>
                <h3 style={{ marginTop: 0 }}>ℹ️ What to Look For</h3>
                <ul style={{ lineHeight: '1.8' }}>
                    <li><strong>database.available: true</strong> - Database is connected ✅</li>
                    <li><strong>database.available: false</strong> - Database not configured (using filesystem) ⚠️</li>
                    <li><strong>archives.count</strong> - Number of archives in database</li>
                    <li><strong>canvas.strokeCount</strong> - Current strokes on canvas</li>
                </ul>
            </div>
        </div>
    );
}

