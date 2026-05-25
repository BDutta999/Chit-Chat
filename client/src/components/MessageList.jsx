import { useEffect, useRef, useMemo } from 'react';
import { initials, colorFor } from '../utils/avatar.js';

function timeStr(d) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(d) {
  const dt = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(dt, today)) return 'Today';
  if (sameDay(dt, y)) return 'Yesterday';
  return dt.toLocaleDateString();
}

function readReceiptIcon(msg, room, currentUser) {
  if (!msg.readBy) return '✓';
  const others = (room.members || []).filter((m) => String(m._id) !== String(currentUser._id));
  if (others.length === 0) return '✓';
  const allRead = others.every((m) =>
    msg.readBy.some((r) => String(r.user) === String(m._id))
  );
  return allRead ? '✓✓' : '✓';
}

export default function MessageList({ messages, currentUser, loading, room }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const grouped = useMemo(() => {
    const out = [];
    let lastDay = '';
    messages.forEach((m) => {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) { out.push({ kind: 'day', label: day, key: `d-${day}-${m._id}` }); lastDay = day; }
      out.push({ kind: 'msg', msg: m, key: m._id });
    });
    return out;
  }, [messages]);

  if (loading) return <div className="messages center muted">Loading messages…</div>;

  return (
    <div className="messages" ref={ref}>
      {grouped.length === 0 && <div className="center muted small">Say hi 👋</div>}
      {grouped.map((g) => {
        if (g.kind === 'day') return <div key={g.key} className="day-sep"><span>{g.label}</span></div>;
        const m = g.msg;
        const sender = m.sender || {};
        const mine = String(sender._id) === String(currentUser._id);
        return (
          <div key={g.key} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
            {!mine && room.isGroup && (
              <div className="msg-avatar" style={{ background: colorFor(sender.name || '?') }}>
                {initials(sender.name)}
              </div>
            )}
            <div className="msg-bubble">
              {!mine && room.isGroup && <div className="msg-sender small">{sender.name}</div>}
              <div className="msg-text">{m.content}</div>
              <div className="msg-meta">
                <span>{timeStr(m.createdAt)}</span>
                {mine && <span className="read">{readReceiptIcon(m, room, currentUser)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
