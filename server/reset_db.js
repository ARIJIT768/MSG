require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Status = require('./models/Status');

async function reset() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    await User.deleteMany({});
    console.log('Cleared Users.');

    await Chat.deleteMany({});
    console.log('Cleared Chats.');

    await Message.deleteMany({});
    console.log('Cleared Messages.');

    await Status.deleteMany({});
    console.log('Cleared Statuses.');

    console.log('Database fully reset to a fresh state.');
  } catch (e) {
    console.error('Reset failed:', e);
  } finally {
    process.exit();
  }
}

reset();
