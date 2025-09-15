// AI Model API Client for the Google Generative AI backend at port 8090

// Get base URL for the AI API
const getAiApiBaseUrl = () => {
  return import.meta.env.VITE_AI_API_URL || 'http://localhost:8095';
};

// AI API response interfaces
export interface AiResponse {
  response: string;
  model?: string;
  filtered?: boolean;
  error?: string;
}

export interface AiHealthResponse {
  status: string;
  model_loaded: boolean;
  model_info?: {
    name: string;
    type: string;
  };
  provider?: string;
}

// Error handling with proper typing
class AiApiError extends Error {
  statusCode: number;
  isConnectionError: boolean;
  
  constructor(message: string, statusCode = 500, isConnectionError = false) {
    super(message);
    this.statusCode = statusCode;
    this.isConnectionError = isConnectionError;
    this.name = 'AiApiError';
  }
}

// AI API client class
export class AiApiClient {
  baseUrl: string;

  constructor() {
    this.baseUrl = getAiApiBaseUrl();
  }

  // Helper method to handle connection errors
  private handleConnectionError(error: unknown): never {
    console.error('AI API connection error:', error);
    
    // Check for specific error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AiApiError(
        'AI backend server is not running. Please start the AI backend server on port 8090.',
        0,
        true
      );
    }
    
    // Handle CORS errors
    if (error instanceof DOMException && error.name === 'NetworkError') {
      throw new AiApiError(
        'CORS error: The request was blocked due to cross-origin restrictions.',
        403,
        true
      );
    }
    
    // Generic error
    throw new AiApiError(
      `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0, 
      true
    );
  }

  // Main request method with error handling
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      // Default headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      };

      console.log(`AI API Request to: ${url}`, { method: options.method || 'GET' });
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors', // Explicitly request CORS mode
        credentials: 'same-origin', // Changed from 'include' to 'same-origin' to avoid CORS issues
        signal: controller.signal
      }).catch(error => {
        throw this.handleConnectionError(error);
      });
      
      clearTimeout(timeoutId); // Clear the timeout

      // Parse JSON response
      const data = await response.json().catch(_parseError => {
        throw new AiApiError('Invalid JSON response from AI server', response.status);
      });

      // Handle API error responses
      if (!response.ok) {
        throw new AiApiError(
          data.detail || `AI Server error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return data as T;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  }

  // Chat endpoint
  async sendMessage(message: string): Promise<AiResponse> {
    try {
      // First check if model is loaded
      try {
        const healthCheck = await this.checkStatus();
        console.log("Health check before sending message:", healthCheck);
        
        if (!healthCheck.model_loaded) {
          console.warn("Gemini AI model is not loaded according to health check");
          throw new AiApiError("Gemini AI model is not available", 500);
        }
      } catch (healthError) {
        console.warn("Health check failed before sending message:", healthError);
        // Continue to try anyway with fallback response
        return { 
          response: "Sorry, I'm having trouble connecting to the Gemini AI service. Please make sure the Gemini server is running on port 8095 by executing 'python gemini_server.py'."
        };
      }
    
      interface GeminiResponse extends AiResponse {
        filtered?: boolean;
        error?: string;
      }
      
      const response = await this.request<GeminiResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      
      // Handle filtered content specially
      if (response.filtered) {
        console.warn("Response was filtered by Gemini content safety system");
        return {
          response: response.response || "I'm unable to provide a response to that request due to content safety policies.",
          model: "gemini-2.5-flash (filtered)"
        };
      }
      
      // Handle error responses
      if (response.error) {
        console.warn("Gemini API returned an error:", response.error);
      }
      
      return response;
    } catch (error) {
      console.warn("Error sending message to Gemini AI backend:", error);
      // Return a graceful fallback response instead of throwing
      return { 
        response: "Sorry, I'm having trouble connecting to the Gemini AI service. The Gemini model is currently unavailable. Make sure the server is running on port 8095 by executing 'python gemini_server.py'."
      };
    }
  }

  // Health check endpoint
  async checkStatus(): Promise<AiHealthResponse> {
    try {
      // Try with a longer timeout for model loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const url = `${this.baseUrl}/health`;
      console.log(`Checking Gemini AI status at: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
        credentials: 'same-origin',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new AiApiError(`Gemini AI status check failed: ${response.status} ${response.statusText}`, response.status);
      }
      
      const data = await response.json();
      return data as AiHealthResponse;
    } catch (error) {
      // If the /health endpoint fails, try the root endpoint as fallback
      if (error instanceof AiApiError && error.statusCode === 404) {
        try {
          console.log("Health endpoint failed, trying root endpoint...");
          interface RootResponse {
            status: string;
            provider?: string;
            model?: string;
            endpoints?: string[];
          }
          
          const rootResponse = await this.request<RootResponse>('/');
          if (rootResponse && rootResponse.status === "running") {
            console.log("Root endpoint successful, Gemini server is running");
            return {
              status: "healthy",
              model_loaded: true,
              provider: "Google Gemini AI",
              model_info: {
                name: rootResponse.model || "gemini-2.5-flash",
                type: "text"
              }
            };
          }
        } catch (rootError) {
          console.error("Failed to connect to Gemini root endpoint:", rootError);
        }
      }
      
      console.error("Gemini AI status check failed:", error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const aiApi = new AiApiClient();
export default aiApi;
