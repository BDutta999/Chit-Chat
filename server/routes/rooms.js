const router = require('express').Router();
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

const populateRoom = (q) =>
  q
    .populate('members', 'name email avatar online lastSeen')
    .populate('admin', 'name email avatar')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name avatar' },
    });

// list rooms for current user, sorted by latest activity
router.get('/', async (req, res, next) => {
  try {
    const rooms = await populateRoom(
      Room.find({ members: req.userId }).sort({ updatedAt: -1 })
    );
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

// create room: 1-on-1 (isGroup=false, members=[otherId]) or group (isGroup=true)
router.post('/', async (req, res, next) => {
  try {
    const { isGroup = false, name = '', avatar = '', members = [] } = req.body;
    const memberIds = [...new Set([req.userId, ...members].map(String))];
    if (memberIds.length < 2) {
      return res.status(400).json({ error: 'Room needs at least 2 members' });
    }
    if (!isGroup && memberIds.length !== 2) {
      return res.status(400).json({ error: '1-on-1 room must have exactly 2 members' });
    }
    if (isGroup && !name.trim()) {
      return res.status(400).json({ error: 'Group name required' });
    }

    if (!isGroup) {
      const existing = await populateRoom(
        Room.findOne({
          isGroup: false,
          members: { $all: memberIds, $size: 2 },
        })
      );
      if (existing) return res.json({ room: existing });
    }

    const room = await Room.create({
      isGroup,
      name: isGroup ? name.trim() : '',
      avatar,
      members: memberIds,
      admin: isGroup ? req.userId : undefined,
    });
    const populated = await populateRoom(Room.findById(room._id));
    req.app.get('io')?.to(memberIds.map(String)).emit('room:new', populated);
    res.status(201).json({ room: populated });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const room = await populateRoom(Room.findById(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.some((m) => String(m._id) === String(req.userId))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

// admin-only: rename / change avatar
router.patch('/:id', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.isGroup) return res.status(400).json({ error: 'Not a group' });
    if (String(room.admin) !== String(req.userId)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      room.name = req.body.name.trim();
    }
    if (typeof req.body.avatar === 'string') room.avatar = req.body.avatar;
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    req.app.get('io')?.to(room.members.map(String)).emit('room:update', populated);
    res.json({ room: populated });
  } catch (err) {
    next(err);
  }
});

// admin-only: add members
router.post('/:id/members', async (req, res, next) => {
  try {
    const { userIds = [] } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room || !room.isGroup) return res.status(404).json({ error: 'Group not found' });
    if (String(room.admin) !== String(req.userId)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const set = new Set(room.members.map(String));
    userIds.forEach((id) => set.add(String(id)));
    room.members = [...set].map((id) => new mongoose.Types.ObjectId(id));
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    req.app.get('io')?.to(room.members.map(String)).emit('room:update', populated);
    res.json({ room: populated });
  } catch (err) {
    next(err);
  }
});

// admin-only: remove member (or self-leave)
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.isGroup) return res.status(404).json({ error: 'Group not found' });
    const isAdmin = String(room.admin) === String(req.userId);
    const isSelf = String(req.params.userId) === String(req.userId);
    if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Not allowed' });
    if (String(room.admin) === String(req.params.userId)) {
      return res.status(400).json({ error: 'Admin cannot be removed' });
    }
    const before = room.members.map(String);
    room.members = room.members.filter((m) => String(m) !== String(req.params.userId));
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    req.app.get('io')?.to(before).emit('room:update', populated);
    res.json({ room: populated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.populateRoom = populateRoom;
