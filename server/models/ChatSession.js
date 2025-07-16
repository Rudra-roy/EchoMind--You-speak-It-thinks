const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
chatSessionSchema.index({ user: 1, createdAt: -1 });
chatSessionSchema.index({ user: 1, lastActivity: -1 });

// Update lastActivity when session is accessed
chatSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Generate title from first message
chatSessionSchema.methods.generateTitle = function(firstMessage) {
  if (firstMessage && firstMessage.length > 0) {
    // Take first 50 characters and add ellipsis if longer
    this.title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...'
      : firstMessage;
  } else {
    this.title = 'New Conversation';
  }
  return this.save();
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
