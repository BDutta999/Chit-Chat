# Chit-Chat — Complete Project Guide

A from-scratch walkthrough of this real-time chat application: what it does, how it's built, why each piece exists, and what happens when you click "Send" or "Call".

> Repo: https://github.com/BDutta999/Chit-Chat
> Live (after deploy): client on Vercel, server on Render, DB on MongoDB Atlas.

---

## 1. What we built

A WhatsApp-style chat app with these features:

| Area | What works |
|---|---|
| Auth | Register/login with email + password, hashed with bcrypt, JWT tokens, sessions persist across reloads via `/auth/me` |
| Messaging | 1-on-1 and group rooms, real-time delivery over Socket.io, message history persisted in MongoDB, day separators, timestamps |
| Typing indicators | "Alice is typing…" with auto-fade after silence |
| Read receipts | Single tick (sent) → double tick (read by everyone else in the room) |
| Groups | Anyone can create a group with a name + avatar URL, add multiple members; creator becomes admin |
| Group admin | Rename, change avatar, add/remove members. Non-admins can leave |
| Calls | 1-on-1 voice or video over WebRTC (peer-to-peer), Socket.io signaling, mute toggle, camera toggle, end call |
| Incoming call | Accept / Decline modal with caller name + avatar |
| UI | Sidebar (rooms + last message preview + search), chat window, modal dialogs, full-screen call overlay |
| Responsive | Mobile breakpoint at 768px — sidebar becomes full-screen, hidden once a chat opens, back button reveals it again |

---

## 2. Tech stack & why each choice

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React 18** | Mainstream, component model fits chat UI naturally |
| Build tool | **Vite** | Fast HMR dev server, tiny config, no Webpack ceremony |
| Routing | **react-router-dom v6** | Standard SPA routing |
| HTTP client | **axios** | Interceptors for token injection + 401 redirect |
| Real-time | **Socket.io v4** | Fallback transport (WebSocket → polling), rooms primitive, ack callbacks |
| Calls | **Native WebRTC** (`RTCPeerConnection`) | No extra deps; full control. (`simple-peer` would need Buffer polyfills under Vite — chose to skip that) |
| Server | **Node.js + Express** | Smallest viable HTTP framework |
| Persistence | **MongoDB + Mongoose** | Flexible schemas suit "rooms have N members, messages have N read-receipts" |
| Auth | **bcryptjs + jsonwebtoken** | Standard, well-tested |
| Styling | **Plain CSS** with CSS variables | Constraint said no UI library; vars give a "design system" feel without a framework |
| Hosting | **Vercel** (client) + **Render** (server) + **Atlas** (DB) | All have free tiers; Render supports persistent WebSocket connections (Vercel's serverless functions don't, so the Socket.io server must live on Render) |

---

## 3. Architecture at a glance

```
┌─────────────────┐         HTTPS / WSS          ┌──────────────────────┐
│                 │  ──────── REST  ─────────▶   │                      │
│  React client   │                              │  Express + Socket.io │
│  (Vite, Vercel) │  ◀─── Socket.io events ──    │  (Render)            │
│                 │                              │                      │
└─────────────────┘                              └──────────┬───────────┘
        │                                                   │
        │           WebRTC peer-to-peer (media)             │
        ▼                                                   ▼
┌─────────────────┐                              ┌──────────────────────┐
│  Other client   │                              │   MongoDB Atlas      │
│   (browser)     │                              │   (cloud)            │
└─────────────────┘                              └──────────────────────┘
```

Three lanes of communication:

1. **REST** for stateless requests: register, login, fetch rooms, fetch message history, group CRUD.
2. **Socket.io** for real-time events: live message delivery, typing, read receipts, presence, call signaling.
3. **WebRTC** for media: once a call is accepted, audio/video flows directly browser-to-browser. The server is *not* a media relay — only a signaling relay (it shuttles SDP offers/answers and ICE candidates).

This split matters: **media never touches our server**, so a free-tier Render box can handle many concurrent calls without bandwidth cost.

---

## 4. Folder structure

