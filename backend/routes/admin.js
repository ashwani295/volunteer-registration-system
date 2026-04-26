const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create user (admin)
router.post('/users', auth, adminAuth, async (req, res) => {
  const user = new User(req.body);
  try {
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update user (admin)
router.put('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete user (admin)
router.delete('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all events with participants (admin)
router.get('/events', auth, adminAuth, async (req, res) => {
  try {
    const events = await Event.find().populate('volunteers', 'name email');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Dashboard stats (admin)
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
    const totalEvents = await Event.countDocuments();
    const activeParticipants = await Event.aggregate([
      { $unwind: '$volunteers' },
      { $group: { _id: null, count: { $addToSet: '$volunteers' } } },
      { $project: { count: { $size: '$count' } } }
    ]);
    res.json({
      totalVolunteers,
      totalEvents,
      activeParticipants: activeParticipants[0]?.count || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;