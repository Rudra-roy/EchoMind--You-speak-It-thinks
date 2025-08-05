const aiService = require('../services/aiService');
const Message = require('../models/Message');
const ChatSession = require('../models/ChatSession');
const path = require('path');
const fs = require('fs');

// @desc    Generate AI response for text message
// @route   POST /api/chat/ai/text
// @access  Private
const generateTextResponse = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Get conversation context if sessionId provided
    let context = [];
    if (sessionId) {
      const recentMessages = await Message.find({ session: sessionId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('content isUserMessage');

      context = recentMessages.reverse().map(msg => ({
        role: msg.isUserMessage ? 'user' : 'assistant',
        content: msg.content
      }));
    }

    // Generate AI response
    const aiResponse = await aiService.generateTextResponse(message, context);

    if (!aiResponse.success) {
      return res.status(503).json({
        success: false,
        message: 'AI service unavailable',
        error: aiResponse.error
      });
    }

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse.content,
        model: aiResponse.model,
        type: aiResponse.type
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate image caption
// @route   POST /api/chat/ai/caption
// @access  Private
const generateImageCaption = async (req, res, next) => {
  try {
    const { customPrompt } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const imagePath = req.file.path;

    try {
      // Generate caption
      const aiResponse = await aiService.generateImageCaption(imagePath, customPrompt);

      if (!aiResponse.success) {
        return res.status(503).json({
          success: false,
          message: 'AI service unavailable',
          error: aiResponse.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          caption: aiResponse.content,
          model: aiResponse.model,
          type: aiResponse.type,
          imageUrl: `/uploads/${req.file.filename}`
        }
      });
    } finally {
      // Clean up uploaded file after processing
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// @desc    Answer question about image
// @route   POST /api/chat/ai/image-qa
// @access  Private
const answerImageQuestion = async (req, res, next) => {
  try {
    const { question, sessionId } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const imagePath = req.file.path;

    try {
      // Get previous context for this image session if needed
      let previousContext = [];
      if (sessionId) {
        const recentMessages = await Message.find({ 
          session: sessionId,
          messageType: { $in: ['text', 'image'] }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('content isUserMessage');

        previousContext = recentMessages
          .reverse()
          .map(msg => msg.content);
      }

      // Generate answer
      const aiResponse = await aiService.answerImageQuestion(
        imagePath, 
        question, 
        previousContext
      );

      if (!aiResponse.success) {
        return res.status(503).json({
          success: false,
          message: 'AI service unavailable',
          error: aiResponse.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          answer: aiResponse.content,
          question: question,
          model: aiResponse.model,
          type: aiResponse.type,
          imageUrl: `/uploads/${req.file.filename}`
        }
      });
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// @desc    Stream AI response (for real-time chat)
// @route   POST /api/chat/ai/stream
// @access  Private
const streamResponse = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const imagePath = req.file ? req.file.path : null;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      await aiService.streamResponse(
        message,
        imagePath,
        (chunk) => {
          // Send chunk to client
          res.write(chunk);
        }
      );

      res.end();
    } finally {
      // Clean up uploaded file if exists
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// @desc    Get AI service status and model info
// @route   GET /api/chat/ai/status
// @access  Private
const getAIStatus = async (req, res, next) => {
  try {
    const modelInfo = await aiService.getModelInfo();
    
    res.status(200).json({
      success: true,
      data: {
        isReady: aiService.isReady(),
        ...modelInfo
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Health check for AI service
// @route   GET /api/chat/ai/health
// @access  Public
const healthCheck = async (req, res, next) => {
  try {
    const isReady = aiService.isReady();
    const modelInfo = await aiService.getModelInfo();
    
    res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isReady ? 'healthy' : 'unavailable',
      data: modelInfo
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
};

module.exports = {
  generateTextResponse,
  generateImageCaption,
  answerImageQuestion,
  streamResponse,
  getAIStatus,
  healthCheck
};
