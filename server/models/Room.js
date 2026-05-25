const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    isGroup: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

roomSchema.index({ members: 1 });

module.exports = mongoose.model('Room', roomSchema);
