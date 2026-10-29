import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Wordmark from '../../components/ui/Wordmark';
import {
  clearSupabaseSession,
  readOAuthRedirectError,
  readSupabaseSession,
  takeReturnTo,
} from '../../services/supabase';

/**
 * Landing point for the Google round trip.
 *
 * Supabase sends the browser back here with a single-use PKCE code. This page
 * exchanges it for a Supabase session, hands the access token to the Afterglow
 * API (which verifies it with Supabase and answers with the normal HttpOnly
 * session cookie), then drops the Supabase copy and continues to wherever the
 * driver was heading.
 */
const GoogleCallbackPage: React.FC = () => {
  const { completeGoogleLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  // Read the query from the router rather than window.location: they are the
  // same URL under BrowserRouter, and the router keeps the original parameters
  // even if the Supabase client rewrites the address bar while it works.
  const search = useLocation().search;
  const [error, setError] = useState('');
  // StrictMode mounts effects twice in development, and a PKCE code is
  // single-use, so the exchange must only ever run once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = async () => {
      const redirectError = readOAuthRedirectError(search);
      if (redirectError) {
        await clearSupabaseSession();
        setError(redirectError);
        return;
      }

      if (!new URLSearchParams(search).has('code')) {
        // Somebody opened this URL directly, or the provider returned nothing.
        if (isAuthenticated) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setError('This page finishes a Google sign-in. Start one from the sign-in page.');
        return;
      }

      try {
        const session = await readSupabaseSession();
        await completeGoogleLogin(session.access_token);
        await clearSupabaseSession();
        navigate(takeReturnTo(), { replace: true });
      } catch (err) {
        await clearSupabaseSession();
        setError(
          err instanceof Error
            ? err.message
            : 'Google sign-in could not be completed. Please try again.',
        );
      }
    };

    void finish();
  }, [completeGoogleLogin, isAuthenticated, navigate, search]);

  return (
    <div className="mx-auto flex max-w-[1280px] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-card sm:p-8">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-brand text-on-accent">
            <Zap className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} aria-hidden="true" />
          </span>
          <Wordmark className="text-[1.3rem] text-ink" />
        </Link>

        {error ? (
          <>
            <span className="mx-auto mt-6 grid h-11 w-11 place-items-center rounded-full border border-error/30 bg-error-soft text-error-ink">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-[-0.02em] text-ink">
              Google sign-in did not finish
            </h1>
            <p role="alert" className="mt-2 text-sm leading-relaxed text-ink-muted">
              {error}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-brand-strong"
              >
                Back to sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-11 items-center justify-center rounded-control border border-line bg-surface-muted px-5 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
              >
                Create an account with email
              </Link>
            </div>
          </>
        ) : (
          <>
            <span
              className="mx-auto mt-6 grid h-11 w-11 place-items-center rounded-full border border-brand/25 bg-brand-soft text-brand-soft-ink"
              aria-hidden="true"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
            <h1 aria-live="polite" className="mt-4 text-xl font-bold tracking-[-0.02em] text-ink">
              Finishing sign-in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Verifying your Google account and opening your Afterglow session. This takes a moment.
            </p>
          </>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-subtle">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          Your Google password is never shared with Afterglow.
        </p>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
