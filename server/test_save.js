const mongoose = require('mongoose');
const Message = require('./models/Message');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/msg');
  
  try {
    const newMsg = new Message({
      chatId: new mongoose.Types.ObjectId(),
      senderId: 'arijit',
      text: 'Test',
      mediaUrl: undefined,
      mediaType: undefined,
      replyTo: null,
      statusReply: null,
      status: 'sent'
    });
    
    await newMsg.save();
    console.log('Successfully saved!');
    await Message.findByIdAndDelete(newMsg._id);
  } catch (err) {
    console.error('Save failed:', err);
  }
  
  process.exit();
}
test();