```
chat-app/
├── README.md                        # Setup & feature overview
├── PROJECT_GUIDE.md                 # ← this document
├── .gitignore                       # node_modules, .env, .DS_Store, etc.
│
├── server/                          # Backend (Node + Express + Socket.io)
│   ├── package.json
│   ├── .env.example                 # Template; real .env is git-ignored
│   ├── index.js                     # Entrypoint: app, mongo, http, socket
│   │
│   ├── models/                      # Mongoose schemas
│   │   ├── User.js                  # email, password (bcrypt hook), name, avatar, online
│   │   ├── Room.js                  # name, isGroup, members[], admin, lastMessage
│   │   └── Message.js               # room, sender, content, readBy[]
│   │
│   ├── middleware/
│   │   └── auth.js                  # signToken, verifyToken, authRequired
│   │
│   ├── routes/                      # REST endpoints (mounted under /api)
│   │   ├── auth.js                  # /register, /login, /me
│   │   ├── users.js                 # / (list), /search
│   │   ├── rooms.js                 # CRUD + member ops
│   │   └── messages.js              # history, send, mark-read
│   │
│   └── socket/                      # Socket.io layer
│       ├── index.js                 # JWT auth, presence, dispatch to handlers
│       ├── chatHandlers.js          # join/leave, send, typing, read
│       └── callHandlers.js          # WebRTC signaling relay
│
└── client/                          # Frontend (Vite + React)
    ├── package.json
    ├── vite.config.js
    ├── vercel.json                  # SPA rewrites for client-side routing
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx                 # ReactDOM.createRoot, providers
        ├── App.jsx                  # Routes + Protected/PublicOnly guards
        ├── index.css                # Single CSS file (~170 lines)
        │
        ├── api/
        │   └── client.js            # Axios instance + token interceptor
        │
        ├── context/
        │   ├── AuthContext.jsx      # user, token, login/register/logout
        │   └── SocketContext.jsx    # io() socket lifecycle
        │
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── Chat.jsx             # The orchestrator
        │
        ├── components/
        │   ├── Sidebar.jsx          # Rooms list + new-chat picker
        │   ├── ChatWindow.jsx       # Header, messages, input, call buttons
        │   ├── MessageList.jsx      # Bubble rendering + day separators
        │   ├── MessageInput.jsx     # Textarea + typing debounce
        │   ├── CreateGroupModal.jsx
        │   ├── GroupSettingsModal.jsx
        │   ├── CallModal.jsx        # Active call overlay
        │   └── IncomingCallModal.jsx
        │
        ├── hooks/
        │   └── useWebRTC.js         # All call-side WebRTC logic
        │
        └── utils/
            └── avatar.js            # Initials, deterministic colors, room display
```

---

## 5. Server walkthrough

### 5.1 Entrypoint — `server/index.js`

Bootstraps everything in order:

1. Loads `.env`
2. Builds an Express app with CORS (origins from `CLIENT_URL`, comma-separable, trailing-slash-tolerant) + JSON body parser
3. Mounts REST routes under `/api/...`
4. Wraps Express in a raw `http.Server` so Socket.io can attach to the same port
5. Creates the `Server` (Socket.io) instance, attached to the same CORS rules
6. Calls `initSocket(io)` to wire authentication and event handlers
7. Stores `io` on `app` so REST routes can emit events too (used when groups are mutated via REST)
8. Calls `mongoose.connect(MONGODB_URI)` then `server.listen(PORT)`

If Mongo fails, the process exits — no point running an API that can't read/write.

### 5.2 Models — `server/models/`

**`User.js`**
- Fields: `email` (unique, lowercase, trimmed), `password` (min 6), `name`, `avatar` (URL string), `online` (bool), `lastSeen` (date)
- A pre-save hook hashes the password with `bcrypt.hash(plain, 10)` whenever it's modified — so updates work too.
- `comparePassword(plain)` and `toPublic()` methods. `toPublic` strips the password hash from API responses.

**`Room.js`**
- Fields: `name` (only set for groups), `isGroup` (bool), `avatar`, `members` (array of User refs), `admin` (User ref, only set for groups), `lastMessage` (Message ref).
- `members` is indexed for the "list rooms for user X" query.
- 1-on-1 rooms are just rooms with `isGroup: false` and `members.length === 2`. Same model, different shape.

**`Message.js`**
- Fields: `room`, `sender`, `content`, `type` (`'text'` | `'system'`), `readBy` (array of `{ user, readAt }`).
- Compound index `{ room: 1, createdAt: -1 }` so the "latest 50 messages in room X" query is cheap.

