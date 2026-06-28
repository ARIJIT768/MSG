const mongoose = require('mongoose');
const Status = require('./server/models/Status');
const Chat = require('./server/models/Chat');
const User = require('./server/models/User');
require('dotenv').config({ path: './server/.env' });

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/msg');
  console.log('Connected to DB');
  
  const allStatuses = await Status.find();
  console.log('All Statuses in DB:', allStatuses.length);
  
  const allChats = await Chat.find();
  console.log('All Chats in DB:', allChats.length);
  
  if (allStatuses.length > 0) {
    const firstStatus = allStatuses[0];
    console.log('Sample Status:', firstStatus);
    
    const chatsForSender = await Chat.find({ participants: firstStatus.senderId });
    console.log(`Chats for status sender (${firstStatus.senderId}):`, chatsForSender.map(c => c.participants));
  }
  
  process.exit(0);
}

diagnose();
