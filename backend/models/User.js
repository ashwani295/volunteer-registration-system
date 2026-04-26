const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  skills: [{ type: String }],
  availability: [{
    date: { type: Date },
    startTime: { type: String },
    endTime: { type: String }
  }],
  role: { type: String, enum: ['volunteer', 'admin'], default: 'volunteer' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);