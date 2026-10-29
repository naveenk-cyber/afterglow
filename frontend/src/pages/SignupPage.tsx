import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Wordmark from '../components/ui/Wordmark';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { safeInternalPath } from '../services/supabase';

const signupSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().min(1, 'Enter your email address').email('Please enter a valid email address'),
    phone: z
      .string()
      .optional()
      .refine((value) => !value || value.replace(/\D/g, '').length >= 7, 'Enter a valid phone number'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    newsletter: z.boolean().optional(),
    agreeToTerms: z.boolean().refine((value) => value, 'You need to accept the terms to continue'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type SignupValues = z.infer<typeof signupSchema>;

const BENEFITS = [
  'Keep every charging session in one history',
  'Save stations for the routes you drive most',
  'Track wallet activity and spending',
];

const SignupPage: React.FC = () => {
  const [submitError, setSubmitError] = useState('');
  const { signup, isLoading, googleSignInEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Same contract as the sign-in page: land where the driver was heading, or
  // on the dashboard.
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const returnTo = safeInternalPath(
    from?.pathname ? `${from.pathname}${from.search ?? ''}` : null,
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { newsletter: true, agreeToTerms: false },
  });

  const password = watch('password') || '';
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const onSubmit = async (data: SignupValues) => {
    try {
      setSubmitError('');
      await signup({
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        password: data.password,
        confirmPassword: data.confirmPassword,
        newsletter: data.newsletter,
        agreeToTerms: data.agreeToTerms,
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not create the account.');
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-card lg:grid-cols-[1.08fr_0.92fr]">
        {/* Form panel */}
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-xl">
            <Link to="/" className="mb-8 inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-brand text-on-accent">
                <Zap className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              </span>
              <Wordmark className="text-[1.3rem] text-ink" />
            </Link>

            <h1 className="text-[clamp(2rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.04em] text-ink">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Free to start. Search and compare stations without a plan.
            </p>

            {googleSignInEnabled && (
              <div className="mt-8 space-y-5">
                <GoogleSignInButton returnTo={returnTo} label="Sign up with Google" />
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    or use your email
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-soft px-3.5 py-3 text-sm text-error-ink"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {submitError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  autoComplete="given-name"
                  placeholder="Alex"
                  leftIcon={<User />}
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <Input
                  label="Last name"
                  autoComplete="family-name"
                  placeholder="Morgan"
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>

              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={<Mail />}
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Phone number (optional)"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                leftIcon={<Phone />}
                error={errors.phone?.message}
                {...register('phone')}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="8+ characters"
                    leftIcon={<Lock />}
                    showPasswordToggle
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  {password && !errors.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex flex-1 gap-1" aria-hidden="true">
                        {[0, 1, 2, 3].map((index) => (
                          <span
                            key={index}
                            className={`h-1 flex-1 rounded-full ${
                              index < strength
                                ? strength >= 3
                                  ? 'bg-success'
                                  : 'bg-warning'
                                : 'bg-line'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[0.7rem] text-ink-subtle">
                        {strength >= 3 ? 'Strong' : strength >= 2 ? 'Fair' : 'Weak'}
                      </span>
                    </div>
                  )}
                </div>

                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  leftIcon={<Lock />}
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-line-strong bg-surface-muted accent-[color:var(--color-brand)]"
                    {...register('newsletter')}
                  />
                  Send me new stations and charging guides. No spam.
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-line-strong bg-surface-muted accent-[color:var(--color-brand)]"
                    {...register('agreeToTerms')}
                  />
                  <span>
                    I agree to the terms of use and understand this is a demo build where payments
                    are not connected.
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <p role="alert" className="text-xs text-error-ink">
                    {errors.agreeToTerms.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {isLoading ? 'Creating account…' : 'Create free account'}
              </Button>
            </form>

            <p className="mt-6 text-sm text-ink-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brand transition-colors hover:text-brand-strong">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Visual panel */}
        <div className="ev-photo-scope relative hidden overflow-hidden bg-deep lg:block">
          <img
            src="/assets/station-2.jpg"
            alt="Electric car charging at a scenic stop at sunset"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(200deg, rgba(6,7,8,0.2) 0%, rgba(6,7,8,0.6) 50%, rgba(6,7,8,0.96) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative flex h-full flex-col justify-end p-10">
            <p className="ev-label">Free to start</p>
            <p className="mt-4 max-w-[22ch] text-[clamp(1.8rem,2.6vw,2.4rem)] font-bold leading-[1.05] tracking-[-0.04em] text-deep-ink">
              One account for every charge.
            </p>
            <ul className="mt-6 space-y-2.5">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-deep-ink-muted">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <p className="mt-8 flex items-center gap-2 text-xs text-deep-ink-muted/80">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
              Demo build: account data stays in this browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
