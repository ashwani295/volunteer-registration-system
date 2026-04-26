const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all events
router.get('/events', auth, async (req, res) => {
  try {
    const events = await Event.find().populate('volunteers', 'name email');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sign up for event
router.post('/events/:id/signup', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.volunteers.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already signed up' });
    }

    event.volunteers.push(req.user._id);
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate('volunteers', 'name email')
      .populate('createdBy', 'name email');

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('volunteer-signed-up', {
      event: updatedEvent,
      volunteer: req.user
    });

    res.json({ message: 'Signed up successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel participation
router.post('/events/:id/cancel', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    event.volunteers = event.volunteers.filter(id => id.toString() !== req.user._id.toString());
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate('volunteers', 'name email')
      .populate('createdBy', 'name email');

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('volunteer-cancelled', {
      event: updatedEvent,
      volunteer: req.user
    });

    res.json({ message: 'Participation cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const events = await Event.find({ volunteers: req.user._id }).select('title date startTime endTime location');
    res.json({ user, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update availability
router.put('/availability', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.availability = req.body.availability;
    await user.save();
    res.json({ message: 'Availability updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;