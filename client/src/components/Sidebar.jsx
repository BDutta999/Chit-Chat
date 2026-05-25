import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { initials, colorFor, roomDisplay } from '../utils/avatar.js';

function Avatar({ name, src, size = 40 }) {
  const style = { width: size, height: size, background: colorFor(name || '?') };
  if (src) return <img className="avatar" src={src} style={{ width: size, height: size }} alt="" />;
  return <div className="avatar avatar-fallback" style={style}>{initials(name)}</div>;
}

function lastPreview(room) {
  const m = room.lastMessage;
  if (!m) return 'No messages yet';
  const who = m.sender?.name ? `${m.sender.name.split(' ')[0]}: ` : '';
  return `${who}${m.content?.slice(0, 60) || ''}`;
}

export default function Sidebar({
  visible, rooms, activeRoomId, currentUser, connected,
  onPickRoom, onCreateGroup, onLogout, onRoomsChanged,
}) {
  const [filter, setFilter] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const d = roomDisplay(r, currentUser?._id);
      return d.name.toLowerCase().includes(q);
    });
  }, [rooms, filter, currentUser]);

  return (
    <aside className={`sidebar ${visible ? '' : 'hidden-mobile'}`}>
      <header className="sidebar-head">
        <div className="me">
          <Avatar name={currentUser?.name} src={currentUser?.avatar} size={36} />
          <div className="me-text">
            <div className="me-name">{currentUser?.name}</div>
            <div className="me-status">
              <span className={`dot ${connected ? 'on' : 'off'}`} />
              {connected ? 'connected' : 'connecting…'}
            </div>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out">⏻</button>
        </div>
        <div className="row">
          <input
            className="search"
            placeholder="Search chats"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="icon-btn" onClick={() => setShowNewChat(true)} title="New chat">+</button>
          <button className="icon-btn" onClick={onCreateGroup} title="New group">⌘</button>
        </div>
      </header>

      <ul className="room-list">
        {filtered.length === 0 && <li className="empty muted">No chats yet</li>}
        {filtered.map((r) => {
          const d = roomDisplay(r, currentUser?._id);
          const active = r._id === activeRoomId;
          return (
            <li
              key={r._id}
              className={`room-item ${active ? 'active' : ''}`}
              onClick={() => onPickRoom(r._id)}
            >
              <Avatar name={d.name} src={d.avatar} />
              <div className="room-text">
                <div className="room-top">
                  <span className="room-name">{d.name}</span>
                  {r.lastMessage?.createdAt && (
                    <span className="muted small">
                      {new Date(r.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="room-sub muted">{lastPreview(r)}</div>
              </div>
            </li>
          );
        })}
      </ul>

      {showNewChat && (
        <NewChatPanel
          onClose={() => setShowNewChat(false)}
          onStarted={(room) => {
            setShowNewChat(false);
            onRoomsChanged?.();
            onPickRoom(room._id);
          }}
        />
      )}
    </aside>
  );
}

function NewChatPanel({ onClose, onStarted }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const url = q.trim() ? `/users/search?q=${encodeURIComponent(q.trim())}` : '/users';
        const { data } = await api.get(url);
        setUsers(data.users);
      } catch (_) {}
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const start = async (u) => {
    setBusyId(u._id);
    try {
      const { data } = await api.post('/rooms', { isGroup: false, members: [u._id] });
      onStarted(data.room);
    } catch (_) {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Start a new chat</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </header>
        <input
          className="search"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <ul className="user-list">
          {users.map((u) => (
            <li key={u._id} className="user-item">
              <Avatar name={u.name} src={u.avatar} />
              <div className="user-text">
                <div>{u.name}</div>
                <div className="muted small">{u.email}</div>
              </div>
              <button disabled={busyId === u._id} onClick={() => start(u)}>
                {busyId === u._id ? '…' : 'Chat'}
              </button>
            </li>
          ))}
          {users.length === 0 && <li className="empty muted">No users found</li>}
        </ul>
      </div>
    </div>
  );
}
