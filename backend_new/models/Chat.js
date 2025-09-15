const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  title: {
    type: String,
    required: [true, 'Chat title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  messageCount: {
    type: Number,
    default: 0,
    min: [0, 'Message count cannot be negative']
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ userId: 1, isActive: 1 });
chatSchema.index({ lastMessageAt: -1 });

// Virtual for messages
chatSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chatId'
});

// Pre-save middleware to update lastMessageAt
chatSchema.pre('save', function(next) {
  if (this.isModified('messageCount') && this.messageCount > 0) {
    this.lastMessageAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
