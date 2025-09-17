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
    .optional()
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
      title: title && title.trim().length > 0 ? title.trim() : 'New Chat'
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

    // If chat has default title, set it from first user message topic
    if (chat.title === 'New Chat' && chat.messageCount === 0) {
      const inferred = message.split('\n')[0].trim().slice(0, 60);
      chat.title = inferred.length > 0 ? inferred : 'New Chat';
      await chat.save();
    }

    // Save user message
    const userMessage = await Message.create({
      chatId,
      userId,
      role: 'user',
      content: message,
      tokens: Math.ceil(message.length / 4) // Rough token estimation
    });

    // Build conversation history for context (exclude the message we just saved)
    // Get last 40 messages ordered by createdAt asc for context
    const historyDocs = await Message.find({ chatId, _id: { $ne: userMessage._id } })
      .sort({ createdAt: -1 })
      .select('role content createdAt')
      .limit(40)
      .lean();
    historyDocs.reverse();
    const history = historyDocs.map(m => ({ role: m.role, content: m.content }));

    // If the user's message likely refers to previous content (e.g., "explain this code"),
    // augment the prompt with the most recent code snippet from history to make intent explicit.
    const needsContext = /\b(explain|what\s+does\s+this|describe|analyze|refactor|optimi[sz]e|add\s+comments)\b/i.test(message)
      && /\b(this|that|it|code|snippet|program|above|previous)\b/i.test(message)
      && message.length < 200;

    let expandedMessage = message;
    if (needsContext) {
      // Find the last assistant/user message containing a fenced code block or code-looking lines
      let snippet = '';
      for (let i = historyDocs.length - 1; i >= 0; i--) {
        const c = historyDocs[i]?.content || '';
        // Prefer fenced code blocks
        const fenceMatch = c.match(/```[\s\S]*?```/g);
        if (fenceMatch && fenceMatch.length > 0) {
          snippet = fenceMatch[fenceMatch.length - 1];
          break;
        }
        // Fallback: detect multiple lines with semicolons/braces typical of code
        const lines = c.split('\n');
        const codeLike = lines.filter(l => /;|\{|\}|class\s+|public\s+|static\s+|void\s+main\s*\(/i.test(l)).slice(0, 20);
        if (codeLike.length >= 3) {
          snippet = codeLike.join('\n');
          break;
        }
      }
      if (snippet) {
        // Keep the prompt concise, add explicit instruction tying to previous code
        expandedMessage = `${message}\n\nUse the following previous code from this chat as the reference:\n\n${snippet}`;
      }
    }

    // Get AI response with history
    let aiResponse = 'I apologize, but I\'m currently unable to generate a response. Please try again later.';
    let aiTokens = 0;

    try {
      // Import AI service dynamically to avoid circular dependencies
      const aiService = require('../services/aiService');
      const aiResult = await aiService.generateResponse(expandedMessage, history);

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

// @route   DELETE /api/chat/:chatId
// @desc    Soft delete a chat and its messages
// @access  Private
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    chat.isActive = false;
    await chat.save();

    // Optionally also delete messages (hard delete) or keep for audit; here we keep but could clean:
    // await Message.deleteMany({ chatId });

    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    console.error('Delete chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid chat ID' });
    }
    res.status(500).json({ success: false, error: 'Server error deleting chat' });
  }
});

// @route   PUT /api/chat/:chatId
// @desc    Update chat title
// @access  Private
router.put('/:chatId', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { chatId } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId, isActive: true },
      { title: title.trim() },
      { new: true }
    ).select('-__v');

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Update chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid chat ID' });
    }
    res.status(500).json({ success: false, error: 'Server error updating chat' });
  }
});

module.exports = router;
