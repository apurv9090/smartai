const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedTransporterConfigKey = null;

const buildConsoleTransport = () => {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true
  });
  transport.isConsoleTransport = true;
  return transport;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const getTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE
  } = process.env;

  const port = Number.parseInt(SMTP_PORT || '587', 10);
  const secure = toBoolean(SMTP_SECURE, port === 465);
  const configKey = [SMTP_HOST || 'console', port, secure ? 'secure' : 'insecure', SMTP_USER || ''].join('|');

  if (cachedTransporter && cachedTransporterConfigKey === configKey) {
    return cachedTransporter;
  }

  if (!SMTP_HOST) {
    const allowConsoleFallback = toBoolean(process.env.OTP_CONSOLE_FALLBACK ?? (process.env.NODE_ENV !== 'production'), process.env.NODE_ENV !== 'production');
    if (allowConsoleFallback) {
      console.warn('⚠️  SMTP credentials not configured. Falling back to console email transport. Set SMTP_HOST to send real emails.');
      cachedTransporter = buildConsoleTransport();
      cachedTransporterConfigKey = configKey;
      return cachedTransporter;
    }
    throw new Error('SMTP_HOST environment variable is required for sending emails');
  }

  const transportOptions = {
    host: SMTP_HOST,
    port,
    secure
  };

  if (SMTP_USER && SMTP_PASS) {
    transportOptions.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS
    };
  }

  cachedTransporter = nodemailer.createTransport(transportOptions);
  cachedTransporterConfigKey = configKey;
  return cachedTransporter;
};

const sendOtpEmail = async (recipient, otpCode, recipientName = '', expiresAt, options = {}) => {
  if (!recipient) {
    throw new Error('Recipient email address is required');
  }
  if (!otpCode) {
    throw new Error('OTP code is required');
  }

  const transporter = getTransporter();
  const {
    SMTP_FROM,
    EMAIL_FROM,
    SMTP_USER,
    OTP_TTL_MINUTES,
    OTP_EMAIL_SUBJECT,
    RESET_OTP_EMAIL_SUBJECT
  } = process.env;

  const fromAddress = SMTP_FROM || EMAIL_FROM || SMTP_USER || 'no-reply@example.com';
  if (!SMTP_FROM && !EMAIL_FROM && !SMTP_USER) {
    console.warn('⚠️  Sender address not configured. Using default no-reply@example.com. Set SMTP_FROM or EMAIL_FROM for production.');
  }

  const ttlMinutes = Number.parseInt(OTP_TTL_MINUTES || '10', 10);
  const expiresLabel = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 10;
  const purpose = options.purpose || 'login';
  const subject = options.subject
    || (purpose === 'reset'
      ? (RESET_OTP_EMAIL_SUBJECT || 'SmartAI password reset code')
      : (OTP_EMAIL_SUBJECT || 'Your login OTP code'));
  const safeName = recipientName ? recipientName.trim() : 'there';

  const introLine = options.introLine
    || (purpose === 'reset'
      ? 'We received a request to reset your SmartAI account password.'
      : 'Use this code to finish signing in to SmartAI.');
  const instructionsLine = options.instructionsLine
    || (purpose === 'reset'
      ? 'Enter this code on the password reset screen to continue.'
      : 'Enter this code on the sign-in screen to continue.');
  const closingLine = options.closingLine
    || 'If you did not request this code, please contact support immediately.';

  const formattedExpiry = expiresAt instanceof Date ? expiresAt.toLocaleString() : null;

  const textBody = [
    `Hello ${safeName},`,
    '',
    introLine,
    '',
    `Your one-time password (OTP) is ${otpCode}.`,
    instructionsLine,
    `It will expire in ${expiresLabel} minute${expiresLabel === 1 ? '' : 's'}.`,
    formattedExpiry ? `Expiration time: ${formattedExpiry}` : null,
    '',
    closingLine
  ].filter(Boolean).join('\n');

  const htmlBody = `
    <p>Hello ${safeName},</p>
    <p>${introLine}</p>
    <p>Your one-time password (OTP) is <strong>${otpCode}</strong>.</p>
    <p>${instructionsLine}</p>
    <p>It will expire in ${expiresLabel} minute${expiresLabel === 1 ? '' : 's'}${formattedExpiry ? ` (expiration time: ${formattedExpiry})` : ''}.</p>
    <p>${closingLine}</p>
  `;

  let info;
  try {
    info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody
    });
  } catch (err) {
    if (err && err.code === 'EAUTH') {
      cachedTransporter = null;
      cachedTransporterConfigKey = null;
    }
    throw err;
  }

  if (transporter.isConsoleTransport) {
    console.log('✉️  OTP email (console transport):', {
      to: recipient,
      otp: otpCode,
      subject,
      preview: info?.message?.toString()
    });
  }
};

module.exports = {
  sendOtpEmail
};
