const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const registerChat = require('./chatHandlers');
const registerCall = require('./callHandlers');

// userId -> Set<socketId>
const onlineUsers = new Map();

function addOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnline(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true; // last socket gone -> user offline
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(String(userId));
}

function initSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const payload = verifyToken(token);
      socket.userId = String(payload.id);
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    addOnline(userId, socket.id);
    socket.join(userId); // personal room for direct events

    try {
      await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    } catch (_) {}
    io.emit('presence:update', { userId, online: true });

    registerChat(io, socket, { isOnline });
    registerCall(io, socket, { isOnline });

    socket.on('disconnect', async () => {
      const wentOffline = removeOnline(userId, socket.id);
      if (wentOffline) {
        try {
          await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
        } catch (_) {}
        io.emit('presence:update', { userId, online: false, lastSeen: Date.now() });
      }
    });
  });
}

module.exports = initSocket;
module.exports.isOnline = isOnline;
