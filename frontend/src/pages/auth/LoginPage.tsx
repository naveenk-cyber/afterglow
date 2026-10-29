import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Wordmark from '../../components/ui/Wordmark';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { safeInternalPath } from '../../services/supabase';
import type { LoginForm } from '../../types';

const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email address').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

const DEMO_EMAIL = 'demo@afterglow.test';
const DEMO_PASSWORD = 'Demo1234!';

const LoginPage: React.FC = () => {
  const [loginError, setLoginError] = useState('');
  const { login, isLoading, googleSignInEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute sends the intended destination along in `state`, so a Google
  // sign-in can land there too instead of always starting at the dashboard.
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const returnTo = safeInternalPath(
    from?.pathname ? `${from.pathname}${from.search ?? ''}` : null,
  );

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  const submit = async (data: LoginForm) => {
    try {
      setLoginError('');
      await login(data);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign in failed. Try again.');
    }
  };

  const fillDemo = () => {
    setValue('email', DEMO_EMAIL, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
    setValue('rememberMe', true);
  };

  const submitDemo = async () => {
    fillDemo();
    await submit({ ...getValues(), email: DEMO_EMAIL, password: DEMO_PASSWORD });
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-card lg:grid-cols-[0.92fr_1.08fr]">
        {/* Visual panel */}
        <div className="ev-photo-scope relative hidden min-h-[40rem] overflow-hidden bg-deep lg:block">
          <img
            src="/assets/station-6.jpg"
            alt="Electric sedan charging at dusk"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(6,7,8,0.25) 0%, rgba(6,7,8,0.55) 55%, rgba(6,7,8,0.95) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative flex h-full flex-col justify-between p-10">
            <Link to="/" className="inline-flex items-center gap-2.5 self-start">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-brand text-on-accent">
                <Zap className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              </span>
              <Wordmark className="text-[1.3rem] text-deep-ink" />
            </Link>

            <div>
              <p className="ev-label">Welcome back</p>
              <p className="mt-4 max-w-[24ch] text-[clamp(1.8rem,2.6vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.04em] text-deep-ink">
                Every session, saved station and receipt in one place.
              </p>
              <div className="mt-8 flex items-center gap-2 text-xs text-deep-ink-muted">
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                Signed in with a secure, HttpOnly session cookie.
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-brand text-on-accent">
                <Zap className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              </span>
              <Wordmark className="text-[1.3rem] text-ink" />
            </Link>

            <h1 className="text-[clamp(2rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.04em] text-ink">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Sign in to see your bookings, saved stations and wallet activity.
            </p>

            {googleSignInEnabled && (
              <div className="mt-8 space-y-5">
                <GoogleSignInButton returnTo={returnTo} />
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    or use your email
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5" noValidate>
              {loginError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-soft px-3.5 py-3 text-sm text-error-ink"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {loginError}
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={<Mail />}
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="At least 6 characters"
                leftIcon={<Lock />}
                showPasswordToggle
                error={errors.password?.message}
                {...register('password')}
              />

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-line-strong bg-surface-muted accent-[color:var(--color-brand)]"
                    {...register('rememberMe')}
                  />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-brand transition-colors hover:text-brand-strong"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 rounded-card border border-line bg-surface-muted p-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Demo account
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                The seeded demo account signs in against the Afterglow API and stores its bookings,
                wallet and sessions in the project database.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={fillDemo} type="button">
                  Use the demo account
                </Button>
                <Button variant="secondary" size="sm" onClick={submitDemo} type="button" isLoading={isLoading}>
                  Sign in with demo account
                </Button>
              </div>
              <p className="mt-3 font-mono text-[0.7rem] text-ink-subtle">
                <span>demo@afterglow.test</span>
                <span aria-hidden="true"> · </span>
                <span>Demo1234!</span>
              </p>
            </div>

            <p className="mt-6 text-sm text-ink-muted">
              New to Afterglow?{' '}
              <Link
                to="/signup"
                className="font-semibold text-brand transition-colors hover:text-brand-strong"
              >
                Create a free account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
