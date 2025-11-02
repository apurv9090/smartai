import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

interface AuthFormProps {
  type: 'login' | 'register';
}

export function AuthForm({ type }: AuthFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otp, setOtp] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  
  const navigate = useNavigate();
  const { login, verifyOtp, register, error } = useAuth();

  useEffect(() => {
    setStep('credentials');
    setOtp('');
    setStatusMessage(null);
    setPendingEmail('');
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (type === 'login') {
        if (step === 'credentials') {
          const result = await login(email, password);
          if (result.requiresOtp) {
            setPendingEmail(email);
            setStatusMessage(result.message ?? 'OTP sent to your email.');
            setStep('otp');
            setOtp('');
            return;
          }

          if (result.success) {
            navigate('/');
            return;
          }
        } else {
          const targetEmail = pendingEmail || email;
          const success = await verifyOtp(targetEmail, otp.trim());
          if (success) {
            navigate('/');
            return;
          }
        }
      } else {
        const success = await register(name, email, password);
        if (success) {
          navigate('/');
          return;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setStatusMessage(null);
    setPendingEmail('');
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <h2 className="text-2xl font-bold text-center">
          {type === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'register' && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          {(type === 'register' || (type === 'login' && step === 'credentials')) && (
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete={type === 'login' ? 'username' : 'email'}
              />
            </div>
          )}

          {type === 'login' && step === 'otp' && (
            <div className="p-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p>{statusMessage ?? 'OTP sent to your email address.'}</p>
              <p className="mt-1 text-xs text-blue-500 dark:text-blue-200">
                Enter the code sent to {pendingEmail || email} to continue.
              </p>
            </div>
          )}

          {(type === 'register' || (type === 'login' && step === 'credentials')) && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete={type === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {type === 'login' && step === 'otp' && (
            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium">
                One-Time Password
              </label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                pattern="[0-9]*"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              {error}
              {error.includes('Backend server') && (
                <div className="mt-2 text-xs">
                  <p>To start the backend server:</p>
                  <p>1. Open terminal in the project folder</p>
                  <p>2. Run: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">cd backend && npm run dev</code></p>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading
              ? 'Please wait...'
              : type === 'login'
                ? step === 'otp'
                  ? 'Verify OTP'
                  : 'Send OTP'
                : 'Sign Up'}
          </Button>

          {type === 'login' && step === 'otp' && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleBackToCredentials}
              disabled={isLoading}
            >
              Use a different account
            </Button>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        {type === 'login' ? (
          <div className="text-sm text-center space-y-2">
            <p>
              <Link to="/forgot-password" className="font-medium text-primary underline">
                Forgot your password?
              </Link>
            </p>
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-primary underline">
                Sign up
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-center">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary underline">
              Sign in
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
