import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase is the OAuth broker behind "Continue with Google".
 *
 * Only two public values are needed here: the project URL and the anon
 * (publishable) key. They are safe in a browser bundle by design — everything
 * they authorise is still governed by the project's own policies — while the
 * service-role key must never be shipped to the frontend, because Vite would
 * inline it straight into the build and it bypasses those policies.
 *
 * The Supabase session created here is short-lived on purpose: /auth/callback
 * exchanges the access token for Afterglow's own HttpOnly session cookie and
 * then drops the Supabase copy. No Google client secret, and no Supabase token,
 * is trusted by the API on its own.
 */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/** Supabase's browser-safe key prefix. */
const PUBLISHABLE_PREFIX = 'sb_publishable_';
/** The privileged prefix; it bypasses row level security and must stay server-side. */
const SECRET_PREFIX = 'sb_secret_';

const LOOPBACK_URL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Read one JWT segment. Used only to look at the `role` claim, never to trust it. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const segment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as unknown;
    return decoded && typeof decoded === 'object' ? (decoded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Why these two values cannot be used in a browser, or `null` when they can.
 *
 * This exists to make one specific mistake impossible: a Supabase *secret* key
 * (or a legacy `service_role` JWT) configured under a `VITE_` name. Vite inlines
 * `VITE_*` values into the shipped JavaScript, so that mistake would publish
 * privileged credentials to every visitor — and Supabase rejects secret keys
 * from a browser anyway (HTTP 401 on the User-Agent), so sign-in would break at
 * the same time. Anything questionable leaves Google sign-in switched off, and
 * the reason is reported without ever printing the value.
 *
 * The backend repeats this check for its own variable pair; see
 * backend/src/supabase.js.
 */
export function describeConfigurationProblem(url: string, key: string): string | null {
  const base = url.trim().replace(/\/+$/, '');
  const value = key.trim();

  if (!base && !value) return 'no Supabase URL or key is configured';
  if (!base) return 'VITE_SUPABASE_URL is missing';
  if (!/^https?:\/\//i.test(base)) return 'the Supabase URL must start with https://';
  if (!LOOPBACK_URL.test(base) && !/^https:/i.test(base)) {
    return 'the Supabase URL must use https (http is only allowed for localhost)';
  }

  if (!value) return 'VITE_SUPABASE_ANON_KEY is missing';
  if (value.startsWith(SECRET_PREFIX)) {
    return 'VITE_SUPABASE_ANON_KEY holds a Supabase secret key, which bypasses row level security and must never reach a browser';
  }
  if (value.startsWith(PUBLISHABLE_PREFIX)) return null;

  const payload = decodeJwtPayload(value);
  if (payload) {
    const role = typeof payload.role === 'string' ? payload.role : '';
    if (role === 'anon') return null; // legacy anon key, still public by design
    return role
      ? `VITE_SUPABASE_ANON_KEY has role "${role}", not "anon"`
      : 'VITE_SUPABASE_ANON_KEY is a JWT without a role claim';
  }

  return 'VITE_SUPABASE_ANON_KEY is not a publishable key (expected sb_publishable_…) or a legacy anon key';
}

const configurationProblem = describeConfigurationProblem(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * True when this build has the two public Supabase values it needs.
 * A misconfigured pair stays disabled rather than failing later.
 */
export const googleSignInEnabled = configurationProblem === null && Boolean(SUPABASE_URL);

if ((SUPABASE_URL || SUPABASE_ANON_KEY) && configurationProblem) {
  // A developer aid, not user-facing copy. The message names the problem and
  // never echoes the configured value.
  console.error(
    `[afterglow] Google sign-in is disabled: ${configurationProblem}. ` +
      'Use the publishable key from Supabase → Project Settings → API Keys.',
  );
}

/**
 * Where Supabase returns the browser after Google. This exact URL (and the
 * localhost one) must be listed under Authentication → URL Configuration →
 * Redirect URLs in the Supabase project.
 */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

const RETURN_TO_KEY = 'afterglow:oauth:returnTo';

export const GOOGLE_NOT_CONFIGURED_MESSAGE =
  'Google sign-in is not configured for this deployment.';

/** True when the deployment has Supabase values, but they are not usable. */
export const googleSignInMisconfigured = Boolean(SUPABASE_URL || SUPABASE_ANON_KEY) && !googleSignInEnabled;

let client: SupabaseClient | null = null;

/** Lazily created, so an unconfigured build never constructs a client. */
function getClient(): SupabaseClient | null {
  if (!googleSignInEnabled) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE keeps the access token out of the URL fragment; the code is
        // exchanged for a session when the browser lands back on the app.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        // The Supabase session exists only between the redirect back and the
        // exchange with the Afterglow API, so no refresh timer is left running.
        autoRefreshToken: false,
        storageKey: 'afterglow-supabase-oauth',
      },
    });
  }
  return client;
}

/**
 * Only same-site paths are honoured, so a crafted `next` value cannot turn the
 * sign-in page into an open redirect.
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

function rememberReturnTo(returnTo: string | undefined) {
  if (!returnTo) return;
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } catch {
    // Storage can be unavailable in private mode; the default destination is fine.
  }
}

/** Read and clear the remembered destination. */
export function takeReturnTo(fallback = '/dashboard'): string {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    stored = null;
  }
  return safeInternalPath(stored, fallback);
}

/** Turn Supabase's wording into something a driver can act on. */
function describeAuthError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('provider is not enabled') || text.includes('not enabled')) {
    return 'Google sign-in is not enabled for this project yet.';
  }
  if (text.includes('redirect') && text.includes('not allowed')) {
    return 'This URL is not allowed as a sign-in redirect. Please contact support.';
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach Google sign-in. Check your connection and try again.';
  }
  return message || 'Google sign-in could not be started. Please try again.';
}

/**
 * Send the browser to Google. This navigates away on success, so callers only
 * see a resolution when something went wrong.
 */
export async function startGoogleSignIn(returnTo?: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) throw new Error(GOOGLE_NOT_CONFIGURED_MESSAGE);

  rememberReturnTo(returnTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${OAUTH_CALLBACK_PATH}`,
      // Ask which Google account to use rather than silently reusing the last one.
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw new Error(describeAuthError(error.message));
}

/**
 * Session produced by the redirect back from Supabase.
 *
 * `getSession()` awaits the client's initialisation, which is where the PKCE
 * code in the URL is exchanged, so this resolves with the session rather than
 * racing it.
 */
export async function readSupabaseSession(): Promise<Session> {
  const supabase = getClient();
  if (!supabase) throw new Error(GOOGLE_NOT_CONFIGURED_MESSAGE);

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(describeAuthError(error.message));
  if (!data.session) {
    throw new Error('Google did not return a sign-in session. Please try again.');
  }
  return data.session;
}

/**
 * Drop the Supabase token from the browser.
 *
 * Afterglow's own cookie is the session, so the third-party copy must not be
 * left behind: it would keep a Google identity signed in on a shared machine
 * and, worse, outlive a sign-out from Afterglow itself.
 */
export async function clearSupabaseSession(): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Storage can be unavailable; the Afterglow cookie is already authoritative.
  }
}

/**
 * Error Supabase or Google appended to the callback URL, for example when the
 * driver closes the consent screen. Present means no session was created.
 */
export function readOAuthRedirectError(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get('error') || params.get('error_code');
  if (!code) return null;

  if (code === 'access_denied') {
    return 'Google sign-in was cancelled. You can try again, or sign in with your password.';
  }

  const description = params.get('error_description');
  if (description && description.length <= 200) return description;
  return 'Google sign-in could not be completed. Please try again.';
}
