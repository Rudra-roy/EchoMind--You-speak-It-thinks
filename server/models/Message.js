const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  isUserMessage: {
    type: Boolean,
    required: true,
    default: true
  },
  messageType: {
    type: String,
    enum: ['text', 'voice', 'system', 'image', 'multimodal', 'multimodal_response'],
    default: 'text'
  },
  metadata: {
    voiceData: {
      type: String, // Base64 encoded voice data
      default: null
    },
    voicePath: {
      type: String, // Path to uploaded voice file
      default: null
    },
    voiceFileName: {
      type: String, // Generated filename of uploaded voice
      default: null
    },
    voiceOriginalName: {
      type: String, // Original name from client
      default: null
    },
    voiceSize: {
      type: Number, // Size of voice file in bytes
      default: null
    },
    voiceMimeType: {
      type: String, // MIME type of voice
      default: null
    },
    voiceDuration: {
      type: Number, // Duration of voice in seconds
      default: null
    },
    processingTime: {
      type: Number, // Time taken to process the message in milliseconds
      default: null
    },
    aiModel: {
      type: String, // AI model used for response
      default: null
    },
    imagePath: {
      type: String, // Path to uploaded image file
      default: null
    },
    imageFileName: {
      type: String, // Original filename of uploaded image
      default: null
    },
    imageOriginalName: {
      type: String, // Original name from client
      default: null
    },
    imageSize: {
      type: Number, // Size of image file in bytes
      default: null
    },
    imageMimeType: {
      type: String, // MIME type of image
      default: null
    },
    hasImageInput: {
      type: Boolean, // Whether AI response was generated with image input
      default: false
    },
    responseType: {
      type: String, // Type of AI response (text, multimodal, etc.)
      default: null
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
messageSchema.index({ session: 1, timestamp: 1 });
messageSchema.index({ user: 1, timestamp: -1 });
messageSchema.index({ session: 1, isUserMessage: 1 });

// Method to edit message
messageSchema.methods.editMessage = function(newContent) {
  // Save current content to edit history
  if (this.content !== newContent) {
    this.editHistory.push({
      content: this.content,
      editedAt: new Date()
    });
    this.content = newContent;
    this.isEdited = true;
  }
  return this.save();
};

// Static method to get conversation history
messageSchema.statics.getConversationHistory = function(sessionId, limit = 50, skip = 0) {
  return this.find({ session: sessionId })
    .sort({ timestamp: 1 })
    .limit(limit)
    .skip(skip)
    .populate('user', 'name email')
    .populate('session', 'title');
};

// Static method to get latest messages for a user
messageSchema.statics.getLatestMessages = function(userId, limit = 20) {
  return this.find({ user: userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('session', 'title');
};

module.exports = mongoose.model('Message', messageSchema);
