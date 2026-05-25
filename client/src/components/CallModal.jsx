import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import useWebRTC from '../hooks/useWebRTC.js';

export default function CallModal({ call, currentUser, onClose }) {
  const { socket } = useSocket();
  const { peerId, callType, role } = call;

  const {
    localStream, remoteStream, status, error,
    muted, cameraOff, toggleMute, toggleCamera, endCall,
  } = useWebRTC({ socket, peerId, callType, role, currentUser });

  const localRef = useRef(null);
  const remoteRef = useRef(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Auto-close shortly after the call ends
  useEffect(() => {
    if (status === 'ended' || status === 'error') {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [status, onClose]);

  const hangup = () => {
    endCall();
    onClose();
  };

  const cancelInvite = () => {
    socket?.emit('call:cancel', { toUserId: peerId });
    endCall();
    onClose();
  };

  const statusLabel = {
    initializing: 'Setting up…',
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    connected: 'Connected',
    ended: 'Call ended',
    error: error || 'Error',
  }[status];

  return (
    <div className="call-overlay">
      <div className="call-status">{statusLabel}</div>

      <div className={`call-stage ${callType}`}>
        {callType === 'video' ? (
          <>
            <video ref={remoteRef} autoPlay playsInline className="remote-video" />
            <video ref={localRef} autoPlay playsInline muted className="local-video" />
          </>
        ) : (
          <>
            <div className="audio-avatar">📞</div>
            <audio ref={remoteRef} autoPlay />
            <audio ref={localRef} autoPlay muted />
          </>
        )}
      </div>

      <div className="call-controls">
        <button className={`call-btn ${muted ? 'on' : ''}`} onClick={toggleMute}>
          {muted ? '🔇 Unmute' : '🎤 Mute'}
        </button>
        {callType === 'video' && (
          <button className={`call-btn ${cameraOff ? 'on' : ''}`} onClick={toggleCamera}>
            {cameraOff ? '📷 Camera on' : '🎥 Camera off'}
          </button>
        )}
        {status === 'ringing' && role === 'caller' ? (
          <button className="call-btn end" onClick={cancelInvite}>✕ Cancel</button>
        ) : (
          <button className="call-btn end" onClick={hangup}>✕ End</button>
        )}
      </div>
    </div>
  );
}
