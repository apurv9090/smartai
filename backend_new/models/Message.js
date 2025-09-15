const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'Chat ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: [true, 'Role is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true
  },
  tokens: {
    type: Number,
    default: 0,
    min: [0, 'Tokens cannot be negative']
  },
  isEdited: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, role: 1 });

// Pre-save middleware to update chat's message count and last message time
messageSchema.post('save', async function(doc) {
  try {
    const Chat = mongoose.model('Chat');
    await Chat.findByIdAndUpdate(doc.chatId, {
      $inc: { messageCount: 1 },
      lastMessageAt: new Date()
    });
  } catch (error) {
    console.error('Error updating chat after message save:', error);
  }
});

// Pre-remove middleware to update chat's message count
messageSchema.pre('remove', async function(next) {
  try {
    const Chat = mongoose.model('Chat');
    await Chat.findByIdAndUpdate(this.chatId, {
      $inc: { messageCount: -1 }
    });
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Message', messageSchema);
