const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

const rawOtpLength = Number.parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_LENGTH = Number.isFinite(rawOtpLength) && rawOtpLength >= 4 && rawOtpLength <= 10 ? rawOtpLength : 6;
const rawOtpTtl = Number.parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const OTP_TTL_MINUTES = Number.isFinite(rawOtpTtl) && rawOtpTtl > 0 ? rawOtpTtl : 10;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const rawMaxAttempts = Number.parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const MAX_OTP_ATTEMPTS = Number.isFinite(rawMaxAttempts) && rawMaxAttempts > 0 ? rawMaxAttempts : 5;
const rawResetTokenTtl = Number.parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10);
const RESET_TOKEN_TTL_MINUTES = Number.isFinite(rawResetTokenTtl) && rawResetTokenTtl > 0 ? rawResetTokenTtl : 30;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000;

const generateNumericOtp = () => {
  const max = 10 ** OTP_LENGTH;
  const otpNumber = crypto.randomInt(0, max);
  return otpNumber.toString().padStart(OTP_LENGTH, '0');
};

const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const [local, domain] = email.split('@');
  if (!domain) {
    return email;
  }
  if (local.length <= 2) {
    return `${local[0] || ''}***@${domain}`;
  }
  const maskedLocal = `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
};

// Generate JWT Token
const generateToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT secret not configured');
    err.statusCode = 500;
    throw err;
  }
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Helper to set auth cookie
const setAuthCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .customSanitizer((v) => String(v).trim().toLowerCase())
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
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

    const { name, email, password } = req.body;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth/Register attempt:', { email });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth/Register existingUser:', existingUser ? { id: existingUser._id, email: existingUser.email } : null);
    }
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

  // Generate token
  const token = generateToken(user._id);

    // Set cookie and also return token for existing frontend compatibility
    setAuthCookie(res, token);

    // Return shape expected by frontend AuthContext (top-level user/token + success)
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
  console.error('Registration error:', error && error.keyValue ? { message: error.message, keyValue: error.keyValue } : error);
    if (error && error.code === 11000) {
      const field = error.keyValue ? Object.keys(error.keyValue)[0] : 'field';
      return res.status(400).json({ success: false, error: `${field} already exists` });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .customSanitizer((v) => String(v).trim().toLowerCase())
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
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

    const { email, password } = req.body;

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const otpCode = generateNumericOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    user.loginOtp = {
      codeHash: otpHash,
      expiresAt,
      attemptCount: 0,
      lastRequestedAt: now
    };

    try {
      await user.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.error('Failed to persist login OTP:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Could not initiate OTP verification'
      });
    }

    try {
      await sendOtpEmail(user.email, otpCode, user.name, expiresAt);
    } catch (mailError) {
      console.error('Failed to send OTP email:', mailError);
      await User.updateOne({ _id: user._id }, { $unset: { loginOtp: '' } });
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP email. Please try again later.'
      });
    }

    res.json({
      success: true,
      otpRequired: true,
      message: `OTP sent to ${maskEmail(user.email)}`,
      expiresInMinutes: OTP_TTL_MINUTES
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Server error during login'
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify login OTP and finalize authentication
// @access  Public
router.post('/verify-otp', [
  body('email')
    .isEmail()
    .customSanitizer((v) => String(v).trim().toLowerCase())
    .withMessage('Please provide a valid email'),
  body('otp')
    .trim()
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
    .withMessage(`OTP must be ${OTP_LENGTH} digits`)
    .isNumeric()
    .withMessage('OTP must contain only numbers')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid verification attempt'
      });
    }

    if (!user.loginOtp || !user.loginOtp.codeHash || !user.loginOtp.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'No OTP pending verification. Please login again.'
      });
    }

    if (user.loginOtp.expiresAt.getTime() < Date.now()) {
      await User.updateOne({ _id: user._id }, { $unset: { loginOtp: '' } });
      return res.status(400).json({
        success: false,
        error: 'OTP expired. Please login again.'
      });
    }

    const attempts = user.loginOtp.attemptCount || 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { $unset: { loginOtp: '' } });
      return res.status(429).json({
        success: false,
        error: 'Too many invalid OTP attempts. Please login again.'
      });
    }

    const isValid = await bcrypt.compare(otp, user.loginOtp.codeHash);

    if (!isValid) {
      await User.updateOne({ _id: user._id }, { $inc: { 'loginOtp.attemptCount': 1 } });
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP'
      });
    }

    await User.updateOne({ _id: user._id }, { $unset: { loginOtp: '' } });

    const token = generateToken(user._id);
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Server error during OTP verification'
    });
  }
});

  // @route   POST /api/auth/forgot-password
  // @desc    Initiate password reset flow by sending OTP
  // @access  Public
  router.post('/forgot-password', [
    body('email')
      .isEmail()
      .customSanitizer((v) => String(v).trim().toLowerCase())
      .withMessage('Please provide a valid email')
  ], async (req, res) => {
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, an OTP has been sent to continue resetting the password.'
    };

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg
        });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        // Avoid user enumeration: return same response
        return res.json(genericResponse);
      }

      const otpCode = generateNumericOtp();
      const otpHash = await bcrypt.hash(otpCode, 10);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      user.passwordReset = {
        otpHash,
        otpExpiresAt: expiresAt,
        otpAttemptCount: 0
      };

      try {
        await user.save({ validateBeforeSave: false });
      } catch (saveError) {
        console.error('Failed to persist password reset OTP:', saveError);
        return res.status(500).json({
          success: false,
          error: 'Could not initiate password reset. Please try again later.'
        });
      }

      try {
        await sendOtpEmail(user.email, otpCode, user.name, expiresAt, {
          purpose: 'reset',
          subject: 'SmartAI password reset code',
          instructionsLine: 'Enter this code on the password reset page to continue.'
        });
      } catch (mailError) {
        console.error('Failed to send password reset OTP email:', mailError);
        await User.updateOne({ _id: user._id }, { $unset: { passwordReset: '' } });
        return res.status(500).json({
          success: false,
          error: 'Failed to send OTP email. Please try again later.'
        });
      }

      res.json({
        ...genericResponse,
        target: maskEmail(email),
        expiresInMinutes: OTP_TTL_MINUTES
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server error during password reset request'
      });
    }
  });

  // @route   POST /api/auth/verify-reset-otp
  // @desc    Verify password reset OTP and issue temporary reset token
  // @access  Public
  router.post('/verify-reset-otp', [
    body('email')
      .isEmail()
      .customSanitizer((v) => String(v).trim().toLowerCase())
      .withMessage('Please provide a valid email'),
    body('otp')
      .trim()
      .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
      .withMessage(`OTP must be ${OTP_LENGTH} digits`)
      .isNumeric()
      .withMessage('OTP must contain only numbers')
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg
        });
      }

      const { email, otp } = req.body;
      const user = await User.findOne({ email });

      if (!user || !user.passwordReset || !user.passwordReset.otpHash || !user.passwordReset.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired OTP. Please request a new code.'
        });
      }

      if (user.passwordReset.otpExpiresAt.getTime() < Date.now()) {
        await User.updateOne({ _id: user._id }, { $unset: { passwordReset: '' } });
        return res.status(400).json({
          success: false,
          error: 'OTP expired. Please request a new code.'
        });
      }

      const attempts = user.passwordReset.otpAttemptCount || 0;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await User.updateOne({ _id: user._id }, { $unset: { passwordReset: '' } });
        return res.status(429).json({
          success: false,
          error: 'Too many invalid OTP attempts. Please request a new code.'
        });
      }

      const isValid = await bcrypt.compare(otp, user.passwordReset.otpHash);

      if (!isValid) {
        await User.updateOne({ _id: user._id }, { $inc: { 'passwordReset.otpAttemptCount': 1 } });
        return res.status(400).json({
          success: false,
          error: 'Invalid OTP'
        });
      }

      const resetToken = generateResetToken();
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      user.passwordReset = {
        resetTokenHash,
        resetTokenExpiresAt,
        otpAttemptCount: 0
      };

      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        resetToken,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES
      });
    } catch (error) {
      console.error('Password reset OTP verification error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server error during OTP verification'
      });
    }
  });

  // @route   POST /api/auth/reset-password
  // @desc    Complete password reset after OTP verification
  // @access  Public
  router.post('/reset-password', [
    body('email')
      .isEmail()
      .customSanitizer((v) => String(v).trim().toLowerCase())
      .withMessage('Please provide a valid email'),
    body('resetToken')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg
        });
      }

      const { email, resetToken, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      if (!user || !user.passwordReset || !user.passwordReset.resetTokenHash || !user.passwordReset.resetTokenExpiresAt) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token. Please request a new one.'
        });
      }

      if (user.passwordReset.resetTokenExpiresAt.getTime() < Date.now()) {
        await User.updateOne({ _id: user._id }, { $unset: { passwordReset: '' } });
        return res.status(400).json({
          success: false,
          error: 'Reset token expired. Please request a new one.'
        });
      }

      const isTokenValid = await bcrypt.compare(resetToken, user.passwordReset.resetTokenHash);

      if (!isTokenValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token. Please request a new one.'
        });
      }

      user.password = password;
      user.passwordReset = undefined;
      user.markModified('passwordReset');

      await user.save();

      res.json({
        success: true,
        message: 'Password has been reset successfully.'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server error during password reset'
      });
    }
  });

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Return shape expected by frontend AuthContext (top-level user + success)
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting profile'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (clear cookie)
// @access  Public
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
