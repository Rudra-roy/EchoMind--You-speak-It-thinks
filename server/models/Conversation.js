const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'voice'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  metadata: {
    // For image messages: file path, size, etc.
    // For voice messages: duration, transcription, etc.
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastActivity when messages are added
conversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.lastActivity = Date.now();
  }
  next();
});

// Index for better query performance
conversationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
