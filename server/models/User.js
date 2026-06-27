const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  pinHash: { type: String, required: true },
  profilePicFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  profilePicUrl: { type: String, default: null },
  registeredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
