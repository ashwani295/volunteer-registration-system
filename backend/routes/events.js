const express = require('express');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');
const { validateEvent } = require('../middleware/validation');

const router = express.Router();

// Get all events (public for viewing)
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('volunteers', 'name email').populate('createdBy', 'name email');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create event (admin)
router.post('/', auth, adminAuth, validateEvent, async (req, res) => {
  const event = new Event({
    ...req.body,
    createdBy: req.user._id
  });
  try {
    const newEvent = await event.save();
    const populatedEvent = await Event.findById(newEvent._id).populate('volunteers', 'name email').populate('createdBy', 'name email');

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('event-created', populatedEvent);

    res.status(201).json(populatedEvent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update event (admin)
router.put('/:id', auth, adminAuth, validateEvent, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('volunteers', 'name email')
      .populate('createdBy', 'name email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('event-updated', event);

    res.json(event);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete event (admin)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('event-deleted', { id: req.params.id });

    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign volunteer to event (admin)
router.post('/:id/assign/:volunteerId', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!event.volunteers.includes(req.params.volunteerId)) {
      event.volunteers.push(req.params.volunteerId);
      await event.save();
    }
    res.json({ message: 'Volunteer assigned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove volunteer from event (admin)
router.post('/:id/remove/:volunteerId', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    event.volunteers = event.volunteers.filter(id => id.toString() !== req.params.volunteerId);
    await event.save();
    res.json({ message: 'Volunteer removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;