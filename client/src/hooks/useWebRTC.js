import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// 1-on-1 WebRTC over Socket.io signaling.
// role: 'caller' | 'callee'  | callType: 'audio' | 'video'
export default function useWebRTC({ socket, peerId, callType, role, currentUser }) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('initializing'); // initializing|ringing|connecting|connected|ended|error
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch (_) {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingIceRef.current = [];
  }, []);

  const endCall = useCallback(() => {
    if (status === 'ended') return;
    socket?.emit('call:end', { toUserId: peerId });
    setStatus('ended');
    cleanup();
  }, [socket, peerId, cleanup, status]);

  // toggles
  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  useEffect(() => {
    if (!socket || !peerId) return;
    let cancelled = false;

    async function init() {
      try {
        const constraints = { audio: true, video: callType === 'video' };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (ev) => setRemoteStream(ev.streams[0]);
        pc.onicecandidate = (ev) => {
          if (ev.candidate) socket.emit('call:ice', { toUserId: peerId, candidate: ev.candidate });
        };
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === 'connected') setStatus('connected');
          else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
            setStatus((prev) => (prev === 'ended' ? prev : 'ended'));
          }
        };

        if (role === 'caller') {
          setStatus('ringing');
          socket.emit('call:invite', {
            toUserId: peerId,
            callType,
            from: { id: currentUser?._id, name: currentUser?.name, avatar: currentUser?.avatar },
          });
        } else {
          // Callee already accepted; tell caller to start sending offer
          setStatus('connecting');
          socket.emit('call:accept', { toUserId: peerId });
        }
      } catch (e) {
        setError(e.message || 'Could not access mic/camera');
        setStatus('error');
      }
    }
    init();

    const onAccepted = async ({ fromUserId }) => {
      if (String(fromUserId) !== String(peerId) || role !== 'caller') return;
      setStatus('connecting');
      const pc = pcRef.current;
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { toUserId: peerId, sdp: pc.localDescription });
    };
    const onOffer = async ({ fromUserId, sdp }) => {
      if (String(fromUserId) !== String(peerId) || role !== 'callee') return;
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(c); } catch (_) {}
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { toUserId: peerId, sdp: pc.localDescription });
    };
    const onAnswer = async ({ fromUserId, sdp }) => {
      if (String(fromUserId) !== String(peerId) || role !== 'caller') return;
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(c); } catch (_) {}
      }
      pendingIceRef.current = [];
    };
    const onIce = async ({ fromUserId, candidate }) => {
      if (String(fromUserId) !== String(peerId)) return;
      const pc = pcRef.current;
      if (!pc) return;
      const c = new RTCIceCandidate(candidate);
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        pendingIceRef.current.push(c);
      } else {
        try { await pc.addIceCandidate(c); } catch (_) {}
      }
    };
    const onEnded = ({ fromUserId }) => {
      if (String(fromUserId) !== String(peerId)) return;
      setStatus('ended');
      cleanup();
    };
    const onRejected = ({ fromUserId }) => {
      if (String(fromUserId) !== String(peerId)) return;
      setError('Call rejected');
      setStatus('ended');
      cleanup();
    };
    const onUnavailable = ({ toUserId, reason }) => {
      if (String(toUserId) !== String(peerId)) return;
      setError(reason === 'offline' ? 'User is offline' : 'Unavailable');
      setStatus('ended');
      cleanup();
    };

    socket.on('call:accepted', onAccepted);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:ended', onEnded);
    socket.on('call:rejected', onRejected);
    socket.on('call:unavailable', onUnavailable);

    return () => {
      cancelled = true;
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:ended', onEnded);
      socket.off('call:rejected', onRejected);
      socket.off('call:unavailable', onUnavailable);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, peerId, callType, role]);

  return { localStream, remoteStream, status, error, muted, cameraOff, toggleMute, toggleCamera, endCall };
}
