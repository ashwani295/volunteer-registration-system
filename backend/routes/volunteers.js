const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');

const router = express.Router();

const populateEvent = query => query
  .populate({ path: 'volunteers', select: 'name email role', match: { role: 'volunteer' } })
  .populate({ path: 'pendingVolunteers', select: 'name email role', match: { role: 'volunteer' } })
  .populate('createdBy', 'name email role');

// Get all events
router.get('/events', auth, async (req, res) => {
  try {
    const events = await populateEvent(Event.find());
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sign up for event
router.post('/events/:id/signup', auth, async (req, res) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ message: 'Only volunteers can request to join events' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.createdBy.toString() === req.user._id) {
      return res.status(403).json({ message: 'Admins cannot join their own events' });
    }

    if (event.volunteers.some(id => id.toString() === req.user._id)) {
      return res.status(400).json({ message: 'Already confirmed for this event' });
    }

    if (event.pendingVolunteers.some(id => id.toString() === req.user._id)) {
      return res.status(400).json({ message: 'Your request is already pending' });
    }

    if (event.volunteers.length >= event.requiredVolunteers) {
      return res.status(400).json({ message: 'Event is full' });
    }

    event.pendingVolunteers.push(req.user._id);
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('volunteer-pending', {
      event: updatedEvent,
      volunteer: req.user
    });

    res.json({ message: 'Join request sent. Waiting for admin confirmation.', event: updatedEvent });
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
    event.pendingVolunteers = event.pendingVolunteers.filter(id => id.toString() !== req.user._id.toString());
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));

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
    const events = await Event.find({
      $or: [
        { volunteers: req.user._id },
        { pendingVolunteers: req.user._id }
      ]
    }).select('title date startTime endTime location volunteers pendingVolunteers');
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
