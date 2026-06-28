const mongoose = require('mongoose');
const Status = require('./models/Status');
const Chat = require('./models/Chat');

require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/msg');
  
  const statuses = await Status.find();
  console.log('Total statuses:', statuses.length);
  
  const chats = await Chat.find();
  console.log('Total chats:', chats.length);
  
  for (let s of statuses) {
    console.log(`Status by ${s.senderId}`);
    const c = await Chat.find({ participants: s.senderId });
    console.log(` Chats involving ${s.senderId}:`, c.map(ch => ch.participants));
  }
  
  process.exit();
}

test();
