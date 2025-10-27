import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClient } from '@/lib/api';

const PASSWORD_RESET_SESSION_KEY = 'smartai:password-reset';

type ResetSession = {
  email: string;
  resetToken: string;
  expiresAt: number;
};

export function ResetPasswordPage() {
  const [session, setSession] = useState<ResetSession | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const apiClient = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    const stored = sessionStorage.getItem(PASSWORD_RESET_SESSION_KEY);
    if (!stored) {
      navigate('/forgot-password', { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ResetSession;
      if (!parsed?.email || !parsed?.resetToken || typeof parsed.expiresAt !== 'number') {
        throw new Error('Invalid reset session');
      }

      if (parsed.expiresAt < Date.now()) {
        sessionStorage.removeItem(PASSWORD_RESET_SESSION_KEY);
        setStatus('Your reset session has expired. Please request a new code.');
        return;
      }

      setSession(parsed);
    } catch (err) {
      console.error('Failed to parse password reset session:', err);
      sessionStorage.removeItem(PASSWORD_RESET_SESSION_KEY);
      navigate('/forgot-password', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) {
      navigate('/forgot-password', { replace: true });
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.resetPassword(session.email, session.resetToken, password);
      if (!response.success) {
        throw new Error(response.error || 'Failed to reset password. Please try again.');
      }

      sessionStorage.removeItem(PASSWORD_RESET_SESSION_KEY);
      setStatus('Password updated successfully. Redirecting to sign in...');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error('Password reset submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    sessionStorage.removeItem(PASSWORD_RESET_SESSION_KEY);
    navigate('/forgot-password');
  };

  const maskedEmail = session ? maskEmail(session.email) : undefined;
  const isSuccess = typeof status === 'string' && status.toLowerCase().includes('successfully');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">Reset Password</h1>
            <p className="mt-2 text-sm text-center text-muted-foreground">
              {maskedEmail ? `You are resetting the password for ${maskedEmail}.` : 'Enter your new password below.'}
            </p>
          </CardHeader>
          <CardContent>
            {status && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                {status}
              </div>
            )}

            {!session ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Your reset session is not available. Please request a new password reset link.</p>
                <Button onClick={handleStartOver}>Request new code</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">New Password</label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={isLoading || isSuccess}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    disabled={isLoading || isSuccess}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || isSuccess}>
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleStartOver}
                  disabled={isLoading}
                >
                  Start over
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-2 text-sm">
            <Link to="/login" className="text-primary underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

const maskEmail = (value: string) => {
  const [local, domain] = value.split('@');
  if (!domain) {
    return value;
  }
  if (local.length <= 2) {
    return `${local.charAt(0) || ''}***@${domain}`;
  }
  return `${local.charAt(0)}${'*'.repeat(Math.max(local.length - 2, 1))}${local.slice(-1)}@${domain}`;
};
