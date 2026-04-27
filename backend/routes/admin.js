const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get volunteers related to admin-owned events (admin)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id })
      .select('title volunteers pendingVolunteers')
      .populate({ path: 'volunteers', select: 'name email role createdAt', match: { role: 'volunteer' } })
      .populate({ path: 'pendingVolunteers', select: 'name email role createdAt', match: { role: 'volunteer' } });

    const assignments = [];

    for (const event of events) {
      for (const volunteer of event.volunteers || []) {
        if (!volunteer) continue;
        assignments.push({
          eventId: event._id,
          eventTitle: event.title,
          status: 'confirmed',
          volunteer: {
            _id: volunteer._id,
            name: volunteer.name,
            email: volunteer.email,
            role: volunteer.role,
            createdAt: volunteer.createdAt
          }
        });
      }

      for (const volunteer of event.pendingVolunteers || []) {
        if (!volunteer) continue;
        assignments.push({
          eventId: event._id,
          eventTitle: event.title,
          status: 'pending',
          volunteer: {
            _id: volunteer._id,
            name: volunteer.name,
            email: volunteer.email,
            role: volunteer.role,
            createdAt: volunteer.createdAt
          }
        });
      }
    }

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create user (admin)
router.post('/users', auth, adminAuth, async (req, res) => {
  return res.status(403).json({ message: 'Direct user creation is disabled. Use signup flow.' });
});

// Update user (admin)
router.put('/users/:id', auth, adminAuth, async (req, res) => {
  return res.status(403).json({ message: 'Direct user updates are disabled. Manage volunteers per event.' });
});

// Delete user (admin)
router.delete('/users/:id', auth, adminAuth, async (req, res) => {
  return res.status(403).json({ message: 'Direct user deletion is disabled. Remove volunteers from events instead.' });
});

// Get all events with participants (admin)
router.get('/events', auth, adminAuth, async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id })
      .populate({ path: 'volunteers', select: 'name email role', match: { role: 'volunteer' } })
      .populate({ path: 'pendingVolunteers', select: 'name email role', match: { role: 'volunteer' } })
      .populate('createdBy', 'name email role');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Dashboard stats (admin)
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
    const totalEvents = await Event.countDocuments({ createdBy: req.user._id });
    const activeParticipants = await Event.aggregate([
      { $match: { createdBy: req.user._id } },
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
