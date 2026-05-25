const router = require('express').Router();
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

// list all users except self (for starting chats / adding to groups)
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('email name avatar online lastSeen')
      .sort({ name: 1 })
      .limit(200);
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [{ name: re }, { email: re }],
    })
      .select('email name avatar online lastSeen')
      .limit(20);
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
