require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const User = require('./models/User');
const Status = require('./models/Status');
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

app.set('io', io);

// Store active users for presence tracking
// Key: socket.id, Value: username
const connectedUsers = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/media', require('./routes/media'));
app.use('/api/status', require('./routes/status'));
app.use('/api/update', require('./routes/update'));

app.post('/api/admin/test-message', async (req, res) => {
  try {
    const newMsg = new Message({
      chatId: req.body.chatId,
      senderId: req.body.senderId,
      text: req.body.text,
      mediaUrl: req.body.mediaUrl,
      mediaType: req.body.mediaType,
      replyTo: req.body.replyTo,
      statusReply: req.body.statusReply || null,
      status: 'sent'
    });
    await newMsg.save();
    res.json({ success: true, msg: newMsg });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message, validationError: e.errors });
  }
});

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
  let currentUsername = null;

  // Handle user coming online
  socket.on('user-connected', async (username) => {
    currentUsername = username;
    try {
      await User.findOneAndUpdate(
        { username },
        { isOnline: true },
        { new: true }
      );
      // Broadcast status change
      io.emit('user-status-changed', { username, isOnline: true });
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  });

  // Join a specific chat room
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // Handle incoming messages (Zero Latency Mode)
  socket.on('send-message', async (messageData) => {
    try {
      // Determine if recipient is online to set status to 'delivered'
      let initialStatus = 'sent';
      const chat = await Chat.findById(messageData.chatId);
      if (chat) {
        const recipientUsername = chat.participants.find(p => p !== messageData.senderId);
        if (recipientUsername) {
          // Find if recipient is online
          for (let [id, user] of connectedUsers.entries()) {
            if (user === recipientUsername) {
              initialStatus = 'delivered';
              break;
            }
          }
        }
      }

      // 1. Save to DB first
      const newMsg = new Message({
        chatId: messageData.chatId,
        senderId: messageData.senderId,
        text: messageData.text,
        mediaUrl: messageData.mediaUrl,
        mediaType: messageData.mediaType,
        replyTo: messageData.replyTo,
        statusReply: messageData.statusReply || null,
        status: initialStatus
      });

      await newMsg.save();

      // 2. Broadcast to room immediately
      io.to(messageData.chatId).emit('receive-message', {
        id: newMsg._id.toString(),
        tempId: messageData.tempId, // Send back tempId so sender can replace optimistic UI
        chatId: newMsg.chatId,
        senderId: newMsg.senderId,
        text: newMsg.text,
        mediaUrl: newMsg.mediaUrl,
        mediaType: newMsg.mediaType,
        replyTo: newMsg.replyTo,
        statusReply: newMsg.statusReply,
        status: newMsg.status,
        createdAt: newMsg.createdAt
      });
      
      // 3. Update Inbox lists for all
      io.emit('chat-updated', {
        chatId: messageData.chatId,
        lastMessageSender: messageData.senderId,
        lastMessageTime: newMsg.createdAt,
        lastMessageText: newMsg.mediaType ? (newMsg.mediaType === 'audio' ? '🎤 Voice Note' : '📷 Media') : newMsg.text
      });

      // We should also update the DB for the chat's last message!
      await Chat.findByIdAndUpdate(messageData.chatId, {
        lastMessage: newMsg.mediaType ? (newMsg.mediaType === 'audio' ? '🎤 Voice Note' : '📷 Media') : newMsg.text,
        lastMessageSender: messageData.senderId,
        lastMessageTime: newMsg.createdAt
      });
    } catch (err) {
      console.error('Error saving socket message:', err);
      socket.emit('message-error', err.toString());
    }
  });

  // --- WebRTC Signaling ---
  socket.on('call-user', (data) => {
    socket.to(data.chatId).emit('call-made', {
      offer: data.offer,
      caller: data.caller
    });
  });

  socket.on('make-answer', (data) => {
    socket.to(data.chatId).emit('answer-made', {
      answer: data.answer
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.chatId).emit('ice-candidate-received', data.candidate);
  });

  socket.on('end-call', (chatId) => {
    socket.to(chatId).emit('call-ended');
  });
  // ------------------------

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

  // Handle new status upload
  socket.on('new-status', (statusData) => {
    io.emit('user-new-status', statusData);
  });

  // Handle status deletion
  socket.on('delete-status', (statusId) => {
    io.emit('status-deleted', statusId);
  });

  // Handle status view
  socket.on('status-viewed', (data) => {
    io.emit('status-viewed', data);
  });

  // Handle typing indicators
  socket.on('typing', ({ chatId, typer }) => {
    socket.to(chatId).emit('user-typing', { chatId, typer });
  });

  socket.on('stop-typing', ({ chatId, typer }) => {
    socket.to(chatId).emit('user-stop-typing', { chatId, typer });
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    if (currentUsername) {
      try {
        const lastSeenTime = new Date();
        await User.findOneAndUpdate(
          { username: currentUsername },
          { isOnline: false, lastSeen: lastSeenTime },
          { new: true }
        );
        io.emit('user-status-changed', { 
          username: currentUsername, 
          isOnline: false, 
          lastSeen: lastSeenTime 
        });
      } catch (err) {
        console.error('Error updating offline status:', err);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
