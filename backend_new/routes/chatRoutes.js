const express = require('express');
const { body, validationResult } = require('express-validator');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// @route   POST /api/chat
// @desc    Create new chat
// @access  Private
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { title } = req.body;
    const userId = req.user._id;

    // Create chat
    const chat = await Chat.create({
      userId,
      title
    });

    res.status(201).json({
      success: true,
      chat: {
        _id: chat._id,
        userId: chat.userId,
        title: chat.title,
        messageCount: chat.messageCount,
        lastMessageAt: chat.lastMessageAt,
        isActive: chat.isActive,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating chat'
    });
  }
});

// @route   GET /api/chat
// @desc    Get user's chats with pagination
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get chats with pagination
    const chats = await Chat.find({ userId, isActive: true })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    // Get total count
    const total = await Chat.countDocuments({ userId, isActive: true });

    res.json({
      success: true,
      chats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting chats'
    });
  }
});

// @route   GET /api/chat/:chatId
// @desc    Get chat with messages
// @access  Private
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Get chat
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Get messages
    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .select('-__v');

    res.json({
      success: true,
      chat,
      messages
    });
  } catch (error) {
    console.error('Get chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server error getting chat'
    });
  }
});

// @route   POST /api/chat/:chatId/message
// @desc    Send message to chat
// @access  Private
router.post('/:chatId/message', [
  body('message')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message must be between 1 and 10000 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { chatId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    // Check if chat exists and belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Save user message
    const userMessage = await Message.create({
      chatId,
      userId,
      role: 'user',
      content: message,
      tokens: Math.ceil(message.length / 4) // Rough token estimation
    });

    // Get AI response (we'll implement this in the AI service)
    let aiResponse = 'I apologize, but I\'m currently unable to generate a response. Please try again later.';
    let aiTokens = 0;

    try {
      // Import AI service dynamically to avoid circular dependencies
      const aiService = require('../services/aiService');
      const aiResult = await aiService.generateResponse(message);

      if (aiResult.success) {
        aiResponse = aiResult.response;
        aiTokens = aiResult.tokens || Math.ceil(aiResponse.length / 4);
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);
      // Keep default error message
    }

    // Save AI message
    const aiMessage = await Message.create({
      chatId,
      userId,
      role: 'assistant',
      content: aiResponse,
      tokens: aiTokens
    });

    res.json({
      success: true,
      userMessage: {
        _id: userMessage._id,
        chatId: userMessage.chatId,
        userId: userMessage.userId,
        role: userMessage.role,
        content: userMessage.content,
        tokens: userMessage.tokens,
        isEdited: userMessage.isEdited,
        createdAt: userMessage.createdAt,
        updatedAt: userMessage.updatedAt
      },
      aiMessage: {
        _id: aiMessage._id,
        chatId: aiMessage.chatId,
        userId: aiMessage.userId,
        role: aiMessage.role,
        content: aiMessage.content,
        tokens: aiMessage.tokens,
        isEdited: aiMessage.isEdited,
        createdAt: aiMessage.createdAt,
        updatedAt: aiMessage.updatedAt
      },
      chatId
    });
  } catch (error) {
    console.error('Send message error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server error sending message'
    });
  }
});

module.exports = router;
