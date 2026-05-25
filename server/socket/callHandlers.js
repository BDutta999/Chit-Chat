// WebRTC signaling over Socket.io.
// Server is just a relay; payloads (offer/answer/ICE) are opaque.

module.exports = function registerCall(io, socket, { isOnline }) {
  const fromId = socket.userId;

  // Caller invites callee. Payload: { toUserId, callType: 'audio'|'video', from: {id,name,avatar} }
  socket.on('call:invite', ({ toUserId, callType, from }) => {
    if (!toUserId) return;
    if (!isOnline(toUserId)) {
      socket.emit('call:unavailable', { toUserId, reason: 'offline' });
      return;
    }
    io.to(String(toUserId)).emit('call:incoming', {
      fromUserId: fromId,
      callType: callType || 'video',
      from: from || null,
    });
  });

  socket.on('call:accept', ({ toUserId }) => {
    if (!toUserId) return;
    io.to(String(toUserId)).emit('call:accepted', { fromUserId: fromId });
  });

  socket.on('call:reject', ({ toUserId, reason }) => {
    if (!toUserId) return;
    io.to(String(toUserId)).emit('call:rejected', { fromUserId: fromId, reason: reason || 'rejected' });
  });

  socket.on('call:cancel', ({ toUserId }) => {
    if (!toUserId) return;
    io.to(String(toUserId)).emit('call:cancelled', { fromUserId: fromId });
  });

  socket.on('call:offer', ({ toUserId, sdp }) => {
    if (!toUserId || !sdp) return;
    io.to(String(toUserId)).emit('call:offer', { fromUserId: fromId, sdp });
  });

  socket.on('call:answer', ({ toUserId, sdp }) => {
    if (!toUserId || !sdp) return;
    io.to(String(toUserId)).emit('call:answer', { fromUserId: fromId, sdp });
  });

  socket.on('call:ice', ({ toUserId, candidate }) => {
    if (!toUserId || !candidate) return;
    io.to(String(toUserId)).emit('call:ice', { fromUserId: fromId, candidate });
  });

  socket.on('call:end', ({ toUserId }) => {
    if (!toUserId) return;
    io.to(String(toUserId)).emit('call:ended', { fromUserId: fromId });
  });
};
