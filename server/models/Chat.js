const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{ type: String, required: true }],
  lastMessage: { type: String, default: null },
  lastMessageSender: { type: String, default: null },
  lastMessageTime: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
