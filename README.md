<p align="center">
  <img src="public/og-image.png" alt="Drawny" width="480" />
</p>

<h1 align="center">drawny</h1>

<p align="center">
  <strong>A shared canvas for the internet. Draw with strangers, create together, watch it disappear.</strong>
</p>

<p align="center">
  <a href="https://drawny.com">drawny.com</a> · No login · No setup · Just draw
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Socket.io-realtime-white?logo=socket.io&logoColor=black" alt="Socket.io" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-archive-blue?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## What is Drawny?

Drawny is a **public, anonymous, real-time collaborative canvas**. Think [r/place](https://www.reddit.com/r/place/) meets digital street art — except the wall gets wiped clean every 24 hours.

Anyone on the internet can visit and start drawing instantly. No accounts, no onboarding. You draw alongside strangers, contribute to the chaos, and then it's gone. The finished canvas is archived in the gallery, and a fresh blank slate appears for a new day.

**The impermanence is the point.** Every stroke matters more when it won't last forever.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖌️ **Instant Drawing** | Visit → draw. Under 3 seconds to first stroke. Zero friction. |
| � **Real-Time Multiplayer** | See other artists draw live. Every stroke syncs instantly via WebSocket. |
| ♾️ **Infinite Canvas** | A massive pannable, zoomable world powered by [Excalidraw](https://excalidraw.com/). |
| ⏳ **24-Hour Lifecycle** | The canvas resets daily. A live countdown shows time remaining. |
| 🏛️ **Gallery Archive** | Past canvases are preserved forever. Browse the history of collective art. |
| 🎨 **Ink System** | Limited ink per session adds strategic depth — every stroke costs something. |
| 🔗 **Deep Linking** | Share exact coordinates on the canvas. Links encode position and zoom level. |
| 📸 **Drawing Preview Share** | Share links include a screenshot of your drawing as the social media preview image. |
| 📱 **Mobile Native Share** | On mobile, the Web Share API attaches your drawing screenshot as an image file. |
| ↩️ **Undo / Redo** | Full history support — undo mistakes, redo what you changed your mind about. |
| 🛡️ **Anti-Abuse** | Rate limiting and ink constraints keep the chaos fun, not destructive. |
| 📱 **Fully Responsive** | Works on desktop, tablet, and mobile with touch drawing support. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Client (Browser)                   │
│  Next.js 16 · React 19 · Excalidraw · CSS Modules    │
└────────────────────┬─────────────────────────────────┘
                     │ WebSocket (Socket.io)
                     ▼
┌──────────────────────────────────────────────────────┐
│                Custom Node.js Server                  │
│  server.ts · Socket.io · Stroke Broadcasting          │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ StrokeStorage│  │InkManager│  │  SocketServer  │  │
│  │ (in-memory)  │  │(per-user)│  │ (real-time sync)│  │
│  └──────┬───────┘  └──────────┘  └────────────────┘  │
│         │                                             │
│         ▼ Archive on reset                            │
│  ┌──────────────┐                                     │
│  │ PostgreSQL   │  ← Daily canvas archives            │
│  │ (persistent) │                                     │
│  └──────────────┘                                     │
└──────────────────────────────────────────────────────┘
```

### Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- **Canvas Engine**: [Excalidraw](https://excalidraw.com/) — battle-tested infinite canvas
- **Real-Time**: [Socket.io](https://socket.io/) on a custom Node.js server
- **Database**: [PostgreSQL](https://www.postgresql.org/) for persistent gallery archives
- **Styling**: CSS Modules (zero framework overhead)
- **Language**: TypeScript (strict mode)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **PostgreSQL** (optional for local dev — required for gallery archives)

### Install & Run

```bash
git clone https://github.com/bugdisclose/drawny.git
cd drawny
npm install
```

Create a `.env` file:

```env
# Required
PORT=3000

# Optional: PostgreSQL for persistent archives
DATABASE_URL="postgresql://user:password@localhost:5432/drawny"

# Optional: Production base URL for OG images
NEXT_PUBLIC_BASE_URL="https://drawny.com"
```

Start the dev server:

```bash
# ⚠️ Always use this command — not `next dev`
# The custom server enables WebSocket support
PORT=3000 npx tsx watch server.ts
```

Open [http://localhost:3000](http://localhost:3000) and start drawing.

---

## 🚢 Deployment

> **⚠️ Important:** Drawny requires a **persistent Node.js process** for WebSocket connections. It will **not work** on serverless platforms like Vercel or Netlify.

### Recommended Platforms

| Platform | Why |
|---|---|
| [Render](https://render.com/) | Simple, great free tier for web services |
| [Railway](https://railway.app/) | One-click deploy with PostgreSQL add-on |
| [Fly.io](https://fly.io/) | Edge deployment, great latency |
| **Any VPS** | DigitalOcean, Linode, Hetzner, AWS EC2 |

### Deploy Steps

1. **Build**: `npm run build`
2. **Start**: `npm start`
3. **Environment Variables**:
   - `NODE_ENV=production`
   - `DATABASE_URL` — your PostgreSQL connection string
   - `NEXT_PUBLIC_BASE_URL` — your production URL (for OG images)
4. Database tables are created automatically on first startup.

---

## 📂 Project Structure

```
drawny/
├── server.ts                  # Custom Node.js + Socket.io server
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx           # Main canvas page
│   │   ├── gallery/           # Archive gallery
│   │   ├── s/[id]/            # Dynamic share pages (OG meta)
│   │   └── api/snapshot/      # Snapshot upload/serve API
│   ├── components/
│   │   ├── ExcalidrawCanvas   # Core drawing canvas
│   │   ├── Toolbar            # Drawing tools, colors, sizes
│   │   ├── ShareButton        # Share modal with preview
│   │   ├── InkBar             # Ink level indicator
│   │   ├── CountdownTimer     # 24h reset countdown
│   │   └── WelcomeHint        # First-visit onboarding
│   ├── lib/
│   │   ├── SocketServer.ts    # WebSocket event handling
│   │   ├── StrokeStorage.ts   # In-memory stroke store + archival
│   │   ├── InkManager.ts      # Per-session ink tracking
│   │   ├── DrawingEngine.ts   # Canvas rendering engine
│   │   ├── DatabaseService.ts # PostgreSQL client
│   │   └── deepLinkUtils.ts   # URL coordinate encoding
│   └── hooks/
│       └── useSocket.ts       # Socket.io React hook
├── public/
│   └── og-image.png           # Default social media preview
└── idea.md                    # Original product spec
```

---

## 🎮 How It Works

1. **You visit** → Canvas loads instantly. You're assigned an anonymous session.
2. **You draw** → Each stroke is broadcast to every connected user via WebSocket.
3. **Ink depletes** → You have a limited ink supply. Use it wisely.
4. **Others draw** → You see their strokes appear in real-time.
5. **Share a spot** → Clicking "Share" captures a screenshot, uploads it, and generates a link with dynamic OG preview.
6. **Timer hits zero** → The canvas is archived to the gallery. A fresh canvas begins.
7. **Gallery** → Browse all past canvases and replay how they were created.

---

## 🤝 Design Philosophy

> *"Zero friction beats features. Ephemeral > permanent. Playfulness over control. Constraints create creativity."*

Drawny is intentionally minimal. There are no layers, no text tool, no shape tools. The constraints force creativity. The impermanence makes every contribution feel urgent and meaningful.

The chaos is a feature, not a bug.

---

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>drawny.com</strong> — draw with strangers.
</p>
