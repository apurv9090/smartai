const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
  this.fallbackModel = null;
    this.isConfigured = false;
  this.primaryModelName = 'gemini-2.5-flash';
  this.fallbackModelName = 'gemini-1.5-flash-8b';

    this.initialize();
  }

  initialize() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === 'your-gemini-api-key-here') {
        console.warn('⚠️  Gemini API key not configured');
        this.isConfigured = false;
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.primaryModelName,
        systemInstruction: 'You are a helpful coding assistant. Always use prior messages in this chat as context. If the user asks to explain code without pasting it again, refer to the previously shared code in the conversation and provide a clear, step-by-step explanation.',
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        }
      });
      // Prepare a lighter fallback model for overload scenarios
      this.fallbackModel = this.genAI.getGenerativeModel({
        model: this.fallbackModelName,
        systemInstruction: 'You are a helpful coding assistant. Always use prior messages in this chat as context. If the user asks to explain code without pasting it again, refer to the previously shared code in the conversation and provide a clear, step-by-step explanation.',
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        }
      });

      this.isConfigured = true;
      console.log('✅ Gemini AI service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI service:', error);
      this.isConfigured = false;
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Generic retry helper with exponential backoff and jitter
  async withRetry(fn, options = {}) {
    const {
      retries = 3,
      baseDelayMs = 500,
      factor = 2,
      canRetry = () => true,
    } = options;

    let attempt = 0;
    let delay = baseDelayMs;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        const status = err?.status;
        if (attempt > retries || !canRetry(err, status)) {
          throw err;
        }
        // Add +/- 20% jitter
        const jitter = delay * (0.8 + Math.random() * 0.4);
        await this.sleep(jitter);
        delay *= factor;
      }
    }
  }

  async generateResponse(message, history = []) {
    try {
      if (!this.isConfigured || !this.model) {
        return {
          success: false,
          error: 'AI service not configured',
          response: 'I apologize, but the AI service is not properly configured. Please contact the administrator.'
        };
      }

      const execGenerate = async (modelInstance, modelName) => {
        const normalizedHistory = Array.isArray(history)
          ? history
              .filter(h => h && h.role && h.content && h.role !== 'system')
              .slice(-40)
              .map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(h.content) }]
              }))
          : [];
        const chat = modelInstance.startChat({
          history: normalizedHistory,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
          }
        });
        const result = await chat.sendMessage(message);
        const response = result.response;
        const text = response.text();
        if (!text) throw new Error('Empty response from AI service');
        return { text, modelName };
      };

      // First try primary model with retries on 429/503
      let out;
      try {
        const res = await this.withRetry(
          () => execGenerate(this.model, this.primaryModelName),
          {
            retries: 3,
            baseDelayMs: 600,
            factor: 2,
            canRetry: (_err, status) => status === 429 || status === 503,
          }
        );
        out = res;
      } catch (primaryErr) {
        console.warn('Primary model failed, trying fallback model:', primaryErr?.status || primaryErr?.message);
        // Try fallback model with fewer retries
        const res = await this.withRetry(
          () => execGenerate(this.fallbackModel || this.model, this.fallbackModelName),
          {
            retries: 2,
            baseDelayMs: 800,
            factor: 2,
            canRetry: (_err, status) => status === 429 || status === 503,
          }
        );
        out = res;
      }

      const tokens = Math.ceil(out.text.length / 4);
      return {
        success: true,
        response: out.text,
        tokens,
        model: out.modelName,
      };
    } catch (error) {
      console.error('AI generation error:', error);

      let errorMessage = 'I apologize, but I\'m having trouble generating a response right now. Please try again.';

      if (error.message?.includes('API_KEY')) {
        errorMessage = 'AI service authentication failed. Please check the API key configuration.';
      } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
        errorMessage = 'AI service quota exceeded. Please try again later.';
      } else if (error.status === 429 || error.status === 503) {
        errorMessage = 'The AI service is temporarily overloaded. Please try again in a moment.';
      }

      return {
        success: false,
        error: error.message,
        response: errorMessage
      };
    }
  }

  async getStatus() {
    try {
      if (!this.isConfigured) {
        return {
          configured: false,
          model: null,
          provider: 'Google Gemini',
          status: 'not_configured',
          message: 'Gemini API key not configured'
        };
      }

      // Avoid triggering generation on status; report readiness based on configuration
      return {
        configured: true,
        model: this.primaryModelName,
        provider: 'Google Gemini',
        status: 'ready',
        message: 'AI service configured'
      };
    } catch (error) {
      console.error('AI status check error:', error);
      return {
        configured: this.isConfigured,
        model: this.primaryModelName,
        provider: 'Google Gemini',
        status: 'error',
        message: 'Failed to check AI service status'
      };
    }
  }

  // Method to reinitialize the service (useful for configuration updates)
  reinitialize() {
    console.log('🔄 Reinitializing AI service...');
    this.initialize();
  }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService;
