const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, pin, profilePicUrl } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash the PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    // Create user
    const newUser = new User({
      username,
      pinHash,
      profilePicUrl: profilePicUrl || null
    });

    await newUser.save();

    res.status(201).json({ 
      success: true, 
      user: {
        username: newUser.username,
        profilePicUrl: newUser.profilePicUrl,
        registeredAt: newUser.registeredAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login (Verify PIN)
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(pin, user.pinHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    res.json({
      success: true,
      user: {
        username: user.username,
        profilePicUrl: user.profilePicUrl,
        registeredAt: user.registeredAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (for creating new chats)
router.get('/users', async (req, res) => {
  try {
    // In a real app we'd paginate or search, but returning all for now to match old behavior
    const users = await User.find({}, 'username profilePicUrl');
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
