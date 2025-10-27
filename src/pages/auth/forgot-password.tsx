import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClient, PasswordResetRequestResponse } from '@/lib/api';

const PASSWORD_RESET_SESSION_KEY = 'smartai:password-reset';

type ResetStep = 'email' | 'otp';

type RequestSummary = Pick<PasswordResetRequestResponse, 'message' | 'target' | 'expiresInMinutes'>;

export function ForgotPasswordPage() {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<RequestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const apiClient = useMemo(() => new ApiClient(), []);

  const maskedTarget = status?.target ?? (email ? maskEmail(email) : undefined);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.requestPasswordReset(email.trim().toLowerCase());
      if (!response.success) {
        throw new Error(response.error || 'Failed to send OTP. Please try again.');
      }

      setStatus(response.data ?? null);
      setStep('otp');
      setOtp('');
    } catch (err) {
      console.error('Forgot password request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.verifyPasswordResetOtp(email.trim().toLowerCase(), otp.trim());
      if (!response.success || !response.data?.resetToken) {
        throw new Error(response.error || 'Invalid OTP. Please try again.');
      }

      const expiresInMinutes = response.data.expiresInMinutes ?? 30;
      const payload = {
        email: email.trim().toLowerCase(),
        resetToken: response.data.resetToken,
        expiresAt: Date.now() + expiresInMinutes * 60 * 1000
      };
      sessionStorage.setItem(PASSWORD_RESET_SESSION_KEY, JSON.stringify(payload));
      navigate('/reset-password');
    } catch (err) {
      console.error('Verify reset OTP error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.requestPasswordReset(email.trim().toLowerCase());
      if (!response.success) {
        throw new Error(response.error || 'Failed to resend OTP. Please try again.');
      }

      setStatus(response.data ?? null);
      setOtp('');
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setStep('email');
    setOtp('');
    setStatus(null);
    setError(null);
  };

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
            <h1 className="text-3xl font-bold text-center">Forgot Password</h1>
            <p className="mt-2 text-sm text-center text-muted-foreground">
              {step === 'email'
                ? 'Enter your registered email to receive a one-time password.'
                : `Enter the OTP we sent to ${maskedTarget ?? 'your email address'}.`}
            </p>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  <p>We sent a one-time password to {maskedTarget ?? 'your email'}.</p>
                  {status?.expiresInMinutes && (
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      The code expires in {status.expiresInMinutes} minute{status.expiresInMinutes === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium">One-Time Password</label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                    pattern="[0-9]*"
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify OTP'}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Button type="button" variant="ghost" onClick={handleStartOver} disabled={isLoading}>
                    Change email
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResendOtp} disabled={isLoading}>
                    Resend code
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-2 text-sm">
            <Link to="/login" className="text-primary underline">
              Back to sign in
            </Link>
            <Link to="/register" className="text-muted-foreground hover:text-primary">
              Create a new account
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
