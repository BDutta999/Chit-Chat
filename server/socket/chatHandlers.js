const Room = require('../models/Room');
const Message = require('../models/Message');

async function isMember(roomId, userId) {
  const room = await Room.findById(roomId).select('members');
  if (!room) return false;
  return room.members.some((m) => String(m) === String(userId));
}

module.exports = function registerChat(io, socket) {
  const userId = socket.userId;

  socket.on('room:join', async (roomId) => {
    if (!(await isMember(roomId, userId))) return;
    socket.join(String(roomId));
  });

  socket.on('room:leave', (roomId) => {
    socket.leave(String(roomId));
  });

  socket.on('message:send', async ({ roomId, content }, ack) => {
    try {
      if (!content || !content.trim()) return ack?.({ error: 'Empty message' });
      if (!(await isMember(roomId, userId))) return ack?.({ error: 'Not a member' });

      const msg = await Message.create({
        room: roomId,
        sender: userId,
        content: content.trim(),
      });
      await Room.findByIdAndUpdate(roomId, { lastMessage: msg._id, updatedAt: new Date() });
      const populated = await Message.findById(msg._id).populate('sender', 'name avatar');

      io.to(String(roomId)).emit('message:new', populated);
      // also emit to members not currently in the room (sidebar preview update)
      const room = await Room.findById(roomId).select('members');
      room?.members.forEach((m) => {
        io.to(String(m)).emit('room:bump', { roomId: String(roomId), lastMessage: populated });
      });
      ack?.({ ok: true, message: populated });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('typing:start', async ({ roomId }) => {
    if (!(await isMember(roomId, userId))) return;
    socket.to(String(roomId)).emit('typing:start', { roomId, userId });
  });

  socket.on('typing:stop', ({ roomId }) => {
    socket.to(String(roomId)).emit('typing:stop', { roomId, userId });
  });

  socket.on('message:read', async ({ roomId }) => {
    if (!(await isMember(roomId, userId))) return;
    await Message.updateMany(
      { room: roomId, 'readBy.user': { $ne: userId }, sender: { $ne: userId } },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );
    io.to(String(roomId)).emit('message:read', { roomId, userId, readAt: Date.now() });
  });
};
