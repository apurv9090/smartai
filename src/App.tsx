import './App.css'
import { Chat } from './pages/chat/chat'
import { LoginPage } from './pages/auth/login'
import { RegisterPage } from './pages/auth/register'
import { ForgotPasswordPage } from './pages/auth/forgot-password'
import { ResetPasswordPage } from './pages/auth/reset-password'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext'
import { ChatProvider } from './context/ChatContext'
import { AuthProvider, useAuth } from './context/AuthContext'

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ChatProvider>
        <Router 
          future={{ 
            v7_startTransition: true, 
            v7_relativeSplatPath: true 
          }}
        >
          <div className="w-full h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <AppRoutes />
          </div>
        </Router>
        </ChatProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App;