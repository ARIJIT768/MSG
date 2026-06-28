require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // For dev, allow all. In prod, lock this down to your frontend URL
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/media', require('./routes/media'));
app.use('/api/update', require('./routes/update'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// Serve React Frontend (for unified deployment on Render)
const path = require('path');
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a specific chat room
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // Handle incoming messages
  socket.on('send-message', (message) => {
    // Broadcast to the room so receiver gets it in real-time
    io.to(message.chatId).emit('receive-message', message);
    
    // Broadcast to all users that a chat updated
    io.emit('chat-updated', {
      chatId: message.chatId,
      lastMessageSender: message.senderId,
      lastMessageTime: message.createdAt
    });
  });

  // Handle delivered receipts
  socket.on('mark-delivered', async ({ chatId, readerId }) => {
    try {
      await Message.updateMany(
        { chatId, senderId: { $ne: readerId }, status: 'sent' },
        { $set: { status: 'delivered' } }
      );
      io.to(chatId).emit('messages-delivered', { chatId, readerId });
    } catch (err) {
      console.error('Error marking messages as delivered:', err);
    }
  });

  // Handle read receipts
  socket.on('mark-read', async ({ chatId, readerId }) => {
    try {
      await Message.updateMany(
        { chatId, senderId: { $ne: readerId }, status: { $ne: 'read' } },
        { $set: { status: 'read' } }
      );
      io.to(chatId).emit('messages-read', { chatId, readerId });
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  // Handle emoji reactions
  socket.on('add-reaction', async ({ messageId, chatId, username, emoji }) => {
    try {
      const message = await Message.findById(messageId);
      if (message) {
        if (!message.reactions) message.reactions = {};
        
        // If clicking the same emoji, remove it (toggle)
        if (message.reactions[username] === emoji) {
          delete message.reactions[username];
        } else {
          message.reactions[username] = emoji;
        }
        
        // Mongoose needs to know the mixed object changed
        message.markModified('reactions');
        await message.save();

        io.to(chatId).emit('message-reaction-updated', { 
          messageId, 
          reactions: message.reactions 
        });
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
