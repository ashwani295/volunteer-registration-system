const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const { validateEvent } = require('../middleware/validation');

const router = express.Router();

const populateEvent = query => query
  .populate({ path: 'volunteers', select: 'name email role', match: { role: 'volunteer' } })
  .populate({ path: 'pendingVolunteers', select: 'name email role', match: { role: 'volunteer' } })
  .populate('createdBy', 'name email role');

const isEventOwner = (event, userId) => event.createdBy.toString() === userId.toString();

// Get all events (public for viewing)
router.get('/', async (req, res) => {
  try {
    const events = await populateEvent(Event.find());
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get events owned by logged-in admin
router.get('/mine', auth, adminAuth, async (req, res) => {
  try {
    const events = await populateEvent(Event.find({ createdBy: req.user._id }));
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
    const populatedEvent = await populateEvent(Event.findById(newEvent._id));

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
    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(existingEvent, req.user._id)) {
      return res.status(403).json({ message: 'You can only update your own events' });
    }

    const updates = { ...req.body };
    delete updates.createdBy;

    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('volunteers', 'name email role')
      .populate('pendingVolunteers', 'name email role')
      .populate('createdBy', 'name email role');

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
    const event = await Event.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!event) {
      const exists = await Event.exists({ _id: req.params.id });
      if (exists) {
        return res.status(403).json({ message: 'You can only delete your own events' });
      }
      return res.status(404).json({ message: 'Event not found' });
    }

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
    if (!isEventOwner(event, req.user._id)) {
      return res.status(403).json({ message: 'You can only manage volunteers for your own events' });
    }

    const user = await User.findById(req.params.volunteerId);
    if (!user || user.role !== 'volunteer') {
      return res.status(400).json({ message: 'Only volunteers can be assigned to events' });
    }

    if (!event.volunteers.some(id => id.toString() === req.params.volunteerId)) {
      if (event.volunteers.length >= event.requiredVolunteers) {
        return res.status(400).json({ message: 'Event is full' });
      }
      event.volunteers.push(req.params.volunteerId);
    }

    event.pendingVolunteers = event.pendingVolunteers.filter(id => id.toString() !== req.params.volunteerId);
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));
    const io = req.app.get('io');
    io.emit('event-updated', updatedEvent);

    res.json({ message: 'Volunteer confirmed', event: updatedEvent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Confirm pending volunteer (admin)
router.post('/:id/confirm/:volunteerId', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user._id)) {
      return res.status(403).json({ message: 'You can only manage volunteers for your own events' });
    }

    const user = await User.findById(req.params.volunteerId);
    if (!user || user.role !== 'volunteer') {
      return res.status(400).json({ message: 'Only volunteers can be confirmed for events' });
    }

    const isPending = event.pendingVolunteers.some(id => id.toString() === req.params.volunteerId);
    if (!isPending) return res.status(400).json({ message: 'Volunteer is not pending for this event' });

    if (event.volunteers.length >= event.requiredVolunteers) {
      return res.status(400).json({ message: 'Event is full' });
    }

    event.pendingVolunteers = event.pendingVolunteers.filter(id => id.toString() !== req.params.volunteerId);
    if (!event.volunteers.some(id => id.toString() === req.params.volunteerId)) {
      event.volunteers.push(req.params.volunteerId);
    }
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));
    const io = req.app.get('io');
    io.emit('event-updated', updatedEvent);

    res.json({ message: 'Volunteer confirmed', event: updatedEvent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reject pending volunteer (admin)
router.post('/:id/reject/:volunteerId', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user._id)) {
      return res.status(403).json({ message: 'You can only manage volunteers for your own events' });
    }

    event.pendingVolunteers = event.pendingVolunteers.filter(id => id.toString() !== req.params.volunteerId);
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));
    const io = req.app.get('io');
    io.emit('event-updated', updatedEvent);

    res.json({ message: 'Pending volunteer rejected', event: updatedEvent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove volunteer from event (admin)
router.post('/:id/remove/:volunteerId', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user._id)) {
      return res.status(403).json({ message: 'You can only manage volunteers for your own events' });
    }

    event.volunteers = event.volunteers.filter(id => id.toString() !== req.params.volunteerId);
    event.pendingVolunteers = event.pendingVolunteers.filter(id => id.toString() !== req.params.volunteerId);
    await event.save();

    const updatedEvent = await populateEvent(Event.findById(req.params.id));
    const io = req.app.get('io');
    io.emit('event-updated', updatedEvent);

    res.json({ message: 'Volunteer removed', event: updatedEvent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
