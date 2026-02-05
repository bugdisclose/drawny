# Open Collective Canvas (Working Title) - Name Drawny and website would be drawny.com

## Core idea 

- Visit website → instant canvas

- No login, no setup

- Anyone can draw anything

- Everyone draws on the same shared canvas

- Canvas persists for 12–24 hours

- Then it resets and a new blank canvas starts

- People can draw over others’ drawings

This is very similar in spirit to:

r/place

Aggie.io

Excalidraw live rooms
…but this version is time-based, anonymous, and ephemeral, which is the magic.


## 1. Overview

Open Collective Canvas is a public, anonymous, collaborative drawing website. Anyone on the internet can visit the site and immediately start drawing on a shared canvas with others in real time. There is no login, no onboarding, and no setup friction.

The canvas exists for a limited time window (12–24 hours). At the end of each cycle, the canvas is archived and reset to a blank state, creating a fresh space for new collective artwork.

The product embraces impermanence, creativity, and playful chaos — like digital street art that disappears daily.

---

## 2. Goals & Success Criteria

### Primary Goals

* Enable instant, anonymous participation
* Create a sense of shared, collective creation
* Encourage creativity through ephemerality
* Keep the experience extremely simple and accessible

### Success Metrics

* Time to first draw < 3 seconds after page load
* Average session length > 2 minutes
* Multiple simultaneous users drawing at once
* Repeat daily visitors

---

## 3. Target Users

* Casual internet users
* Artists and illustrators (professional or hobbyist)
* Students and classrooms
* Streamers and online communities
* Anyone curious enough to draw something anonymously

No account-based personas — everyone is equal.

---

## 4. Core User Experience with Simple, Clean and Modern UI/UX

### Entry Flow

1. User visits the website
2. Canvas loads immediately
3. User can draw instantly without any login or configuration

### Drawing Experience

* User draws directly on the shared canvas
* Other users’ strokes appear in real time
* Users can draw over existing drawings

### Persistence

* Canvas persists for the entire cycle (12–24 hours)
* New visitors see the current state of the canvas

### Reset Flow

* At the end of the cycle:

  * Canvas is archived as an image
  * A new blank canvas is created

---

## 5. Canvas Specifications

* Canvas type: Single shared global canvas
* Size: Large fixed-size canvas (e.g., 10,000 × 10,000 px)
* View: Pannable and zoomable
* Background color: Neutral (white or off-white)

---

## 6. Drawing Tools (MVP)

### Included Tools

* Brush / pencil tool
* Eraser tool (small area only)
* Color palette (limited predefined colors)
* Brush size (2–3 preset sizes)

### Excluded Tools (Intentional)

* Layers
* Text tool
* Shape tools
* Advanced effects

Simplicity is a core product principle.

---

## 7. Real-Time Collaboration

### Requirements

* Real-time stroke synchronization between users
* New users receive the current canvas state on load
* Low-latency updates (<200ms ideal)

### Implmentation idea

* WebSockets or WebRTC
* Each stroke = a small event:
    {
  x, y,
  color,
  size,
  timestamp
}

* Broadcast strokes to all connected users
* Store strokes server-side so late visitors see the current state

Tech Stack idea:

* Frontend: Canvas API / Fabric.js / PixiJS
* Backend: Node.js + WebSockets
* Database: Redis for active strokes, PostgreSQL for archived images


### Stroke Data Model (Conceptual)

* Coordinates (x, y)
* Color
* Brush size
* Timestamp

---

## 8. Anti-Abuse & Chaos Control

The product intentionally allows chaos, but prevents total disruption.

### Constraints

* Rate limiting per user/session (e.g., 3 stroke per second)
* No full-canvas eraser
* Small-area erasing only (optional)
* No undo history

### Moderation Philosophy

* No active moderation by default
* Community-driven evolution
* Abuse mitigation through technical constraints, not policing

---

## 9. Reset & Archival System

### Canvas Lifecycle

* Active duration: 12–24 hours (configurable)
* On reset:

  * Archive canvas as a static image
  * Clear all stroke data
  * Initialize new blank canvas

### Archive Access (Optional MVP+)

* Gallery of past canvases
* Timestamped daily canvases
* Downloadable images

---

## 10. Non-Functional Requirements

### Performance

* Support hundreds of concurrent users
* Smooth drawing on desktop and mobile

### Reliability

* Graceful degradation if real-time sync fails
* Automatic recovery on server restart

### Accessibility

* Works on modern desktop and mobile browsers
* Touch support for mobile devices

---

## 11. Tech Stack (Suggested, Not Prescriptive)

### Frontend

* HTML5 Canvas API
* JavaScript (React or Vanilla)
* Pan & zoom support

### Backend

* Node.js
* WebSockets for real-time communication

### Storage

* In-memory store (e.g., Redis) for active strokes
* Object storage for archived images

---

## 12. MVP Scope

### Included

* Shared real-time canvas
* Basic drawing tools
* Anonymous participation
* Daily reset

### Excluded (Future Enhancements)

* User accounts
* Comments or chat
* Social features
* Moderation tools

---

## 13. Product Principles

* Zero friction beats features
* Ephemeral > permanent
* Playfulness over control
* Constraints create creativity

---

## 14. Open Questions

* Exact canvas size?
* Reset interval: 12h vs 24h?
* Archive visibility on launch?
* Mobile-first vs desktop-first optimizations?

---

## 15. Future Ideas (Out of Scope)

* Time-based color or tool restrictions
* Replay mode (timelapse of canvas evolution)
* Themed days or events
* Streamer or classroom modes

---
