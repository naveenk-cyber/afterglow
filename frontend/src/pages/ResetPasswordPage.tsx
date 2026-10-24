import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Wordmark from '../components/ui/Wordmark';
import { authService } from '../services/api';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    // Application-level checks come first so the same styled, announced message
    // is used everywhere instead of the browser's native validation bubble.
    if (!token.trim()) {
      setMessage({ kind: 'error', text: 'Paste the reset token from your reset link.' });
      return;
    }
    if (!password) {
      setMessage({ kind: 'error', text: 'Choose a new password.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ kind: 'error', text: 'Passwords do not match.' });
      return;
    }
    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setMessage({
        kind: 'success',
        text: 'Password updated. Please sign in again.',
      });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="w-11 h-11 rounded-control bg-brand text-on-accent grid place-items-center">
              <Zap className="w-6 h-6 text-on-accent" aria-hidden="true" />
            </span>
            <Wordmark className="text-2xl text-ink" />
          </Link>
          <h1 className="ev-title text-ink mt-6">Choose a new password</h1>
          <p className="ev-body text-ink-muted mt-2">
            Reset links expire after 30 minutes and can only be used once.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="bg-surface rounded-panel border border-line p-8 space-y-5 shadow-panel"
        >
          {message && (
            <div
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-control border p-4 text-sm ${
                message.kind === 'error'
                  ? 'border-error/25 bg-error-soft text-error-ink'
                  : 'border-brand/30 bg-brand-soft text-brand-soft-ink'
              }`}
            >
              {message.kind === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <Input
            label="Reset token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            helperText="Paste the token from your reset link. In local development the API returns it directly."
          />
          <Input
            label="New password"
            type="password"
            showPasswordToggle
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            helperText="At least 8 characters with upper, lower, number, and symbol."
          />
          <Input
            label="Confirm password"
            type="password"
            showPasswordToggle
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />

          <Button type="submit" fullWidth isLoading={isLoading} disabled={isLoading}>
            Update password
          </Button>

          <Link
            to="/login"
            className="block text-center text-sm text-brand hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
