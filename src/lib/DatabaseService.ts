import { Pool, PoolClient } from 'pg';
import { Stroke } from '../types';

interface ArchiveData {
    id: string;
    date: string;
    start_time: number;
    end_time: number;
    stroke_count: number;
    strokes: Stroke[];
}

class DatabaseService {
    private pool: Pool | null = null;
    private isInitialized = false;

    constructor() {
        this.initializePool();
    }

    private initializePool(): void {
        // Only initialize if DATABASE_URL is provided
        const databaseUrl = process.env.DATABASE_URL;
        
        if (!databaseUrl) {
            console.warn('[DatabaseService] ⚠️  DATABASE_URL not set - archives will not persist');
            console.warn('[DatabaseService] ⚠️  Set DATABASE_URL environment variable to enable database storage');
            return;
        }

        try {
            this.pool = new Pool({
                connectionString: databaseUrl,
                ssl: process.env.NODE_ENV === 'production' ? {
                    rejectUnauthorized: false // Required for Render.com
                } : false,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });

            this.pool.on('error', (err) => {
                console.error('[DatabaseService] Unexpected pool error:', err);
            });

            console.log('[DatabaseService] ✅ Database pool initialized');
            this.createTablesIfNeeded();
        } catch (err) {
            console.error('[DatabaseService] ❌ Failed to initialize database pool:', err);
        }
    }

    private async createTablesIfNeeded(): Promise<void> {
        if (!this.pool) return;

        try {
            const client = await this.pool.connect();
            
            try {
                // Create archives table
                await client.query(`
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

                // Create index on date for faster queries
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_archives_date ON archives(date DESC);
                `);

                console.log('[DatabaseService] ✅ Database tables verified/created');
                this.isInitialized = true;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('[DatabaseService] ❌ Failed to create tables:', err);
        }
    }

    async saveArchive(archiveData: ArchiveData): Promise<boolean> {
        if (!this.pool || !this.isInitialized) {
            console.warn('[DatabaseService] Database not available, skipping archive save');
            return false;
        }

        try {
            await this.pool.query(
                `INSERT INTO archives (id, date, start_time, end_time, stroke_count, strokes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                    date = EXCLUDED.date,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    stroke_count = EXCLUDED.stroke_count,
                    strokes = EXCLUDED.strokes`,
                [
                    archiveData.id,
                    archiveData.date,
                    archiveData.start_time,
                    archiveData.end_time,
                    archiveData.stroke_count,
                    JSON.stringify(archiveData.strokes)
                ]
            );

            console.log('[DatabaseService] ✅ Archive saved to database:', archiveData.id);
            return true;
        } catch (err) {
            console.error('[DatabaseService] ❌ Failed to save archive:', err);
            return false;
        }
    }

    async getArchive(id: string): Promise<ArchiveData | null> {
        if (!this.pool || !this.isInitialized) {
            return null;
        }

        try {
            const result = await this.pool.query(
                'SELECT * FROM archives WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                date: row.date,
                start_time: row.start_time,
                end_time: row.end_time,
                stroke_count: row.stroke_count,
                strokes: row.strokes
            };
        } catch (err) {
            console.error('[DatabaseService] ❌ Failed to get archive:', err);
            return null;
        }
    }

    async getAllArchives(): Promise<Array<{ id: string; date: string; stroke_count: number }>> {
        if (!this.pool || !this.isInitialized) {
            return [];
        }

        try {
            const result = await this.pool.query(
                'SELECT id, date, stroke_count FROM archives ORDER BY date DESC'
            );

            return result.rows.map(row => ({
                id: row.id,
                date: row.date,
                stroke_count: row.stroke_count
            }));
        } catch (err) {
            console.error('[DatabaseService] ❌ Failed to get archives:', err);
            return [];
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            console.log('[DatabaseService] Database pool closed');
        }
    }

    isAvailable(): boolean {
        return this.pool !== null && this.isInitialized;
    }
}

// Singleton instance
export const databaseService = new DatabaseService();

