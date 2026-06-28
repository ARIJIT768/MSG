const mongoose = require('mongoose');

const StatusSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    index: true
  },
  mediaUrl: {
    type: String
  },
  mediaType: {
    type: String, // 'image', 'video', 'text'
    default: 'text'
  },
  caption: {
    type: String
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 24*60*60*1000), // 24 hours from now
    index: { expires: 0 } // TTL index: automatically deletes document when current time >= expiresAt
  },
  viewers: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Status', StatusSchema);
