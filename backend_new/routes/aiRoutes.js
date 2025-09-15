const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All AI routes require authentication
router.use(protect);

// @route   GET /api/ai/status
// @desc    Get AI service status
// @access  Private
router.get('/status', async (req, res) => {
  try {
    // Import AI service dynamically
    const aiService = require('../services/aiService');

    const status = await aiService.getStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('AI status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting AI status'
    });
  }
});

module.exports = router;
