const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'system'], default: 'text' },
    readBy: { type: [readReceiptSchema], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
