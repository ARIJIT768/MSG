const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// Get all chats for a specific user
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const chats = await Chat.find({ participants: username }).sort({ lastMessageTime: -1 });
    
    // Format to match old Firebase structure
    const formattedChats = chats.map(chat => ({
      id: chat._id.toString(),
      participants: chat.participants,
      lastMessage: chat.lastMessage,
      lastMessageSender: chat.lastMessageSender,
      lastMessageTime: chat.lastMessageTime
    }));

    res.json(formattedChats);
  } catch (error) {
    console.error('Fetch chats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new chat or return existing
router.post('/', async (req, res) => {
  try {
    const { participants } = req.body;
    
    if (!participants || participants.length !== 2) {
      return res.status(400).json({ error: 'Invalid participants' });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: participants }
    });

    if (existingChat) {
      return res.json({ id: existingChat._id.toString() });
    }

    // Create new chat
    const newChat = new Chat({
      participants,
      lastMessage: null,
      lastMessageSender: null,
      lastMessageTime: new Date()
    });

    await newChat.save();

    res.status(201).json({ id: newChat._id.toString() });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
