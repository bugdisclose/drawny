# Drawny

An anonymous, real-time, infinite collaborative drawing canvas.

![Drawny Demo](https://github.com/bugdisclose/drawny/assets/demo.png)

## Features

- **Infinite Canvas**: A massive 10,000 x 10,000 px workspace.
- **Real-Time Collaboration**: See other artists' strokes and cursors live.
- **Ephemeral**: The canvas automatically pushes to the archive and resets every 24 hours.
- **Archival System**: Browse past days' creations in the Gallery.
- **Mobile Friendly**: Supports pinch-to-zoom and touch gestures.

## Tech Stack

- **Framework**: Next.js (React)
- **Real-Time**: Socket.io
- **Styling**: CSS Modules
- **Canvas**: HTML5 Canvas API

## Deployment

**Important**: This project uses a custom Node.js server (`server.ts`) for Socket.io. **It will NOT work on Vercel** or Netlify standard deployments, as they use serverless functions which cannot maintain persistent WebSocket connections.

### Recommended: Render.com or Railway

You must deploy to a platform that supports long-running Node.js processes.

**Command**: `npm start`
**Build Command**: `npm run build`

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server (with WebSocket support):
   ```bash
   npm run dev:socket
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## License

MIT
