import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { initials, colorFor } from '../utils/avatar.js';

export default function GroupSettingsModal({ room, currentUser, onClose, onChanged }) {
  const isAdmin = String(room.admin?._id || room.admin) === String(currentUser?._id);
  const [name, setName] = useState(room.name || '');
  const [avatar, setAvatar] = useState(room.avatar || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!pickerOpen) return;
    const memberIds = new Set((room.members || []).map((m) => String(m._id)));
    const t = setTimeout(async () => {
      try {
        const url = q.trim() ? `/users/search?q=${encodeURIComponent(q.trim())}` : '/users';
        const { data } = await api.get(url);
        setCandidates(data.users.filter((u) => !memberIds.has(String(u._id))));
      } catch (_) {}
    }, 200);
    return () => clearTimeout(t);
  }, [q, pickerOpen, room.members]);

  const saveMeta = async () => {
    setErr(''); setBusy(true);
    try {
      await api.patch(`/rooms/${room._id}`, { name: name.trim(), avatar: avatar.trim() });
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Save failed');
    } finally { setBusy(false); }
  };

  const addMember = async (uid) => {
    setBusy(true);
    try {
      await api.post(`/rooms/${room._id}/members`, { userIds: [uid] });
      setCandidates((cs) => cs.filter((c) => c._id !== uid));
      onChanged?.();
    } finally { setBusy(false); }
  };

  const removeMember = async (uid) => {
    if (!confirm('Remove this member?')) return;
    setBusy(true);
    try {
      await api.delete(`/rooms/${room._id}/members/${uid}`);
      onChanged?.();
    } finally { setBusy(false); }
  };

  const leave = async () => {
    if (!confirm('Leave this group?')) return;
    setBusy(true);
    try {
      await api.delete(`/rooms/${room._id}/members/${currentUser._id}`);
      onChanged?.();
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Group settings</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </header>
        {err && <div className="error">{err}</div>}

        <label>Name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </label>
        <label>Avatar URL
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} disabled={!isAdmin} />
        </label>
        {isAdmin && (
          <button onClick={saveMeta} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        )}

        <h4 style={{ marginTop: 16 }}>Members ({room.members?.length || 0})</h4>
        <ul className="user-list scrollable">
          {(room.members || []).map((m) => {
            const adminTag = String(m._id) === String(room.admin?._id || room.admin);
            return (
              <li key={m._id} className="user-item">
                <div className="avatar avatar-fallback"
                  style={{ width: 36, height: 36, background: colorFor(m.name) }}>
                  {initials(m.name)}
                </div>
                <div className="user-text">
                  <div>{m.name} {adminTag && <span className="tag">admin</span>}</div>
                  <div className="muted small">{m.email}</div>
                </div>
                {isAdmin && !adminTag && (
                  <button onClick={() => removeMember(m._id)} disabled={busy}>Remove</button>
                )}
              </li>
            );
          })}
        </ul>

        {isAdmin && (
          <>
            <button onClick={() => setPickerOpen((v) => !v)} style={{ marginTop: 8 }}>
              {pickerOpen ? 'Close picker' : '+ Add members'}
            </button>
            {pickerOpen && (
              <>
                <input className="search" placeholder="Search users" value={q}
                  onChange={(e) => setQ(e.target.value)} />
                <ul className="user-list scrollable">
                  {candidates.map((u) => (
                    <li key={u._id} className="user-item">
                      <div className="avatar avatar-fallback"
                        style={{ width: 36, height: 36, background: colorFor(u.name) }}>
                        {initials(u.name)}
                      </div>
                      <div className="user-text">
                        <div>{u.name}</div>
                        <div className="muted small">{u.email}</div>
                      </div>
                      <button onClick={() => addMember(u._id)} disabled={busy}>Add</button>
                    </li>
                  ))}
                  {candidates.length === 0 && <li className="empty muted">No users</li>}
                </ul>
              </>
            )}
          </>
        )}

        {!isAdmin && (
          <button onClick={leave} disabled={busy} style={{ marginTop: 12 }}>Leave group</button>
        )}
      </div>
    </div>
  );
}
