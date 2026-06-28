require('dotenv').config();
const mongoose = require('mongoose');
const Status = require('./models/Status');
const Chat = require('./models/Chat');
const User = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");
  
  const statuses = await Status.find({});
  console.log("Statuses in DB:", statuses.map(s => ({ id: s._id, sender: s.senderId, expiresAt: s.expiresAt })));

  const chats = await Chat.find({});
  console.log("Chats in DB:", chats.map(c => ({ id: c._id, participants: c.participants })));

  const users = await User.find({});
  console.log("Users in DB:", users.map(u => u.username));

  process.exit();
}
run().catch(console.error);
