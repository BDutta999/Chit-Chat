const router = require('express').Router();
const User = require('../models/User');
const { signToken, authRequired } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, name required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 chars' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const user = await User.create({ email, password, name });
    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
