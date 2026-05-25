import { useEffect, useState, useRef } from 'react';
import api from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';
import { initials, colorFor, roomDisplay } from '../utils/avatar.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

function Avatar({ name, src, size = 36 }) {
  if (src) return <img className="avatar" src={src} style={{ width: size, height: size }} alt="" />;
  return (
    <div className="avatar avatar-fallback"
      style={{ width: size, height: size, background: colorFor(name || '?') }}>
      {initials(name)}
    </div>
  );
}

export default function ChatWindow({ room, currentUser, onBack, onOpenSettings, onStartCall }) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // userId -> name
  const [loading, setLoading] = useState(false);
  const typingTimeouts = useRef({});

  const roomId = room?._id;
  const display = room ? roomDisplay(room, currentUser?._id) : null;

  // Load history when room changes
  useEffect(() => {
    if (!roomId) { setMessages([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/messages/${roomId}`);
        if (!cancelled) setMessages(data.messages);
        await api.post(`/messages/${roomId}/read`).catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Real-time message + typing + read events
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('room:join', roomId);

    const onMsg = (m) => {
      if (String(m.room) !== String(roomId)) return;
      setMessages((xs) => (xs.some((x) => x._id === m._id) ? xs : [...xs, m]));
      if (String(m.sender?._id || m.sender) !== String(currentUser?._id)) {
        socket.emit('message:read', { roomId });
      }
    };
    const onTypingStart = ({ roomId: r, userId }) => {
      if (String(r) !== String(roomId) || String(userId) === String(currentUser?._id)) return;
      const member = (room?.members || []).find((m) => String(m._id) === String(userId));
      setTypingUsers((u) => ({ ...u, [userId]: member?.name || 'Someone' }));
      clearTimeout(typingTimeouts.current[userId]);
      typingTimeouts.current[userId] = setTimeout(() => {
        setTypingUsers((u) => { const n = { ...u }; delete n[userId]; return n; });
      }, 3500);
    };
    const onTypingStop = ({ roomId: r, userId }) => {
      if (String(r) !== String(roomId)) return;
      clearTimeout(typingTimeouts.current[userId]);
      setTypingUsers((u) => { const n = { ...u }; delete n[userId]; return n; });
    };
    const onRead = ({ roomId: r, userId, readAt }) => {
      if (String(r) !== String(roomId)) return;
      setMessages((xs) => xs.map((m) => {
        if (String(m.sender?._id || m.sender) !== String(currentUser?._id)) return m;
        if (m.readBy?.some((x) => String(x.user) === String(userId))) return m;
        return { ...m, readBy: [...(m.readBy || []), { user: userId, readAt }] };
      }));
    };

    socket.on('message:new', onMsg);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onMsg);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('message:read', onRead);
    };
  }, [socket, roomId, currentUser, room]);

  const sendMessage = (content) => {
    if (!socket || !roomId) return;
    socket.emit('message:send', { roomId, content }, (resp) => {
      if (resp?.error) console.warn('send failed:', resp.error);
    });
  };

  const onTyping = (typing) => {
    if (!socket || !roomId) return;
    socket.emit(typing ? 'typing:start' : 'typing:stop', { roomId });
  };

  if (!room) {
    return (
      <main className="chat-window empty">
        <div className="placeholder muted">
          <div className="big">💬</div>
          <p>Select a chat or start a new one</p>
        </div>
      </main>
    );
  }

  const callPeerId = !room.isGroup
    ? room.members?.find((m) => String(m._id) !== String(currentUser?._id))?._id
    : null;
  const typingNames = Object.values(typingUsers);

  return (
    <main className="chat-window">
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} title="Back">‹</button>
        <Avatar name={display.name} src={display.avatar} />
        <div className="head-text" onClick={room.isGroup ? onOpenSettings : undefined}
             style={{ cursor: room.isGroup ? 'pointer' : 'default' }}>
          <div className="head-name">{display.name}</div>
          <div className="head-sub muted">{display.subtitle}</div>
        </div>
        <div className="head-actions">
          {!room.isGroup && callPeerId && (
            <>
              <button className="icon-btn" title="Voice call"
                onClick={() => onStartCall(callPeerId, 'audio')}>📞</button>
              <button className="icon-btn" title="Video call"
                onClick={() => onStartCall(callPeerId, 'video')}>🎥</button>
            </>
          )}
          {room.isGroup && (
            <button className="icon-btn" title="Group settings" onClick={onOpenSettings}>⚙</button>
          )}
        </div>
      </header>

      <MessageList messages={messages} currentUser={currentUser} loading={loading} room={room} />

      {typingNames.length > 0 && (
        <div className="typing muted small">
          {typingNames.slice(0, 2).join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
        </div>
      )}

      <MessageInput onSend={sendMessage} onTyping={onTyping} />
    </main>
  );
}
