import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

interface GoogleSignInButtonProps {
  /** Where to land once signed in. Defaults to the dashboard. */
  returnTo?: string;
  label?: string;
}

/** The official multicolour Google mark. */
const GoogleMark: React.FC = () => (
  <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
);

/**
 * "Continue with Google", backed by Supabase.
 *
 * Renders nothing at all when this build has no Supabase URL and anon key, so
 * a half-configured deployment shows a normal sign-in page instead of a button
 * that cannot work. Clicking it hands the browser to Google, which means the
 * only outcomes it can report are the failures: cancellation and provider or
 * redirect errors.
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  returnTo,
  label = 'Continue with Google',
}) => {
  const { googleSignInEnabled, loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!googleSignInEnabled) return null;

  const handleClick = async () => {
    setError('');
    setIsRedirecting(true);
    try {
      // A resolved call means the browser has been sent to Google, so the
      // button stays busy until the page unloads — that also blocks a second
      // click while the navigation is starting. Only a failure is interactive.
      await loginWithGoogle(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in could not be started.');
      setIsRedirecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        onClick={handleClick}
        isLoading={isRedirecting}
        leftIcon={<GoogleMark />}
      >
        {isRedirecting ? 'Opening Google…' : label}
      </Button>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs leading-relaxed text-error-ink">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;
