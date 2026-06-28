const mongoose = require('mongoose');
const Status = require('./models/Status');
const Chat = require('./models/Chat');
require('dotenv').config();

async function checkDb() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/msg');
  
  try {
    const statuses = await Status.find({});
    console.log('All Statuses:', statuses);
    
    const chats = await Chat.find({});
    console.log('All Chats:', chats.map(c => c.participants));
  } catch (err) {
    console.error('Check failed:', err);
  }
  
  process.exit();
}
checkDb();
