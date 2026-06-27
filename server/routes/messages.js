const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Chat = require('../models/Chat');

// Get messages for a chat
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      senderId: msg.senderId,
      text: msg.text,
      mediaUrl: msg.mediaUrl,
      mediaType: msg.mediaType,
      createdAt: msg.createdAt
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message (HTTP fallback/upload flow)
router.post('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, text, mediaUrl, mediaType } = req.body;

    const newMessage = new Message({
      chatId,
      senderId,
      text,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      createdAt: new Date()
    });

    await newMessage.save();

    // Determine preview text for chat list
    let previewText = text;
    if (mediaUrl) {
      if (mediaType === 'video') previewText = '🎥 Video';
      else if (mediaType === 'image') previewText = '📷 Photo';
    }

    // Update Chat lastMessage
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: previewText,
      lastMessageSender: senderId,
      lastMessageTime: new Date()
    });

    // We emit via socket.io in the controller or from the frontend directly.
    // The frontend will receive the response and then can emit 'new-message'.
    
    res.status(201).json({
      id: newMessage._id.toString(),
      senderId: newMessage.senderId,
      text: newMessage.text,
      mediaUrl: newMessage.mediaUrl,
      mediaType: newMessage.mediaType,
      createdAt: newMessage.createdAt
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
