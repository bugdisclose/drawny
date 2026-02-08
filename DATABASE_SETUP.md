# Database Setup for Persistent Archives

## Why Database Storage?

Drawny's canvas resets every 24 hours and archives the artwork. On cloud platforms like Render.com, the filesystem is **ephemeral** - files are wiped on every deployment or server restart. To ensure archives persist, we use PostgreSQL database storage.

## How It Works

1. **Dual Storage Strategy:**
   - Archives are saved to **database** (persistent)
   - Archives are also saved to **filesystem** (backup/fallback)

2. **Automatic Fallback:**
   - If database is not configured, uses filesystem only
   - If database save fails, falls back to filesystem
   - Gallery page reads from database first, then filesystem

3. **Database Schema:**
   ```sql
   CREATE TABLE archives (
       id VARCHAR(255) PRIMARY KEY,
       date TIMESTAMP NOT NULL,
       start_time BIGINT NOT NULL,
       end_time BIGINT NOT NULL,
       stroke_count INTEGER NOT NULL,
       strokes JSONB NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

## Setup on Render.com

### Step 1: Create PostgreSQL Database

1. Go to your [Render.com Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `drawny-db` (or any name you prefer)
   - **Database:** `drawny`
   - **User:** (auto-generated)
   - **Region:** Same as your web service
   - **Plan:** **Free** (sufficient for archives)
4. Click **"Create Database"**

### Step 2: Get Database URL

1. Once created, go to the database's **Info** page
2. Find **"Internal Database URL"** (starts with `postgresql://`)
3. Copy the entire URL

### Step 3: Add to Web Service

1. Go to your **Web Service** (drawny)
2. Go to **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Add:
   - **Key:** `DATABASE_URL`
   - **Value:** (paste the Internal Database URL)
5. Click **"Save Changes"**

### Step 4: Deploy

The service will automatically redeploy. On startup, you'll see:

```
[DatabaseService] ✅ Database pool initialized
[DatabaseService] ✅ Database tables verified/created
```

## Local Development

### Option 1: Use PostgreSQL Locally

1. Install PostgreSQL:
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql
   sudo service postgresql start
   ```

2. Create database:
   ```bash
   createdb drawny
   ```

3. Create `.env.local`:
   ```bash
   DATABASE_URL=postgresql://localhost:5432/drawny
   ```

4. Run the app:
   ```bash
   npm run dev:socket
   ```

### Option 2: Skip Database Locally

Just run without DATABASE_URL - archives will use filesystem only (which is fine for local development).

## Verification

### Check Logs

After 24-hour reset, you should see:

```
[StrokeStorage] 🔄 CANVAS RESET TRIGGERED
[StrokeStorage] Archiving 1234 strokes
[StrokeStorage] Attempting to save to database...
[DatabaseService] ✅ Archive saved to database: canvas-2026-02-09T...
[StrokeStorage] ✅ Filesystem backup created: canvas-2026-02-09T...json
[StrokeStorage] ✅✅ Archive saved successfully (database + filesystem backup)
```

### Check Gallery

Visit `/gallery` - you should see all archived canvases, even after deployments.

## Troubleshooting

### "Database not available"

**Cause:** DATABASE_URL not set or connection failed

**Solution:**
1. Verify DATABASE_URL is set in Render.com environment variables
2. Check database is running
3. Verify connection string format

### "Failed to save archive"

**Cause:** Database connection issue or permissions

**Solution:**
1. Check Render.com database logs
2. Verify database is in same region as web service
3. Use "Internal Database URL" not "External"

### Archives still disappearing

**Cause:** Database might not be connected

**Solution:**
1. Check Render.com logs for database connection errors
2. Verify environment variable is spelled correctly: `DATABASE_URL`
3. Restart the web service

## Cost

- **Render.com Free PostgreSQL:** 
  - 1 GB storage
  - Expires after 90 days of inactivity
  - Perfect for testing

- **Render.com Paid PostgreSQL:**
  - Starts at $7/month
  - 10 GB storage
  - No expiration
  - Recommended for production

## Migration

If you want to migrate existing filesystem archives to database:

```bash
# TODO: Create migration script if needed
```

## Support

For issues, check:
- Render.com logs: Dashboard → Web Service → Logs
- Database logs: Dashboard → PostgreSQL → Logs
- Application logs: Look for `[DatabaseService]` and `[StrokeStorage]` prefixes