Why MongoDB and not SQL? Two arrays (`members`, `readBy`) per document fit naturally as embedded data; you'd need extra join tables in SQL.

### 5.3 Auth middleware — `server/middleware/auth.js`

Three exports:
- `signToken(userId)` — `jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' })`
- `verifyToken(token)` — wraps `jwt.verify`
- `authRequired(req, res, next)` — pulls `Authorization: Bearer <token>`, verifies, sets `req.userId`, otherwise responds 401.

JWT was chosen over server-side sessions because:
- Stateless → horizontally scalable (any Render container can handle the request)
- The same token is also used for Socket.io auth (`socket.handshake.auth.token`)
- No DB lookup per request

### 5.4 REST routes

All under `/api/`:

**`/api/auth`** (public for register/login, protected for `/me`)
- `POST /register` — validates input, checks for duplicate email, creates user (password hashed by hook), returns token + public user.
- `POST /login` — finds user, calls `comparePassword`, returns token + user.
- `GET /me` — protected. Used on app startup to restore the session: client has a token in localStorage but doesn't know if it's still valid; this endpoint says yes/no in one call.

**`/api/users`** (all protected)
- `GET /` — list everyone except self (used as the address book for new chats).
- `GET /search?q=` — case-insensitive name/email search with regex escape (so users can search for "j.doe" without breaking the regex).

**`/api/rooms`** (all protected)
- `GET /` — rooms for current user, populated with members/admin/lastMessage, sorted by `updatedAt` desc.
- `POST /` — create a room. For 1-on-1, dedupes: if an existing direct room already has the same two members, returns that one instead of making a new one. For groups, requires `name` and at least 2 members. Emits `room:new` to all member sockets so their sidebars update instantly.
- `GET /:id` — fetch one room (only if member).
- `PATCH /:id` — admin-only rename / avatar.
- `POST /:id/members` — admin-only add members. Uses Set semantics so re-adding is a no-op.
- `DELETE /:id/members/:userId` — admin-only remove member, OR self-leave (a non-admin removing themselves). Admin can't be removed (would orphan the group).

Each mutation emits a `room:update` event so all members see the change in real time (sidebar refresh, settings panel rebuild).

**`/api/messages`** (all protected)
- `GET /:roomId?before=&limit=` — paginated history. Fetches descending then `.reverse()` so the array reads chronologically.
- `POST /:roomId` — REST send (fallback; clients normally use the socket event).
- `POST /:roomId/read` — bulk-mark all unread messages read by current user.

### 5.5 Socket.io layer — `server/socket/index.js`

**Authentication middleware:**
```
io.use((socket, next) => verify socket.handshake.auth.token; attach socket.userId)
```
If the token is missing or expired, the connection is rejected before any handler runs.

**Presence tracking:** an in-memory `Map<userId, Set<socketId>>` (`onlineUsers`). A user can have multiple sockets (multiple tabs); they're considered offline only when the last socket disconnects.

**On connect:**
- Add to `onlineUsers`
- `socket.join(userId)` — every user gets a personal "room" so the server can address them by id (used for incoming-call notifications and direct events).
- Mark `online: true` in the DB.
- Broadcast `presence:update` to everyone.
- Register chat + call handlers.

**On disconnect:**
- Remove from `onlineUsers`. If that was the last socket → mark offline in DB and broadcast.

### 5.6 Chat handlers — `server/socket/chatHandlers.js`

Each handler validates membership with `isMember(roomId, userId)` first.

| Event | What it does |
|---|---|
| `room:join` | `socket.join(roomId)` so the user receives `message:new` etc. emitted to that room |
| `room:leave` | Inverse |
| `message:send` | Persist to Mongo, update `room.lastMessage`, emit `message:new` to the room AND emit `room:bump` to each member's personal room (so sidebars re-sort even when not currently in the chat) |
| `typing:start` / `typing:stop` | Emit to the room except the sender |
| `message:read` | Bulk-update `readBy` on all unread messages from others, then emit `message:read` to the room with the current user's id |

Notice the dual emission on `message:send`: `message:new` is for the open chat window, `room:bump` is for the sidebar. Without the latter, a friend's new message wouldn't bubble up your sidebar unless you had their chat open.

### 5.7 Call handlers — `server/socket/callHandlers.js`

