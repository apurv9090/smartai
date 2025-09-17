const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
let cookieParser;
try {
  cookieParser = require('cookie-parser');
} catch (e) {
  // Minimal fallback cookie parser if dependency not installed
  console.warn('⚠️  cookie-parser not installed; using a simple fallback parser');
  cookieParser = function fallbackCookieParser() {
    return function (req, _res, next) {
      try {
        const header = req.headers?.cookie || '';
        const obj = {};
        if (header) {
          header.split(';').forEach((pair) => {
            const idx = pair.indexOf('=');
            if (idx > -1) {
              const key = decodeURIComponent(pair.slice(0, idx).trim());
              const val = decodeURIComponent(pair.slice(idx + 1).trim());
              obj[key] = val;
            }
          });
        }
        req.cookies = obj;
      } catch (_err) {
        req.cookies = {};
      }
      next();
    };
  };
}
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
// Load env from backend_new/.env; if some values are missing, also try project root .env
require('dotenv').config();
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || !process.env.FRONTEND_URL) {
  const rootEnvPath = path.resolve(__dirname, '..', '.env');
  require('dotenv').config({ path: rootEnvPath });
}

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 8501;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Parse cookies for JWT auth via cookies
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartai', {
  // Removed deprecated options
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
