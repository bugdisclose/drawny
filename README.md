# Drawny

**An anonymous, real-time, infinite collaborative drawing canvas.**

![Drawny Demo](https://github.com/bugdisclose/drawny/assets/demo.png)

> **"Visit website → instant canvas. No login, no setup. Everyone draws on the same shared canvas."**

## About

Drawny is an experimental "Open Collective Canvas". It embraces impermanence, creativity, and playful chaos. Users can join instantly and draw with others in real-time. The unique twist? **The canvas exists for only 24 hours.** At the end of each cycle, the artwork is archived to the gallery, and the world resets to a blank slate, ready for a new day of creation.

## Features

-   **🎨 Infinite Canvas**: A massive, pannable, and zoomable workspace.
-   **🚀 Zero Friction**: No login or account required. Start drawing in seconds.
-   **⚡ Real-Time Collaboration**: See strokes from other artists appear instantly as they draw.
-   **⏳ Ephemeral World**: The canvas automatically resets every 24 hours.
-   **🏛️ Gallery Archive**: Past days' creations are permanently saved and viewable in the Gallery.
-   **📱 Mobile Friendly**: Fully responsive with touch support for drawing on phones and tablets.
-   **🛡️ Chaos Control**: Rate limiting and anti-abuse measures to keep the chaos fun, not destructive.

## Tech Stack

-   **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), React 19, HTML5 Canvas API.
-   **Styling**: CSS Modules, Tailwind-free (Vanilla CSS).
-   **Real-Time**: [Socket.io](https://socket.io/) with a custom Node.js server.
-   **Database**: [PostgreSQL](https://www.postgresql.org/) (for persistent daily archives).
-   **Language**: TypeScript.

## Getting Started

### Prerequisites

-   **Node.js** (v18 or later)
-   **PostgreSQL** (Optional for local dev, required for persistent archives)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/bugdisclose/drawny.git
    cd drawny
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory (or use `.env.local`):

    ```env
    # Optional: For local development with persistent archives
    DATABASE_URL="postgresql://user:password@localhost:5432/drawny"
    
    # Server Configuration
    PORT=3000
    NODE_ENV="development"
    ```

### Running Locally

**Important:** You must run the custom server script to enable WebSocket support. Do not use `next dev` directly.

```bash
npm run dev:socket
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Deployment

**⚠️ CRITICAL WARNING:**
This project uses a custom Node.js server (`server.ts`) to handle WebSocket connections. **It will NOT work on Vercel, Netlify, or other serverless-only platforms.** Serverless functions cannot maintain the persistent connections required for real-time collaboration.

### Recommended Hosting
You must deploy to a platform that supports **long-running Node.js processes**:

-   **[Render.com](https://render.com/)** (Web Service)
-   **[Railway](https://railway.app/)**
-   **[Fly.io](https://fly.io/)**
-   **DigitalOcean App Platform** or **VPS**

### Deployment Configuration (e.g., Render)
1.  **Build Command**: `npm run build`
2.  **Start Command**: `npm start`
3.  **Environment Variables**:
    -   `NODE_ENV`: `production`
    -   `DATABASE_URL`: Your PostgreSQL connection string (Internal URL if supported).

### Database Setup (Archives)
To ensure the daily archives persist across deployments and restarts, you **must** connect a PostgreSQL database.
1.  Provision a PostgreSQL database.
2.  Set the `DATABASE_URL` environment variable.
3.  The application will automatically create the necessary tables on startup.

*For more details on database setup, see [DATABASE_SETUP.md](DATABASE_SETUP.md).*

## License

This project is open-source and available under the **MIT License**.
