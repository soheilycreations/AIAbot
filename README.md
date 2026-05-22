# 🤖 Multi-Tenant WhatsApp Bot Platform — PoC

A proof-of-concept for a multi-tenant WhatsApp automation platform.
Real-time QR code streaming from a Node.js/Baileys backend to a Next.js frontend via Socket.io.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                      │
│   /dashboard  →  /dashboard/connect  →  /dashboard/knowledge   │
│                                                                 │
│   useWhatsAppSocket() hook                                      │
│   ├── io("ws://localhost:5000", { query: { shopId } })          │
│   ├── emit("start_session")                                     │
│   ├── on("qr")     → renders <QRCodeSVG />                      │
│   └── on("status") → updates UI badge                          │
└────────────────────────┬────────────────────────────────────────┘
                         │  WebSocket (Socket.io)
                         │  ws://localhost:5000
┌────────────────────────▼────────────────────────────────────────┐
│                         BACKEND (Node.js)                       │
│                                                                 │
│   server.js                                                     │
│   ├── Express HTTP server (health check, CORS)                  │
│   └── Socket.io server                                          │
│       ├── on("connection")   → reads shopId from query          │
│       ├── on("start_session") → calls whatsappManager           │
│       └── on("disconnect")   → keeps WA session alive          │
│                                                                 │
│   whatsappManager.js                                            │
│   ├── Map<shopId, { socket, cleanup }>  (session store)         │
│   ├── makeWASocket() via @whiskeysockets/baileys                │
│   ├── connection.update → emits "qr" / "status" events         │
│   └── messages.upsert  → logs incoming messages                │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Multi-File Auth State
         ▼
  ./sessions/<shopId>/    (persisted WhatsApp credentials)
```

---

## Directory Structure

```
whatsapp-platform/
├── backend/
│   ├── server.js               # Express + Socket.io entry point
│   ├── whatsappManager.js      # Per-tenant Baileys session manager
│   ├── package.json
│   └── .gitignore
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.js                      # Root layout
    │   │   ├── globals.css
    │   │   ├── page.js                        # Redirect → /dashboard
    │   │   └── dashboard/
    │   │       ├── layout.js                  # Dashboard shell (Sidebar)
    │   │       ├── page.js                    # Overview / home
    │   │       ├── connect/
    │   │       │   └── page.js                # ★ Connect Bot (main PoC page)
    │   │       └── knowledge/
    │   │           └── page.js                # Knowledge Base (placeholder)
    │   ├── components/
    │   │   ├── Sidebar.js                     # Navigation sidebar
    │   │   ├── StatusBadge.js                 # Connection status pill
    │   │   └── QRDisplay.js                   # QR / loading / success panel
    │   └── hooks/
    │       └── useWhatsAppSocket.js           # Socket.io custom hook
    ├── next.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

---

### 1 — Backend

```bash
cd backend
npm install
npm run dev        # uses nodemon for hot-reload
# OR
npm start          # plain node
```

The backend starts on **http://localhost:5000**.

> **Note:** `@whiskeysockets/baileys` has a transitive dependency on
> `libsignal-protocol` which compiles native bindings. If `npm install`
> fails, run `npm install --ignore-scripts` and then
> `npm rebuild` — or install `node-gyp` globally first.

---

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

The Next.js dev server starts on **http://localhost:3000**.

---

### 3 — Test the flow

1. Open **http://localhost:3000/dashboard/connect**
2. Click **"Generate QR Code"**
3. Watch the QR appear within a few seconds
4. Scan with WhatsApp on your phone
5. Status badge changes to **Connected** ✓
6. Send a message to the linked number — the backend logs it to the console

---

## Environment Variables

### Backend (`backend/.env`)

```
PORT=5000
FRONTEND_ORIGIN=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| WhatsApp library | `@whiskeysockets/baileys` | Most actively maintained WA Web reverse-engineering library |
| Auth persistence | `useMultiFileAuthState` | Saves creds to disk; survives backend restarts |
| QR rendering | `qrcode.react` (`QRCodeSVG`) | Vector, no extra canvas setup |
| State management | React `useState` + custom hook | Keeps it simple for PoC |
| Session lifetime | WA session outlives Socket.io connection | Bot keeps working when browser tab is closed |

---

## Next Steps (Production Roadmap)

- [ ] Replace in-memory session map with Redis (for horizontal scaling)
- [ ] Add JWT / API-key auth so each shop has its own token
- [ ] Integrate a knowledge-base (vector search / RAG) for auto-replies
- [ ] Add a message queue (BullMQ) for outbound messages
- [ ] Webhook support for forwarding messages to third-party systems
- [ ] Admin UI for multi-shop management
- [ ] Docker Compose setup for local dev + production deployment