Pure relay. The server doesn't understand SDP or ICE — it just shuttles opaque blobs between two sockets:

| Event | Direction | Purpose |
|---|---|---|
| `call:invite` | caller → callee | "I'd like to call you, here's my info" |
| `call:accepted` / `call:rejected` | callee → caller | Answer to the invite |
| `call:cancel` / `call:cancelled` | caller → callee | Caller hung up before pickup |
| `call:offer` | caller → callee | SDP offer (after callee accepts) |
| `call:answer` | callee → caller | SDP answer |
| `call:ice` | bidirectional | ICE candidates as they're discovered |
| `call:end` / `call:ended` | either → other | Hangup |
| `call:unavailable` | server → caller | Callee not online |

That's it. The actual peer connection is established and managed entirely in the browsers.

---

## 6. Client walkthrough

### 6.1 Boot — `main.jsx`

```
ReactDOM.createRoot(...)
  .render(
    <BrowserRouter>      ← URL routing
      <AuthProvider>     ← user/token state
        <App />          ← routes
```

`SocketProvider` is intentionally inside the route tree (not at the root) — sockets should only exist when the user is authenticated.

### 6.2 Routing & guards — `App.jsx`

Three routes:
- `/login` and `/register` — wrapped in `<PublicOnly>` (redirects to `/` if already logged in)
- `/` — wrapped in `<Protected>` (redirects to `/login` if not), and `<Protected>` itself wraps children in `<SocketProvider>`

This means:
- The socket connection is created exactly once, when the user enters the chat app.
- On logout, the provider unmounts, the socket is cleanly disconnected (presence goes offline).

### 6.3 Auth context — `context/AuthContext.jsx`

State: `user`, `token`, `loading`.

On mount: if there's a token in `localStorage`, hits `/auth/me` to validate it. If valid → `setUser`. If 401 → wipes token, drops to login. The `loading` flag prevents a flash of the login page during this check.

Methods: `login(email, password)`, `register(name, email, password)`, `logout()`. All three update both `localStorage` and React state.

### 6.4 API client — `api/client.js`

An axios instance with two interceptors:
- **Request:** attach `Authorization: Bearer <token>` if a token exists.
- **Response:** if any API returns 401 (token expired/invalid), wipe localStorage and redirect to `/login`. This means the user is never stuck on a screen that quietly fails — they always get bounced back to log in.

### 6.5 Socket context — `context/SocketContext.jsx`

When `token` becomes available, opens `io(SOCKET_URL, { auth: { token } })`. Auto-reconnect is on. Cleanup tears it down. Exposes `{ socket, connected }`.

### 6.6 Chat orchestrator — `pages/Chat.jsx`

This is the single source of truth for the chat experience. It owns:
- `rooms` array (loaded once via REST, kept fresh via socket events)
- `activeRoomId` (which room is open)
- `incoming` (incoming call payload)
- `activeCall` (call peer + type + role)
- `showSidebar` for mobile

It listens for these socket events and updates the rooms array:
- `room:new` → prepend the new room
- `room:update` → replace the matching room
- `room:bump` → move the matched room to top + update its `lastMessage`
- `call:incoming` → set `incoming` (triggers the modal)
- `call:cancelled` → clear `incoming`

It renders `<Sidebar>`, `<ChatWindow>`, and conditionally renders the four modals (CreateGroup, GroupSettings, IncomingCall, Call).

### 6.7 Sidebar — `components/Sidebar.jsx`

Top section: current user info + connection dot + a search box + two icon buttons (`+` for new chat, `⌘` for new group).

Body: a list of `room-item`. Each shows avatar, room name, last message preview ("Alice: hello"), and the timestamp of the last message.

