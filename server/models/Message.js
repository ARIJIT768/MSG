const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: String, required: true }, // username of sender
  text: { type: String, default: '' }, // encrypted string
  mediaUrl: { type: String, default: null }, // url to gridfs stream
  mediaType: { type: String, enum: ['image', 'video', null], default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);
