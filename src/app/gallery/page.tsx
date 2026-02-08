import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { databaseService } from '@/lib/DatabaseService';

interface ArchiveStart {
    id: string;
    date: string;
    strokeCount: number;
}

export default async function GalleryPage() {
    let archives: ArchiveStart[] = [];

    // Try to get archives from database first
    if (databaseService.isAvailable()) {
        console.log('[Gallery] Fetching archives from database...');
        const dbArchives = await databaseService.getAllArchives();

        archives = dbArchives.map(archive => ({
            id: archive.id,
            date: archive.date,
            strokeCount: archive.stroke_count
        }));

        console.log('[Gallery] Found', archives.length, 'archives in database');
    } else {
        console.log('[Gallery] Database not available, falling back to filesystem');

        // Fallback to filesystem
        const archivesDir = path.join(process.cwd(), 'public', 'archives');

        if (fs.existsSync(archivesDir)) {
            const files = fs.readdirSync(archivesDir).filter(f => f.endsWith('.json'));

            archives = files.map(file => {
                try {
                    const content = fs.readFileSync(path.join(archivesDir, file), 'utf-8');
                    const data = JSON.parse(content);
                    return {
                        id: file.replace('.json', ''),
                        date: data.date,
                        strokeCount: data.strokeCount
                    };
                } catch (e) {
                    console.error('Error parsing archive:', file, e);
                    return null;
                }
            }).filter(Boolean) as ArchiveStart[];

            // Sort by date descending
            archives.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            console.log('[Gallery] Found', archives.length, 'archives in filesystem');
        }
    }

    return (
        <main style={{
            minHeight: '100vh',
            background: '#f8f9fa',
            padding: '40px 20px',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '8px' }}>Archive Gallery</h1>
                        <p style={{ color: '#666' }}>Past creations from the strangers</p>
                    </div>
                    <Link href="/" style={{
                        padding: '10px 20px',
                        background: '#1a1a2e',
                        color: 'white',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 500
                    }}>
                        ← Back to Canvas
                    </Link>
                </header>

                {archives.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
                        No archives found yet. Check back tomorrow!
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {archives.map(archive => (
                            <Link key={archive.id} href={`/gallery/${archive.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                    transition: 'transform 0.2s',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{
                                        height: '200px',
                                        background: '#f0f0f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#999',
                                        fontSize: '14px'
                                    }}>
                                        {/* Placeholder for thumbnail - we render strokes in detail view */}
                                        Preview
                                    </div>
                                    <div style={{ padding: '20px' }}>
                                        <h3 style={{ margin: '0 0 8px', color: '#1a1a2e', fontSize: '18px' }}>
                                            {new Date(archive.date).toLocaleDateString(undefined, {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '12px', color: '#666', fontSize: '14px' }}>
                                            <span>🖌️ {archive.strokeCount} strokes</span>
                                            <span>🕒 {new Date(archive.date).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
