const router = require('express').Router();
const Room = require('../models/Room');
const Message = require('../models/Message');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

async function ensureMember(req, res) {
  const room = await Room.findById(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return null;
  }
  if (!room.members.some((m) => String(m) === String(req.userId))) {
    res.status(403).json({ error: 'Not a member' });
    return null;
  }
  return room;
}

// paginated history (newest last)
router.get('/:roomId', async (req, res, next) => {
  try {
    const room = await ensureMember(req, res);
    if (!room) return;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : new Date();
    const messages = await Message.find({ room: room._id, createdAt: { $lt: before } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name avatar');
    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
});

// REST send (sockets normally handle this; this is a fallback)
router.post('/:roomId', async (req, res, next) => {
  try {
    const room = await ensureMember(req, res);
    if (!room) return;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Empty message' });
    }
    const msg = await Message.create({
      room: room._id,
      sender: req.userId,
      content: content.trim(),
    });
    room.lastMessage = msg._id;
    await room.save();
    const populated = await Message.findById(msg._id).populate('sender', 'name avatar');
    req.app.get('io')?.to(String(room._id)).emit('message:new', populated);
    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
});

// mark all messages in a room as read by current user
router.post('/:roomId/read', async (req, res, next) => {
  try {
    const room = await ensureMember(req, res);
    if (!room) return;
    await Message.updateMany(
      { room: room._id, 'readBy.user': { $ne: req.userId } },
      { $push: { readBy: { user: req.userId, readAt: new Date() } } }
    );
    req.app.get('io')?.to(String(room._id)).emit('message:read', {
      roomId: String(room._id),
      userId: req.userId,
      readAt: Date.now(),
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
