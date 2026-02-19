import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import ArchiveCanvasViewer from '@/components/ArchiveCanvasViewer';
import { databaseService } from '@/lib/DatabaseService';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

/**
 * Parse strokes safely: handles double-encoded JSON strings, null, and non-array values.
 * Returns a valid array (possibly empty).
 */
function parseStrokes(raw: unknown): any[] {
    let parsed = raw;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return [];
        }
    }
    if (Array.isArray(parsed)) {
        return parsed.filter((el: any) => !el.isDeleted);
    }
    return [];
}

export default async function ArchivePage({ params }: PageProps) {
    const { id } = await params;
    // Sanitize ID to prevent traversal
    if (!id || id.includes('..') || id.includes('/')) {
        notFound();
    }

    let data;

    // Try to get archive from database first
    if (databaseService.isAvailable()) {
        console.log('[Archive] Fetching archive from database:', id);
        data = await databaseService.getArchive(id);

        if (data) {
            console.log('[Archive] Found archive in database');
            const strokes = parseStrokes(data.strokes);
            return <ArchiveCanvasViewer strokes={strokes} />;
        } else {
            console.log('[Archive] Archive not found in database, trying filesystem');
        }
    }

    // Fallback to filesystem
    const filePath = path.join(process.cwd(), 'public', 'archives', `${id}.json`);

    if (!fs.existsSync(filePath)) {
        console.log('[Archive] Archive not found in filesystem either');
        notFound();
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
        console.log('[Archive] Found archive in filesystem');
    } catch (e) {
        console.error('[Archive] Failed to read archive:', e);
        notFound();
    }

    const strokes = parseStrokes(data.strokes);
    return <ArchiveCanvasViewer strokes={strokes} />;
}
