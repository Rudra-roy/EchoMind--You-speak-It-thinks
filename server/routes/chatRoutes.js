const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const aiService = require('../services/aiService');

// Configure multer for media uploads (images and voice)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir;
    if (file.mimetype.startsWith('image/')) {
      uploadDir = path.join(__dirname, '../uploads/images');
    } else if (file.mimetype.startsWith('audio/')) {
      uploadDir = path.join(__dirname, '../uploads/voice');
    } else {
      uploadDir = path.join(__dirname, '../uploads/other');
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept image and audio files, plus test files for development
  if (file.mimetype.startsWith('image/') || 
      file.mimetype.startsWith('audio/') ||
      file.originalname.includes('test_voice')) { // Allow test files
    cb(null, true);
  } else {
    cb(new Error('Only image and audio files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for both images and voice
  }
});

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
// @desc    Send a message to a chat session (with optional image)
// @access  Private
router.post('/sessions/:id/messages', protect, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'voice', maxCount: 1 }
]), async (req, res) => {
  try {
    const { content, message, messageType = 'text', promptTemplateId } = req.body;
    const messageContent = content || message; // Support both field names
    const imageFile = req.files?.image?.[0];
    const voiceFile = req.files?.voice?.[0];

    if ((!messageContent || messageContent.trim().length === 0) && !imageFile && !voiceFile) {
      return res.status(400).json({
        success: false,
        message: 'Message content, image, or voice is required'
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

    // Determine message type and prepare user message
    let actualMessageType = messageType;
    let userMessageContent = messageContent ? messageContent.trim() : '';
    let imagePath = null;
    let voicePath = null;

    // Handle different file types
    if (imageFile && voiceFile) {
      actualMessageType = 'multimodal';
      imagePath = imageFile.path;
      voicePath = voiceFile.path;
      if (!userMessageContent) {
        userMessageContent = '[Image and voice uploaded]';
      }
    } else if (imageFile) {
      actualMessageType = userMessageContent ? 'multimodal' : 'image';
      imagePath = imageFile.path;
      if (!userMessageContent) {
        userMessageContent = '[Image uploaded]';
      }
    } else if (voiceFile) {
      actualMessageType = userMessageContent ? 'multimodal' : 'voice';
      voicePath = voiceFile.path;
      
      // If no text content provided, try to transcribe the voice message
      if (!userMessageContent) {
        try {
          console.log('🎤 Attempting to transcribe voice message:', voiceFile.filename);
          const transcriptionResult = await aiService.transcribeAudio(voiceFile.path);
          
          if (transcriptionResult.success && transcriptionResult.transcription) {
            userMessageContent = transcriptionResult.transcription;
            console.log('✅ Voice transcription successful:', userMessageContent);
          } else {
            console.log('⚠️ Voice transcription failed, using placeholder');
            userMessageContent = '[🎤 Voice message - click to play]';
          }
        } catch (error) {
          console.error('❌ Voice transcription error:', error);
          userMessageContent = '[🎤 Voice message - transcription failed]';
        }
      }
    }

    // Create metadata object
    const metadata = {};
    let voiceDuration = null;
    
    // Extract voice duration if we have a voice file
    if (voiceFile) {
      try {
        const transcriptionResult = await aiService.transcribeAudio(voiceFile.path);
        if (transcriptionResult.audioInfo) {
          voiceDuration = transcriptionResult.audioInfo.duration;
        }
      } catch (error) {
        console.log('⚠️ Could not extract voice duration:', error.message);
      }
    }
    
    if (imageFile) {
      metadata.imagePath = imagePath;
      metadata.imageFileName = imageFile.filename;
      metadata.imageOriginalName = imageFile.originalname;
      metadata.imageSize = imageFile.size;
      metadata.imageMimeType = imageFile.mimetype;
    }
    
    if (voiceFile) {
      metadata.voicePath = voicePath;
      metadata.voiceFileName = voiceFile.filename;
      metadata.voiceOriginalName = voiceFile.originalname;
      metadata.voiceSize = voiceFile.size;
      metadata.voiceMimeType = voiceFile.mimetype;
      metadata.voiceDuration = voiceDuration;
    }

    // Create user message
    const userMessage = new Message({
      session: req.params.id,
      user: req.user.id,
      content: userMessageContent,
      isUserMessage: true,
      messageType: actualMessageType,
      metadata: metadata
    });

    await userMessage.save();

    // Update session activity and message count
    session.messageCount += 1;
    await session.updateActivity();

    // Generate AI response using our AI service
    let aiResponseContent = "I'm sorry, I'm currently offline. Please try again later.";
    let aiModel = 'offline';
    let processingTime = 0;
    let aiResult = null; // Initialize aiResult variable
    let promptTemplate = null; // Initialize promptTemplate variable

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

      // Get prompt template if specified
      if (promptTemplateId) {
        try {
          const PromptTemplate = require('../models/PromptTemplate');
          promptTemplate = await PromptTemplate.findOne({
            _id: promptTemplateId,
            user: req.user.id,
            isActive: true
          });

          if (promptTemplate) {
            // Increment usage count
            await promptTemplate.incrementUsage();
            console.log('🎯 Using prompt template:', promptTemplate.name);
          } else {
            console.warn('⚠️ Prompt template not found or not accessible:', promptTemplateId);
          }
        } catch (error) {
          console.error('❌ Error fetching prompt template:', error.message);
        }
      }

      // Generate AI response using templated service
      aiResult = await aiService.generateTemplatedResponse(
        userMessageContent || 'Please describe what you see in this image.',
        promptTemplate?.template,
        imagePath,
        context
      );
      
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
      messageType: imagePath ? 'multimodal_response' : 'text',
      metadata: {
        aiModel: aiModel,
        processingTime: processingTime,
        hasImageInput: !!imagePath,
        responseType: aiResult?.type || 'text',
        promptTemplate: promptTemplate ? {
          id: promptTemplate._id,
          name: promptTemplate.name,
          category: promptTemplate.category
        } : null
      }
    });

    await aiResponse.save();

    // Update session message count again
    session.messageCount += 1;
    await session.updateActivity();

    // If this is the first message, generate title
    if (session.messageCount === 2) { // User message + AI response
      const titleContent = userMessageContent || 'Image conversation';
      await session.generateTitle(titleContent);
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

// @route   GET /api/chat/images/:filename
// @desc    Serve uploaded images
// @access  Public (images are accessible if you know the filename)
router.get('/images/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, '../uploads/images', filename);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Stream the file
    const fileStream = fs.createReadStream(imagePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving image',
      error: error.message
    });
  }
});

// @route   GET /api/chat/voice/:filename
// @desc    Serve uploaded voice files
// @access  Public (voice files are accessible if you know the filename)
router.get('/voice/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const voicePath = path.join(__dirname, '../uploads/voice', filename);

    // Check if file exists
    if (!fs.existsSync(voicePath)) {
      return res.status(404).json({
        success: false,
        message: 'Voice file not found'
      });
    }

    // Set appropriate headers for audio files
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm'
    };

    const mimeType = mimeTypes[ext] || 'audio/mpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Accept-Ranges', 'bytes'); // Support range requests for audio

    // Stream the file
    const fileStream = fs.createReadStream(voicePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving voice file:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving voice file',
      error: error.message
    });
  }
});

module.exports = router;
