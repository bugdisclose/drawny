/**
 * One-shot migration: backfill local archive JSON files into the production
 * `archives` Postgres table. Safe to re-run — uses ON CONFLICT DO UPDATE so
 * each run converges the row to the file's contents without creating
 * duplicates.
 *
 * Usage
 * -----
 *   1. Grab the EXTERNAL Render Postgres URL from the Render dashboard
 *      (Postgres service → Info → "External Database URL"). The Internal URL
 *      will NOT resolve from your laptop.
 *
 *   2. Run from the repo root:
 *
 *        DATABASE_URL='postgres://user:pass@dpg-xxx.oregon-postgres.render.com/dbname' \
 *          npx tsx scripts/migrate-archives-to-db.ts
 *
 *   3. The script reads every public/archives/canvas-*.json (skipping dummy
 *      and empty files), ensures the table+indexes exist, and upserts each
 *      archive. Final tally is printed at the end.
 *
 * SSL is forced on (Render external connections require it).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Pass it via env or .env:');
    console.error("   DATABASE_URL='postgres://…' npx tsx scripts/migrate-archives-to-db.ts");
    process.exit(1);
}

const ARCHIVES_DIR = path.join(process.cwd(), 'public', 'archives');

interface ArchiveJSON {
    id?: string;
    date?: string;
    start_time?: number;
    end_time?: number;
    startTime?: number;
    endTime?: number;
    stroke_count?: number;
    strokeCount?: number;
    artist_count?: number;
    artistCount?: number;
    strokes?: unknown[];
}

async function main(): Promise<void> {
    if (!fs.existsSync(ARCHIVES_DIR)) {
        console.error(`❌ Archives directory not found: ${ARCHIVES_DIR}`);
        process.exit(1);
    }

    const files = fs
        .readdirSync(ARCHIVES_DIR)
        .filter(
            (f) =>
                f.startsWith('canvas-') &&
                f.endsWith('.json') &&
                !f.toLowerCase().includes('dummy'),
        )
        .sort();

    if (files.length === 0) {
        console.error('❌ No archive files found in public/archives/.');
        process.exit(1);
    }

    console.log(`📂 Found ${files.length} archive file(s) to migrate:\n`);
    for (const f of files) console.log(`   • ${f}`);
    console.log();

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 10000,
        max: 4,
    });

    try {
        // Ensure schema exists (matches DatabaseService.createTablesIfNeeded).
        // No-ops if the table is already there — same statements the app runs.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS archives (
                id VARCHAR(255) PRIMARY KEY,
                date TIMESTAMP NOT NULL,
                start_time BIGINT NOT NULL,
                end_time BIGINT NOT NULL,
                stroke_count INTEGER NOT NULL,
                strokes JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(
            `ALTER TABLE archives ADD COLUMN IF NOT EXISTS artist_count INTEGER DEFAULT 0;`,
        );
        await pool.query(
            `CREATE INDEX IF NOT EXISTS idx_archives_date ON archives(date DESC);`,
        );

        let synced = 0;
        let skipped = 0;

        for (const file of files) {
            const filePath = path.join(ARCHIVES_DIR, file);
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(raw) as ArchiveJSON;

                const id = data.id || file.replace(/\.json$/, '');
                const date = data.date || new Date().toISOString();
                const startTime =
                    data.start_time ?? data.startTime ?? Date.parse(date);
                const endTime = data.end_time ?? data.endTime ?? startTime;
                const strokes = Array.isArray(data.strokes) ? data.strokes : [];
                const strokeCount =
                    data.stroke_count ?? data.strokeCount ?? strokes.length;
                const artistCount = data.artist_count ?? data.artistCount ?? 0;

                if (strokes.length === 0) {
                    console.warn(`  ⚠️  ${file}: no strokes — skipped`);
                    skipped++;
                    continue;
                }

                await pool.query(
                    `INSERT INTO archives (id, date, start_time, end_time, stroke_count, artist_count, strokes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (id) DO UPDATE SET
                        date = EXCLUDED.date,
                        start_time = EXCLUDED.start_time,
                        end_time = EXCLUDED.end_time,
                        stroke_count = EXCLUDED.stroke_count,
                        artist_count = EXCLUDED.artist_count,
                        strokes = EXCLUDED.strokes`,
                    [
                        id,
                        date,
                        startTime,
                        endTime,
                        strokeCount,
                        artistCount,
                        JSON.stringify(strokes),
                    ],
                );

                console.log(
                    `  ✅ ${file}: synced (${strokeCount} elements, ${artistCount} artists)`,
                );
                synced++;
            } catch (err) {
                console.error(
                    `  ❌ ${file}: ${err instanceof Error ? err.message : String(err)}`,
                );
                skipped++;
            }
        }

        const { rows } = await pool.query<{ n: number }>(
            'SELECT COUNT(*)::int AS n FROM archives',
        );

        console.log();
        console.log(`📊 Migration finished: ${synced} synced, ${skipped} skipped.`);
        console.log(`   Total archives now in DB: ${rows[0].n}`);
        console.log();
        console.log('Next:');
        console.log('  • Visit /gallery on production — the archives should appear.');
        console.log('  • Confirm DATABASE_URL is also set on the Render web service');
        console.log('    so future canvas resets persist automatically.');
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
