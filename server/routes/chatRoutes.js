const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const aiService = require('../services/aiService');

// @route   GET /api/chat/sessions
// @desc    Get all chat sessions for the authenticated user
// @access  Private
router.get('/sessions', protect, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user.id })
      .sort({ lastActivity: -1 })
      .populate('user', 'name email');

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat sessions',
      error: error.message
    });
  }
});

// @route   POST /api/chat/sessions
// @desc    Create a new chat session
// @access  Private
router.post('/sessions', protect, async (req, res) => {
  try {
    const { title } = req.body;

    const session = new ChatSession({
      user: req.user.id,
      title: title || 'New Conversation'
    });

    await session.save();

    res.status(201).json({
      success: true,
      data: session,
      message: 'Chat session created successfully'
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chat session',
      error: error.message
    });
  }
});

// @route   GET /api/chat/sessions/:id
// @desc    Get a specific chat session with its messages
// @access  Private
router.get('/sessions/:id', protect, async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('user', 'name email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Get messages for this session
    const messages = await Message.getConversationHistory(req.params.id);

    // Update session activity
    await session.updateActivity();

    res.json({
      success: true,
      data: {
        session,
        messages
      }
    });
  } catch (error) {
    console.error('Error fetching chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat session',
      error: error.message
    });
  }
});

// @route   POST /api/chat/sessions/:id/messages
// @desc    Send a message to a chat session
// @access  Private
router.post('/sessions/:id/messages', protect, async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Check if session exists and belongs to user
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Create user message
    const userMessage = new Message({
      session: req.params.id,
      user: req.user.id,
      content: content.trim(),
      isUserMessage: true,
      messageType
    });

    await userMessage.save();

    // Update session activity and message count
    session.messageCount += 1;
    await session.updateActivity();

    // Generate AI response using our AI service
    let aiResponseContent = "I'm sorry, I'm currently offline. Please try again later.";
    let aiModel = 'offline';
    let processingTime = 0;

    try {
      const startTime = Date.now();
      
      // Get conversation context for better AI responses
      const recentMessages = await Message.find({ session: req.params.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('content isUserMessage');

      const context = recentMessages.reverse().map(msg => ({
        role: msg.isUserMessage ? 'user' : 'assistant',
        content: msg.content
      }));

      // Generate AI response
      const aiResult = await aiService.generateTextResponse(content.trim(), context);
      
      if (aiResult.success) {
        aiResponseContent = aiResult.content;
        aiModel = aiResult.model;
        processingTime = Date.now() - startTime;
      } else {
        console.warn('AI service unavailable:', aiResult.error);
        aiResponseContent = aiResult.content; // This will be the fallback message
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
    }

    const aiResponse = new Message({
      session: req.params.id,
      user: req.user.id,
      content: aiResponseContent,
      isUserMessage: false,
      messageType: 'text',
      metadata: {
        aiModel: aiModel,
        processingTime: processingTime
      }
    });

    await aiResponse.save();

    // Update session message count again
    session.messageCount += 1;
    await session.updateActivity();

    // If this is the first message, generate title
    if (session.messageCount === 2) { // User message + AI response
      await session.generateTitle(content.trim());
    }

    // Return both messages
    res.status(201).json({
      success: true,
      data: {
        userMessage,
        aiResponse
      },
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
});

// @route   DELETE /api/chat/sessions/:id
// @desc    Delete a chat session and all its messages
// @access  Private
router.delete('/sessions/:id', protect, async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Delete all messages in this session
    await Message.deleteMany({ session: req.params.id });

    // Delete the session
    await ChatSession.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting chat session',
      error: error.message
    });
  }
});

// @route   GET /api/chat/messages/latest
// @desc    Get latest messages for the authenticated user
// @access  Private
router.get('/messages/latest', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const messages = await Message.getLatestMessages(req.user.id, limit);

    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching latest messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest messages',
      error: error.message
    });
  }
});

module.exports = router;
