import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { initials, colorFor } from '../utils/avatar.js';

export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

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

  const toggle = (id) => {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('Group name required');
    if (picked.size === 0) return setErr('Pick at least one member');
    setBusy(true);
    try {
      const { data } = await api.post('/rooms', {
        isGroup: true,
        name: name.trim(),
        avatar: avatar.trim(),
        members: [...picked],
      });
      onCreated(data.room);
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to create group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal-head">
          <h3>New group</h3>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </header>
        {err && <div className="error">{err}</div>}
        <label>Group name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>Avatar URL (optional)
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
        </label>
        <input
          className="search"
          placeholder="Search users to add"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="user-list scrollable">
          {users.map((u) => (
            <li key={u._id} className="user-item" onClick={() => toggle(u._id)}>
              <div className="avatar avatar-fallback"
                style={{ width: 36, height: 36, background: colorFor(u.name) }}>
                {initials(u.name)}
              </div>
              <div className="user-text">
                <div>{u.name}</div>
                <div className="muted small">{u.email}</div>
              </div>
              <input type="checkbox" checked={picked.has(u._id)} readOnly />
            </li>
          ))}
          {users.length === 0 && <li className="empty muted">No users</li>}
        </ul>
        <footer className="modal-foot">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy}>{busy ? 'Creating…' : `Create (${picked.size})`}</button>
        </footer>
      </form>
    </div>
  );
}
