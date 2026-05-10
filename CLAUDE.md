# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # install deps
npm run dev:socket     # PREFERRED dev server — tsx watch on server.ts (Next + Socket.io)
npm run dev            # Next dev only (Turbopack); WebSocket features will NOT work
npm run build          # next build
npm start              # production: NODE_ENV=production tsx server.ts
npm run lint           # eslint (flat config in eslint.config.mjs)
```

There is no test runner configured.

### Environment

`.env` is loaded by `server.ts` via `dotenv/config`. Variables consumed:

- `PORT` (default `3000`)
- `DATABASE_URL` — optional Postgres connection string. Without it, gallery archives are filesystem-only and do not survive deploys on ephemeral hosts.
- `NEXT_PUBLIC_BASE_URL` — production base URL used for share/OG metadata.

In production the `pg` pool sets `ssl: { rejectUnauthorized: false }` (required by Render).

## Architecture

Drawny is a real-time, anonymous, ephemeral collaborative canvas. Three things shape the architecture and are non-obvious from individual files:

### 1. Custom Node server, not standalone Next.js

`server.ts` boots a single HTTP server that hosts both the Next.js request handler **and** a Socket.io server (`src/lib/SocketServer.ts`). This is mandatory because the app relies on long-lived WebSocket connections — it will not run on Vercel/Netlify or any serverless target. Production deployments must run `npm start` (which invokes `tsx server.ts`), not `next start`.

Implication: when running locally, `npm run dev` (plain `next dev`) silently disables realtime. Use `npm run dev:socket`.

### 2. Singleton in-memory state shared between the custom server and Next.js route handlers

The canonical canvas state lives in `StrokeStorage` (`src/lib/StrokeStorage.ts`) — a `Map<id, ExcalidrawElement>` plus `canvasStartTime` and `uniqueArtists`. It is exported as a singleton that intentionally attaches itself to `globalThis` in **both** dev and production. The reason (see comments in that file): Next.js's module isolation can otherwise hand the Socket.io handler and an API route different instances, which would silently desync the live canvas from `/api/*` endpoints. Touch this pattern with care — replacing it with a per-import singleton will break archival and admin endpoints.

Cycle lifecycle (`src/lib/SocketServer.ts` + `StrokeStorage`):
- `setupResetScheduler()` ticks once per minute and calls `strokeStorage.reset()` when 24h have elapsed since `canvasStartTime`.
- `reset()` archives current elements (filesystem at `public/archives/` **and** Postgres if `DATABASE_URL` is set — see `DATABASE_SETUP.md`), then clears state and rebroadcasts `scene:init`.
- `resetCanvas()` is also reachable via API routes for manual triggering; both paths share the same singleton.

### 3. Excalidraw integration constraints

- `next.config.ts` sets `reactStrictMode: false` and `transpilePackages: ['@excalidraw/excalidraw']`. Strict mode is **intentionally off** because Excalidraw's double-mount under StrictMode causes initialization bugs. Don't re-enable without testing the canvas mount path.
- The wire protocol is element-based, not stroke-based: clients send `scene:update` with `ExcalidrawElement[]` deltas, the server upserts by `element.id`, and broadcasts to everyone except the sender. There is also a `scene:request-sync` for full-state recovery. All event signatures are in `src/types/index.ts`.
- `markSessionAsDrawn(socket.id)` is what gates the `artists:count` broadcast — i.e. unique-artist counting is per-socket-connection, reset every cycle.

### Directory map (only the load-bearing parts)

- `server.ts` — entry point; wires Next + Socket.io into one HTTP server.
- `src/lib/SocketServer.ts` — socket event handlers, reset scheduler, broadcast helpers.
- `src/lib/StrokeStorage.ts` — in-memory canvas + archival; **the global singleton**.
- `src/lib/DatabaseService.ts` — Postgres pool, auto-creates `archives` table on first connect, includes an `ALTER TABLE … ADD COLUMN IF NOT EXISTS artist_count` migration.
- `src/lib/InkManager.ts`, `useInkManager.ts` — per-session ink budget (client-side).
- `src/lib/StreakManager.ts`, `useStreak.ts`, `cookieUtils.ts` — daily streak tracking via cookies.
- `src/lib/deepLinkUtils.ts` — encodes canvas position/zoom into shareable URLs.
- `src/app/api/snapshot/` — accepts PNG uploads (raw or multipart), stores in `.snapshots/` with a 24h TTL pruned opportunistically on each POST. Backs the share-card OG previews.
- `src/app/s/[id]/` — share landing pages that render dynamic OG metadata pointing at `/api/snapshot/[id]`.
- `src/app/gallery/`, `src/app/gallery/[id]/` — archive browser, reads from DB first, filesystem second.
- `src/app/api/test-archive/`, `src/app/api/test-db/`, `src/app/api/debug/` — admin/debug endpoints (manual reset, DB ping). Guard before exposing publicly.
- `src/components/ExcalidrawCanvas.tsx` — the canvas; everything else in `src/components/` is HUD chrome (toolbar, ink bar, countdown, share, onboarding, streak badge, cursor overlay).

Path alias: `@/*` → `src/*` (`tsconfig.json`).

### Persistence notes

- Filesystem archives at `public/archives/canvas-<iso>.json` are written before the DB write and are a backup, not the source of truth in production.
- Snapshot storage uses `.snapshots/` at the repo root (`process.cwd()`), **not** `/tmp` despite the file header comment. The TTL prune runs inside each POST handler — there is no background job.
