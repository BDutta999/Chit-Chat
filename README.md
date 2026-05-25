# Real-Time Chat App

Full-stack real-time chat with **1-on-1 + group text**, **typing indicators**, **read receipts**, and **WebRTC voice/video calls**.

**Stack:** React (Vite) · Node.js + Express · Socket.io · WebRTC · MongoDB · JWT auth

## Features

- **Auth** — register / login (email + password, bcrypt), JWT, session persistence via `/auth/me`
- **Messaging** — 1-on-1 and group rooms, real-time delivery, timestamps, day separators, single/double-tick read receipts, typing indicators
- **Groups** — create with name + avatar URL, add/remove members, admin role (creator), self-leave
- **Calls** — 1-on-1 voice or video over WebRTC (peer-to-peer), Socket.io signaling, mute / camera toggle, end call, incoming-call accept/reject UI
- **UI** — sidebar with room list + last-message preview, search, contacts picker, group settings modal, responsive (mobile: sidebar becomes full-screen overlay)

## Folder structure

```
chat-app/
├── client/                 # Vite + React (no TS, plain CSS)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── api/client.js
│       ├── context/{AuthContext,SocketContext}.jsx
│       ├── pages/{Login,Register,Chat}.jsx
│       ├── components/{Sidebar,ChatWindow,MessageList,MessageInput,
│       │              CreateGroupModal,GroupSettingsModal,
│       │              CallModal,IncomingCallModal}.jsx
│       ├── hooks/useWebRTC.js
│       └── utils/avatar.js
└── server/                 # Express + Socket.io (CommonJS)
    ├── index.js
    ├── package.json
    ├── .env.example
    ├── models/{User,Message,Room}.js
    ├── middleware/auth.js
    ├── routes/{auth,users,rooms,messages}.js
    └── socket/{index,chatHandlers,callHandlers}.js
```

## Prerequisites

- **Node.js 18+** and **npm**
- **MongoDB** running locally on `mongodb://localhost:27017`
  (or any reachable URI — Atlas, Docker, etc.)

Quick local Mongo with Docker:
```bash
docker run -d --name chat-mongo -p 27017:27017 mongo:7
```

## Setup

### 1. Server

```bash
cd server
cp .env.example .env
# edit .env: set JWT_SECRET to a long random string
npm install
npm run dev      # uses nodemon (or: npm start)
```

You should see:
```
[mongo] connected
[server] listening on 5000
```

### 2. Client

In a separate terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open the printed URL (default **http://localhost:5173**).

## Environment variables

### `server/.env`
| Key | Example | Notes |
|---|---|---|
| `PORT` | `5000` | API + socket port |
| `MONGODB_URI` | `mongodb://localhost:27017/chatapp` | Mongo connection |
| `JWT_SECRET` | `replace-this-with-long-random` | **Required**, keep secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS + Socket.io origin |

### `client/.env`
| Key | Example |
|---|---|
| `VITE_API_URL` | `http://localhost:5000` |
| `VITE_SOCKET_URL` | `http://localhost:5000` |

## Quick test

1. Register two users in two different browsers (or one normal + one incognito).
2. In one window, click **+** in the sidebar → pick the other user → start chatting. Messages should appear instantly in both windows; you'll see the typing indicator and read ticks change to ✓✓ once the other side opens the chat.
3. Click the **🎥** (or **📞**) button in a 1-on-1 chat header. Allow camera/mic. The other user gets an incoming-call modal — accept it and the peer connection should establish.
4. Click **⌘** in the sidebar to create a group, pick members, and chat.

## How calls work

- Caller sends `call:invite` → server relays to callee → IncomingCallModal renders
- Callee accepts → emits `call:accept` → server relays to caller
- Caller creates SDP offer (`call:offer`); callee replies (`call:answer`)
- ICE candidates flow both ways via `call:ice` (queued until remote SDP is set)
- Either side hangs up → `call:end` → tracks stopped, peer connection closed

The server is a stateless signaling relay; all media is peer-to-peer through STUN. For users behind symmetric NATs you would need to add a TURN server to `ICE_SERVERS` in `client/src/hooks/useWebRTC.js`.

## Production notes

- Build the client: `cd client && npm run build` → static files in `client/dist/`
- Serve `dist/` from any static host (Vercel, Netlify, Nginx) and point `VITE_API_URL` / `VITE_SOCKET_URL` at your deployed server.
- Run the server behind a reverse proxy that supports WebSocket upgrades (Nginx `proxy_set_header Upgrade $http_upgrade;`).
- Set `CLIENT_URL` on the server to your deployed client origin.
- Use a strong `JWT_SECRET` and HTTPS in production. WebRTC's `getUserMedia` requires HTTPS (or `localhost`).

## Scripts reference

| Where | Command | What |
|---|---|---|
| `server/` | `npm run dev` | Start with nodemon |
| `server/` | `npm start` | Start with node |
| `client/` | `npm run dev` | Vite dev server (HMR) |
| `client/` | `npm run build` | Production bundle to `dist/` |
| `client/` | `npm run preview` | Preview the built bundle |

## Constraints honored

- Plain JavaScript only (no TypeScript)
- Plain CSS (no UI library)
- Every source file under 200 lines
- All secrets via `.env` (with `.env.example` checked in)
