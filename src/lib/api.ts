// API client with robust error handling

// Get base URL from environment variables with fallback
const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8501';
  }
  return import.meta.env.VITE_API_URL || window.location.origin;
};

// Standard response type
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// Define specific response types for different API endpoints
export interface ChatResponse {
  response: string;
  chatId?: string;
  fallback?: boolean; // Added fallback property
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: UserProfile;
  token: string;
}

export interface Chat {
  _id: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatWithMessages {
  chat: Chat;
  messages: Message[];
}

export interface CreateChatResponse {
  chat: Chat;
  firstMessage?: Message;
}

export interface SendMessageResponse {
  userMessage: Message;
  aiMessage: Message;
  chatId: string;
}

export interface GetChatsResponse {
  chats: Chat[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AIStatusResponse {
  configured: boolean;
  model: string;
  provider: string;
  status: string;
}

// Error handling with proper typing
class ApiError extends Error {
  statusCode: number;
  isConnectionError: boolean;
  
  constructor(message: string, statusCode = 500, isConnectionError = false) {
    super(message);
    this.statusCode = statusCode;
    this.isConnectionError = isConnectionError;
    this.name = 'ApiError';
  }
}

// Type guard function for Error objects
export const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

// API client class
export class ApiClient {
  baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  // Helper method to handle connection errors
  private handleConnectionError(error: unknown): never {
    console.error('Connection error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Backend server is not running. Please start the backend server on port 8501.',
        0,
        true
      );
    }
    throw new ApiError('Unknown connection error occurred', 0, true);
  }

  // Main request method with error handling
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const token = localStorage.getItem('authToken');
      const url = `${this.baseUrl}${endpoint}`;
      
      // Default headers with auth token if available
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      };

      console.log(`API Request to: ${url}`, { method: options.method || 'GET' });
      
      const response = await fetch(url, {
        ...options,
        headers,
      }).catch(error => {
        throw this.handleConnectionError(error);
      });

      // Parse JSON response
      const data = await response.json().catch(_parseError => {
        throw new ApiError('Invalid JSON response from server', response.status);
      });

      // Handle API error responses
      if (!response.ok) {
        throw new ApiError(
          data.error || `Server error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          success: false,
          error: error.message,
          statusCode: error.statusCode,
        };
      }
      
      // Fallback for unknown errors
      console.error('Unexpected API error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
        statusCode: 500,
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('/api/auth/me');
  }

  // Chat endpoints
  async createChat(title: string): Promise<ApiResponse<CreateChatResponse>> {
    return this.request<CreateChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async sendMessage(message: string, chatId: string): Promise<ApiResponse<SendMessageResponse>> {
    return this.request<SendMessageResponse>(`/api/chat/${chatId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChats(): Promise<ApiResponse<GetChatsResponse>> {
    return this.request<GetChatsResponse>('/api/chat');
  }

  async getChat(chatId: string): Promise<ApiResponse<ChatWithMessages>> {
    return this.request<ChatWithMessages>(`/api/chat/${chatId}`);
  }

  async deleteChat(chatId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/chat/${chatId}`, {
      method: 'DELETE',
    });
  }

  async updateChatTitle(chatId: string, title: string): Promise<ApiResponse<{ chat: Chat }>> {
    return this.request<{ chat: Chat }>(`/api/chat/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  // Health check endpoint
  async checkServerStatus(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
  
  // AI status check endpoint
  async checkAIStatus(): Promise<ApiResponse<AIStatusResponse>> {
    return this.request<AIStatusResponse>('/api/ai/status');
  }
}

// Create and export a singleton instance
export const api = new ApiClient();
export default api;
