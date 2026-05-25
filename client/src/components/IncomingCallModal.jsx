import { initials, colorFor } from '../utils/avatar.js';

export default function IncomingCallModal({ data, onAccept, onReject }) {
  const name = data?.from?.name || 'Unknown';
  const avatar = data?.from?.avatar;
  const isVideo = data?.callType === 'video';

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="modal incoming-call" onClick={(e) => e.stopPropagation()}>
        <div className="incoming-avatar">
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <div className="avatar avatar-fallback big-avatar"
              style={{ background: colorFor(name) }}>
              {initials(name)}
            </div>
          )}
        </div>
        <h3>{name}</h3>
        <p className="muted">Incoming {isVideo ? 'video' : 'voice'} call…</p>
        <div className="call-controls">
          <button className="call-btn end" onClick={onReject}>✕ Decline</button>
          <button className="call-btn accept" onClick={onAccept}>
            {isVideo ? '🎥 Accept' : '📞 Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