The sub-component `<NewChatPanel>` is a modal opened by `+`. It hits `/users` (or `/users/search` if there's a query) and lets you click any user to immediately create or open a 1-on-1 room (the server dedupes).

Mobile behavior: the sidebar gets `position: absolute; inset: 0; z-index: 5` so it covers the screen. When a chat is opened, `showSidebar` becomes false → adds `hidden-mobile` class → hidden. The chat header shows a `‹` back button on mobile to bring the sidebar back.

### 6.8 ChatWindow — `components/ChatWindow.jsx`

Renders a header with avatar, name, status, and contextual action buttons:
- 1-on-1: 📞 voice and 🎥 video buttons
- Group: ⚙ settings button (clicking the room name also opens settings)

When `roomId` changes:
1. Fetches history via `/messages/:roomId` (last 50)
2. Marks all as read
3. Emits `room:join` so the socket starts receiving events for it

Live event handlers for the open room:
- `message:new` — append (deduped by `_id`); also emit `message:read` so the other side sees the second tick
- `typing:start` / `typing:stop` — track who's typing in a state map keyed by userId; auto-clear after 3.5s if no `typing:stop` arrives (defensive against missed events)
- `message:read` — patch the affected messages' `readBy` arrays so their tick state updates

### 6.9 MessageList — `components/MessageList.jsx`

Renders messages as bubbles, mine on the right (blue), theirs on the left (dark gray). Logic worth highlighting:

- **Day separators:** while iterating, compares each message's day to the previous; on change, inserts a `{ kind: 'day', label: 'Today' | 'Yesterday' | locale-date }` row.
- **Group avatars:** shows a small initials avatar next to others' messages in groups (so you can tell who said what). Hidden in 1-on-1 (redundant).
- **Read receipt icon:** for *my* messages only. `'✓'` if at least one other member hasn't read yet, `'✓✓'` if everyone else has read. Implemented by checking that for every other member, there's an entry in `readBy`.
- **Auto-scroll:** on every messages update, `el.scrollTop = el.scrollHeight`. Simple and works for almost all real-world cases (a more sophisticated impl would only auto-scroll if the user is already near the bottom).

### 6.10 MessageInput — `components/MessageInput.jsx`

A textarea + send button. Logic:
- Enter sends, Shift+Enter newline.
- On every keystroke: if not currently "typing", emit `typing:start` and set `typing=true`. Restart a 1.5s debounce timer; when it fires, emit `typing:stop`.
- On send and on blur: emit `typing:stop` immediately.

This gives a "typing…" indicator that appears within ~50ms of typing and disappears ~1.5s after stopping.

### 6.11 Group modals

**`CreateGroupModal`:** name + avatar URL + a multi-select user list (clicking toggles a checkbox). On submit: `POST /api/rooms` with `isGroup: true`. The server emits `room:new` so all members instantly see it in their sidebars.

**`GroupSettingsModal`:** behaves differently for admin vs member.
- Admin: editable name/avatar, list of members each with a Remove button (except admin themselves), and an "Add members" panel that searches users.
- Non-admin: read-only view + a "Leave group" button.

All mutations call REST and rely on the server's `room:update` emission to re-render everywhere.

### 6.12 WebRTC hook — `hooks/useWebRTC.js`

This is the most subtle file. It's a custom hook that manages a single 1-on-1 call. Inputs: `socket`, `peerId`, `callType` (`'audio'` or `'video'`), `role` (`'caller'` or `'callee'`), `currentUser`.

Outputs: `localStream`, `remoteStream`, `status`, `error`, `muted`, `cameraOff`, plus `toggleMute`, `toggleCamera`, `endCall`.

**On mount:**
1. Calls `getUserMedia({ audio: true, video: callType === 'video' })`. Browser prompts permission. If denied → `status: 'error'`.
2. Constructs an `RTCPeerConnection` with two Google STUN servers (free public NAT-traversal helpers).
3. Adds local tracks to the peer connection.
4. Wires up callbacks:
   - `pc.ontrack` → save the incoming stream (this is what the `<video>` displays for the remote side).
   - `pc.onicecandidate` → emit `call:ice` with each candidate as it's discovered.
   - `pc.onconnectionstatechange` → flip `status` to 'connected' when ready.
5. Branch on `role`:
   - **Caller:** emits `call:invite` and waits in `'ringing'` status. (UI shows "Ringing…")
   - **Callee:** emits `call:accept` (since the user already clicked Accept on the IncomingCallModal) and waits for the offer.

**Socket events listened to:**
- `call:accepted` (caller-only) → create SDP offer, `setLocalDescription`, emit `call:offer`.
- `call:offer` (callee-only) → `setRemoteDescription`, drain queued ICE, create answer, `setLocalDescription`, emit `call:answer`.
- `call:answer` (caller-only) → `setRemoteDescription`, drain queued ICE.
- `call:ice` → if remote description is set, `addIceCandidate`; else queue (because adding ICE before the remote SDP exists throws).
- `call:ended` → clean up.
- `call:rejected` / `call:unavailable` → display error, clean up.

**Cleanup:** closes the peer connection, stops all media tracks (turns off camera light), clears state. Always runs on unmount.

The ICE-candidate-queueing is the gotcha most WebRTC tutorials skip. Browsers fire `icecandidate` events before *and after* the remote SDP arrives; if you try to `addIceCandidate` before the remote description is set, the browser throws. We catch this by buffering candidates into `pendingIceRef` and draining the queue in the offer/answer handler immediately after `setRemoteDescription`.

### 6.13 Call modals — `CallModal` & `IncomingCallModal`

`IncomingCallModal` is a thin overlay: caller name + avatar, "Incoming voice/video call…", Accept/Decline buttons. Accept triggers the parent's `acceptIncoming` which mounts `<CallModal role="callee">`.

`CallModal` does three things:
- Calls `useWebRTC` and renders a status string ("Ringing…" / "Connecting…" / "Connected" / "Call ended").
- Renders `<video>` (or audio fallback): remote video fills the screen, local video is a small picture-in-picture in the corner. Note: the local `<video>` is muted to prevent your own audio echo.
- Shows controls: Mute, Camera (video only), End/Cancel. The button shown is "Cancel" while the call is still ringing on the caller's side, "End" otherwise — semantically different (one cancels an unanswered invite, the other ends an ongoing call).

When the call ends, the modal auto-closes after 1.2s (giving the user a moment to see the status).

### 6.14 CSS strategy — `index.css`

One file, ~170 lines. Uses CSS custom properties for theming (`--bg`, `--accent`, `--bubble-mine`, etc.). This makes the dark theme cheap to maintain — to support a light theme later you'd just add a `[data-theme="light"]` block that overrides the same vars.

Layout uses CSS Grid (`grid-template-columns: 320px 1fr`) for the sidebar/chat split, Flexbox for everything else.

Responsive: a single `@media (max-width: 768px)` block flips the grid to one column, makes the sidebar a full-screen overlay, and shows the back button. No JS-driven media queries.

---

## 7. Data flow examples

### 7.1 "Alice sends 'hi' to Bob"

1. Alice types "hi" → `MessageInput` emits `typing:start`, then on Enter calls `onSend('hi')`.
2. `ChatWindow.sendMessage` → `socket.emit('message:send', { roomId, content: 'hi' })`.
3. Server (`chatHandlers.js`):
   - Validates Alice is a room member.
   - `Message.create(...)`.
   - `Room.findByIdAndUpdate(roomId, { lastMessage, updatedAt })`.
   - Populates the message with `sender.name + avatar`.
   - `io.to(roomId).emit('message:new', populated)` → Alice and Bob's open chat windows receive it.
   - `io.to(memberId).emit('room:bump', ...)` for each member → updates their sidebars even if the chat isn't open.
4. Bob's `ChatWindow` receives `message:new` → appends to messages, emits `message:read` (since he's looking at it).
5. Server emits `message:read` to the room.
6. Alice's `ChatWindow` patches the message's `readBy` → her single tick becomes a double tick.

