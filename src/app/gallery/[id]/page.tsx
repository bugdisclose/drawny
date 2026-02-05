import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import ArchiveCanvasViewer from '@/components/ArchiveCanvasViewer';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ArchivePage({ params }: PageProps) {
    const { id } = await params;
    // Sanitize ID to prevent traversal
    if (!id || id.includes('..') || id.includes('/')) {
        notFound();
    }

    const filePath = path.join(process.cwd(), 'public', 'archives', `${id}.json`);

    if (!fs.existsSync(filePath)) {
        notFound();
    }

    let data;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
    } catch (e) {
        console.error('Failed to read archive:', e);
        notFound();
    }

    return <ArchiveCanvasViewer strokes={data.strokes} />;
}
