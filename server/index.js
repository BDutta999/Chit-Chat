require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const initSocket = require('./socket');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_, res) => res.json({ ok: true, time: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});
initSocket(io);
app.set('io', io);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[mongo] connected');
  } catch (err) {
    console.error('[mongo] connection failed:', err.message);
    process.exit(1);
  }
  server.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
}

start();