End-to-end latency: typically <100 ms on a good connection.

### 7.2 "Alice video-calls Bob"

1. Alice clicks 🎥 → `setActiveCall({ peerId: bobId, callType: 'video', role: 'caller' })`.
2. `<CallModal>` mounts → `useWebRTC` runs:
   - `getUserMedia` prompts for camera/mic.
   - Builds `RTCPeerConnection`, adds local tracks.
   - Emits `call:invite`. Status: `'ringing'`.
3. Server relays `call:incoming` to Bob's personal room.
4. Bob's `Chat.jsx` shows `<IncomingCallModal>`.
5. Bob clicks Accept → emits `call:accept` → Alice receives `call:accepted`.
6. Alice's hook: `pc.createOffer()` → `setLocalDescription` → emits `call:offer`.
7. Bob's hook: `setRemoteDescription(offer)` → `pc.createAnswer()` → emits `call:answer`.
8. Alice's hook: `setRemoteDescription(answer)`.
9. Throughout 6–8, both sides emit `call:ice` candidates as the browser discovers paths. Each side adds them via `pc.addIceCandidate` (queueing if remote SDP isn't set yet).
10. `pc.onconnectionstatechange` fires `'connected'` on both sides → status changes to "Connected", remote video starts playing.
11. Either side clicks End → `socket.emit('call:end')` → both peer connections close, tracks stop, modals dismiss.

The server saw none of the actual audio/video — only the ~20 KB of signaling.

### 7.3 "Alice creates a group with Bob and Carol"

1. Sidebar `⌘` → `<CreateGroupModal>` opens.
2. Alice fills name "Movie Night", checks Bob and Carol → submits.
3. `POST /api/rooms` body: `{ isGroup: true, name: 'Movie Night', members: ['bob', 'carol'] }`.
4. Server creates the room with Alice as admin (id auto-added because the route always merges current user into members).
5. Server emits `room:new` to all three personal rooms.
6. All three sidebars instantly show the new group.
7. Server response includes the populated room → client switches the active room to it.

---

## 8. Security model

Layer-by-layer:

- **Passwords** — bcrypt with salt rounds 10. Never returned by any endpoint (`toPublic()` strips it).
- **Tokens** — JWT signed with a 96-character secret from `openssl rand -hex 48`. 7-day expiry. Stored in `localStorage` for simplicity (in production, consider httpOnly cookies to mitigate XSS — tradeoff is harder to attach to socket.io auth without extra wiring).
- **Authorization** — every REST mutation checks membership/admin. Every socket event checks membership. There's no "trust the client" path.
- **CORS** — server only echoes `Access-Control-Allow-Origin` if the request's `Origin` matches the configured `CLIENT_URL` (after stripping trailing slashes). Same logic applies to the Socket.io handshake.
- **Validation** — all inputs go through guard checks before hitting the DB (length minimums, required fields, regex escape on search).
- **Secrets** — `.env` is git-ignored. Only `.env.example` (with placeholder values) is committed. Production secrets are set via Render's environment variables UI.
- **Atlas** — currently `0.0.0.0/0` for simplicity, but the chat-test user has read/write only to one DB. Should be tightened to Render's outbound IPs once you have a stable deployment.

What's *not* protected (by design or future work):
- Rate limiting — would protect against brute-force registration/login. Easy to add via `express-rate-limit`.
- Message content encryption — messages are stored in plaintext in Mongo. Real E2E encryption is out of scope (complex key management).

---

## 9. Deployment journey

We deployed across three free-tier services:

1. **Atlas** (already had) — created a database user `chat-test`, allowed network access, copied the connection string.
2. **GitHub** — `git init` → committed source (no `.env`, no `node_modules`) → pushed to `BDutta999/Chit-Chat`.
3. **Render** — connected GitHub, picked the repo, set Root Directory `server`, Build Command `npm install`, Start Command `npm start`. Set env vars `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`. Got a URL like `chit-chat-spwm.onrender.com`.
4. **Vercel** — connected GitHub, picked the repo, set Root Directory `client`, framework auto-detected as Vite. Set env vars `VITE_API_URL` and `VITE_SOCKET_URL` to the Render URL. Got a URL like `chit-chat-two-tau.vercel.app`.
5. **Loop back** — updated `CLIENT_URL` on Render to the Vercel URL so CORS lets the client through.

A subtle gotcha we hit: the first attempt had a trailing slash on `VITE_API_URL` which made the client request `https://server//api/...` (double slash). We fixed by removing the slash on Vercel and also hardening the server to strip trailing slashes from origin comparisons. That fix was committed as a small follow-up so future env-var typos are tolerated.

Auto-deploy: every `git push` to `main` triggers redeploys on both Render (server) and Vercel (client) automatically. No manual steps.

---

## 10. Constraints honored

The original spec laid out hard constraints. Final state:

| Constraint | Status |
|---|---|
| No TypeScript, plain JS | ✅ |
| No UI library, plain CSS or Tailwind | ✅ Plain CSS with custom properties |
| Each file under 200 lines | ✅ Largest is `useWebRTC.js` at 183 lines |
| Environment variables for secrets | ✅ `.env.example` checked in, `.env` ignored |
| README with setup steps | ✅ |
| Folder structure as specified | ✅ `/client`, `/server`, `/server/models`, `/server/routes`, `/server/socket` |
| Build incrementally, verify each layer | ✅ Server built/tested first, then client, both verified before moving on |

---

## 11. What's not perfect / next steps

Honest list of compromises and obvious improvements:

| Area | Compromise | Easy upgrade |
|---|---|---|
| Avatars | URL-based; no upload UI | Add multer + S3 or Cloudinary upload |
| Search | Linear scan with regex | Add Atlas Search index |
| Pagination | Manual scroll, no "load more" UI | Wire up the `before` query param to a "Load earlier messages" button |
| Reconnection | Socket.io reconnects automatically, but client doesn't refetch state | On `connect` event, re-fetch rooms + history |
| TURN server | Only STUN configured; calls behind symmetric NAT will fail | Add a TURN server (e.g. Twilio's, or self-hosted coturn) to `ICE_SERVERS` |
| Groups | No "remove yourself as admin" / transfer admin | Add a "Make admin" action |
| Read receipts | Booleanish (read or not) per recipient | Show *who* has read in a tooltip |
| Reactions, attachments, forwards | Not implemented | Standard message-type extensions |
| Push notifications | None | Web Push API + service worker |
| Tests | None | At minimum, supertest for REST routes and a few hook tests |
| Render free tier | Server sleeps after 15 min idle | Either accept ~30s cold start or upgrade to paid ($7/mo) |

---

## 12. File-by-file index (with line counts)

```
SERVER
   8  server/.env.example
  51  server/index.js
  26  server/middleware/auth.js
  24  server/models/Message.js
  17  server/models/Room.js
  37  server/models/User.js
  23  server/package.json
  52  server/routes/auth.js
  82  server/routes/messages.js
 149  server/routes/rooms.js
  37  server/routes/users.js
  55  server/socket/callHandlers.js
  64  server/socket/chatHandlers.js
  68  server/socket/index.js

CLIENT
   2  client/.env.example
  13  client/index.html
  22  client/package.json
   5  client/vercel.json
   7  client/vite.config.js
  31  client/src/App.jsx
  16  client/src/main.jsx
 174  client/src/index.css
  26  client/src/api/client.js
  57  client/src/context/AuthContext.jsx
  41  client/src/context/SocketContext.jsx
 183  client/src/hooks/useWebRTC.js
  47  client/src/pages/Login.jsx
  51  client/src/pages/Register.jsx
 136  client/src/pages/Chat.jsx
 160  client/src/components/Sidebar.jsx
 156  client/src/components/ChatWindow.jsx
  78  client/src/components/MessageList.jsx
  55  client/src/components/MessageInput.jsx
  97  client/src/components/CreateGroupModal.jsx
 143  client/src/components/GroupSettingsModal.jsx
  89  client/src/components/CallModal.jsx
  32  client/src/components/IncomingCallModal.jsx
  34  client/src/utils/avatar.js
```

Roughly 2,300 lines of source code total (excluding `package-lock.json` files), implementing every feature in the original spec.

---

## 13. How to read the code, in order

If you're new to the codebase and want to understand the whole thing in one sitting, this is the order I'd suggest:

1. **`server/index.js`** — see the lifecycle.
2. **`server/models/*`** — understand the data shape.
3. **`server/middleware/auth.js`** — JWT pattern.
4. **`server/routes/auth.js`**, then **`rooms.js`**, then **`messages.js`** — REST surface.
5. **`server/socket/index.js`** + **`chatHandlers.js`** — real-time wiring.
6. **`client/src/main.jsx`** + **`App.jsx`** — entry & routes.
7. **`client/src/context/AuthContext.jsx`** — see where the user comes from.
8. **`client/src/context/SocketContext.jsx`** — and the socket.
9. **`client/src/api/client.js`** — token plumbing.
10. **`client/src/pages/Chat.jsx`** — the orchestrator. Read its state and `useEffect`s carefully.
11. **`client/src/components/Sidebar.jsx`**, **`ChatWindow.jsx`**, **`MessageList.jsx`**, **`MessageInput.jsx`** — chat UI.
12. **`client/src/components/CreateGroupModal.jsx`** + **`GroupSettingsModal.jsx`** — group operations.
13. **`server/socket/callHandlers.js`** — call signaling protocol.
14. **`client/src/hooks/useWebRTC.js`** + **`CallModal.jsx`** + **`IncomingCallModal.jsx`** — WebRTC.
15. **`client/src/index.css`** — visual layer.

Cross-reference with §7's data flow examples to see how they connect.

---

*Last updated: 2026-05-25*
