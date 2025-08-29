const mongoose = require('mongoose');

const promptTemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  template: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['educational', 'technical', 'creative', 'professional', 'casual', 'accessibility', 'custom'],
    default: 'custom'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isSystemTemplate: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
promptTemplateSchema.index({ user: 1, isActive: 1 });
promptTemplateSchema.index({ user: 1, category: 1 });
promptTemplateSchema.index({ isSystemTemplate: 1 });

// Static method to get default templates
promptTemplateSchema.statics.getDefaultTemplates = function() {
  return [
    {
      name: "Explain Like I'm Five",
      description: "Simple, easy-to-understand explanations for complex topics",
      template: "Please explain this in very simple terms that a 5-year-old could understand. Use simple words, short sentences, and fun examples or analogies. Make it engaging and easy to follow.",
      category: "educational",
      isSystemTemplate: true
    },
    {
      name: "Technical Deep-Dive",
      description: "Detailed technical explanations with specifics",
      template: "Provide a comprehensive technical explanation with detailed specifics, technical terminology, implementation details, and relevant examples. Include any relevant code, formulas, or technical specifications.",
      category: "technical",
      isSystemTemplate: true
    },
    {
      name: "Creative Storyteller",
      description: "Engaging, creative responses with storytelling elements",
      template: "Respond in a creative, engaging way using storytelling elements. Be imaginative, use vivid descriptions, and make the response entertaining while still being informative.",
      category: "creative",
      isSystemTemplate: true
    },
    {
      name: "Professional Assistant",
      description: "Formal, business-appropriate responses",
      template: "Provide a professional, well-structured response suitable for business or formal contexts. Use clear, concise language and maintain a professional tone throughout.",
      category: "professional",
      isSystemTemplate: true
    },
    {
      name: "Casual Friend",
      description: "Friendly, conversational responses",
      template: "Respond in a friendly, casual, and conversational tone as if talking to a good friend. Be warm, supportive, and use natural language that feels personal and approachable.",
      category: "casual",
      isSystemTemplate: true
    },
    {
      name: "Accessibility Helper",
      description: "Clear, structured responses optimized for screen readers",
      template: "Structure your response clearly for accessibility. Use bullet points, numbered lists, and clear headings where appropriate. Describe any visual elements clearly and concisely.",
      category: "accessibility",
      isSystemTemplate: true
    }
  ];
};

// Method to increment usage count
promptTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Virtual for formatted creation date
promptTemplateSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString();
});

module.exports = mongoose.model('PromptTemplate', promptTemplateSchema);
