import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface LoginResult {
  success: boolean;
  requiresOtp?: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getApiBaseUrl = () => {
  // In development, use the backend port directly
  if (import.meta.env.DEV) {
    return 'http://localhost:8501';
  }
  // In production, use the same origin
  return import.meta.env.VITE_API_URL || window.location.origin;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      const API_BASE_URL = getApiBaseUrl();
      // Verify token with backend
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Token validation failed');
        }
        return res.json();
      })
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
          setError(null);
        } else {
          localStorage.removeItem('authToken');
        }
      })
      .catch((error) => {
        console.error('Token validation error:', error);
        localStorage.removeItem('authToken');
        if (error.message.includes('fetch')) {
          setError('Backend server is not running. Please start the backend server.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      setError(null);
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = (data && data.error) || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (data?.otpRequired) {
        return {
          success: false,
          requiresOtp: true,
          message: data.message as string | undefined
        };
      }

      if (data?.success && data.user && data.token) {
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        setError(null);
        return {
          success: true
        };
      }

      const fallbackError = (data && data.error) || 'Login failed';
      throw new Error(fallbackError);
    } catch (error: unknown) {
      console.error('Login error:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        setError('Backend server is not running. Please start the backend server on port 8501.');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during login.');
      }
      return {
        success: false
      };
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    try {
      setError(null);
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = (data && data.error) || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (data?.success && data.user && data.token) {
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        setError(null);
        return true;
      }

      const fallbackError = (data && data.error) || 'OTP verification failed';
      throw new Error(fallbackError);
    } catch (error: unknown) {
      console.error('OTP verification error:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        setError('Backend server is not running. Please start the backend server on port 8501.');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during OTP verification.');
      }
      return false;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      const API_BASE_URL = getApiBaseUrl();
      console.log('Attempting registration to:', `${API_BASE_URL}/api/auth/register`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Registration response data:', data);

      if (data.success && data.user && data.token) {
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        setError(null);
        return true;
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        setError('Backend server is not running. Please start the backend server on port 8501.');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during registration.');
      }
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      verifyOtp,
      register,
      logout,
      loading,
      error,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
