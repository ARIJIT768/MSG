const express = require('express');
const router = express.Router();
const Status = require('../models/Status');
const Chat = require('../models/Chat');

// Get statuses for a specific user (their own + contacts)
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Get all unique participants from user's chats
    const regexUsername = new RegExp(`^${username}$`, 'i');
    const chats = await Chat.find({ participants: regexUsername });
    const contactSet = new Set();
    contactSet.add(username); // Always include own statuses
    
    chats.forEach(chat => {
      chat.participants.forEach(p => contactSet.add(p));
    });

    const uniqueContacts = Array.from(contactSet);

    // 2. Fetch unexpired statuses for these contacts
    // Note: TTL index handles physical deletion, but just in case, we query where expiresAt > now
    const now = new Date();
    const regexContacts = uniqueContacts.map(c => new RegExp(`^${c}$`, 'i'));
    const statuses = await Status.find({
      senderId: { $in: regexContacts },
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    // Group statuses by senderId for easier frontend parsing
    const groupedStatuses = {};
    
    // Create entries for all contacts who have statuses
    statuses.forEach(status => {
      if (!groupedStatuses[status.senderId]) {
        groupedStatuses[status.senderId] = {
          senderId: status.senderId,
          lastUpdateTime: status.createdAt, // Since it's sorted descending, the first one is latest
          statuses: []
        };
      }
      // Add status to the beginning of the array so it plays oldest -> newest
      groupedStatuses[status.senderId].statuses.unshift({
        id: status._id.toString(),
        mediaUrl: status.mediaUrl,
        mediaType: status.mediaType,
        caption: status.caption,
        viewers: status.viewers || [],
        createdAt: status.createdAt,
        expiresAt: status.expiresAt
      });
    });

    res.json(Object.values(groupedStatuses));
  } catch (error) {
    console.error('Fetch statuses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new status
router.post('/', async (req, res) => {
  try {
    const { senderId, mediaUrl, mediaType, caption } = req.body;
    
    if (!senderId) {
      return res.status(400).json({ error: 'senderId is required' });
    }

    const newStatus = new Status({
      senderId,
      mediaUrl,
      mediaType: mediaType || 'text',
      caption
    });

    await newStatus.save();

    res.status(201).json({
      id: newStatus._id.toString(),
      senderId: newStatus.senderId,
      mediaUrl: newStatus.mediaUrl,
      mediaType: newStatus.mediaType,
      caption: newStatus.caption,
      createdAt: newStatus.createdAt,
      expiresAt: newStatus.expiresAt
    });
  } catch (error) {
    console.error('Create status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a status
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderId } = req.query; // Ensure the user deleting is the owner

    const status = await Status.findById(id);
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    if (status.senderId !== senderId) {
      return res.status(403).json({ error: 'Unauthorized to delete this status' });
    }

    await Status.findByIdAndDelete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark status as viewed
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: 'username is required' });

    const status = await Status.findByIdAndUpdate(
      id,
      { $addToSet: { viewers: username } },
      { new: true }
    );

    if (!status) return res.status(404).json({ error: 'Status not found' });

    res.json({ success: true, viewers: status.viewers });
  } catch (error) {
    console.error('View status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
