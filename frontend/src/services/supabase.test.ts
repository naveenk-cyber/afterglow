import { afterEach, afterAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOAuth: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

/**
 * The module reads its two public values once, at import time, because Vite
 * inlines them at build time. Each case therefore re-imports it with the
 * environment it needs.
 */
async function loadModule(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Vitest loads the developer's own frontend/.env, so each case starts from a
  // clean slate and states the values it actually needs.
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./supabase');
}

const PUBLISHABLE_KEY = 'sb_publishable_test-key-not-a-secret';

const CONFIGURED = {
  VITE_SUPABASE_URL: 'https://project.supabase.co/',
  VITE_SUPABASE_ANON_KEY: PUBLISHABLE_KEY,
};

/** A JWT with an arbitrary payload; only the `role` claim is ever read. */
const fakeJwt = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  sessionStorage.clear();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('google sign-in configuration', () => {
  it('is disabled when the build has no Supabase values', async () => {
    const mod = await loadModule();
    expect(mod.googleSignInEnabled).toBe(false);
    await expect(mod.startGoogleSignIn()).rejects.toThrow(mod.GOOGLE_NOT_CONFIGURED_MESSAGE);
    await expect(mod.readSupabaseSession()).rejects.toThrow(mod.GOOGLE_NOT_CONFIGURED_MESSAGE);
    // Nothing is constructed, so an unconfigured build never calls Supabase.
    expect(mocks.createClient).not.toHaveBeenCalled();
    await expect(mod.clearSupabaseSession()).resolves.toBeUndefined();
  });

  it('is enabled and normalises a trailing slash', async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithOAuth: mocks.signInWithOAuth,
        getSession: mocks.getSession,
        signOut: mocks.signOut,
      },
    });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });

    const mod = await loadModule(CONFIGURED);
    expect(mod.googleSignInEnabled).toBe(true);

    await mod.startGoogleSignIn();

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.createClient.mock.calls[0][0]).toBe('https://project.supabase.co');
    expect(mocks.createClient.mock.calls[0][1]).toBe(PUBLISHABLE_KEY);
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
  });

  it('keeps the PKCE flow and does not leave a refresh timer running', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
    const mod = await loadModule(CONFIGURED);
    await mod.startGoogleSignIn();

    expect(mocks.createClient.mock.calls[0][2]).toMatchObject({
      auth: { flowType: 'pkce', detectSessionInUrl: true, autoRefreshToken: false },
    });
  });
});

describe('configuration validation', () => {
  it('accepts a publishable key and a legacy anon JWT', async () => {
    const { describeConfigurationProblem } = await loadModule();

    expect(describeConfigurationProblem('https://abc.supabase.co', PUBLISHABLE_KEY)).toBeNull();
    expect(
      describeConfigurationProblem('https://abc.supabase.co', fakeJwt({ role: 'anon' })),
    ).toBeNull();
    expect(describeConfigurationProblem('http://localhost:8000', PUBLISHABLE_KEY)).toBeNull();
  });

  it('names a privileged key instead of using it', async () => {
    const { describeConfigurationProblem } = await loadModule();

    expect(
      describeConfigurationProblem('https://abc.supabase.co', 'sb_secret_abcdefgh'),
    ).toMatch(/secret key/i);
    expect(
      describeConfigurationProblem('https://abc.supabase.co', fakeJwt({ role: 'service_role' })),
    ).toMatch(/service_role/);
  });

  it('rejects unusable urls, missing values and unrecognised keys', async () => {
    const { describeConfigurationProblem } = await loadModule();
    const url = 'https://abc.supabase.co';

    expect(describeConfigurationProblem(url, 'not-a-key')).toMatch(/publishable/i);
    expect(describeConfigurationProblem(url, '')).toMatch(/VITE_SUPABASE_ANON_KEY is missing/);
    expect(describeConfigurationProblem('', PUBLISHABLE_KEY)).toMatch(/URL is missing/);
    expect(describeConfigurationProblem('abc.supabase.co', PUBLISHABLE_KEY)).toMatch(/https/);
    expect(describeConfigurationProblem('http://afterglow.example.com', PUBLISHABLE_KEY)).toMatch(
      /https/,
    );
    expect(describeConfigurationProblem('', '')).toMatch(/no Supabase URL or key/i);
    // A malformed JWT must not be treated as a legacy anon key.
    expect(describeConfigurationProblem(url, 'a.b')).toMatch(/publishable/i);
  });

  it('disables sign-in and warns without printing the value when the key is privileged', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'sb_secret_abcdefghijklmnop';

    const mod = await loadModule({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: secret,
    });

    expect(mod.googleSignInEnabled).toBe(false);
    expect(mod.googleSignInMisconfigured).toBe(true);
    // No client is ever constructed, so the key cannot reach the network.
    await expect(mod.startGoogleSignIn()).rejects.toThrow(mod.GOOGLE_NOT_CONFIGURED_MESSAGE);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.flat().join(' ')).not.toContain(secret);
  });

  it('stays silent when nothing is configured at all', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await loadModule();

    expect(mod.googleSignInEnabled).toBe(false);
    expect(mod.googleSignInMisconfigured).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('return destination', () => {
  it('accepts same-site paths only, so it cannot become an open redirect', async () => {
    const mod = await loadModule();
    expect(mod.safeInternalPath('/search?connector=CCS')).toBe('/search?connector=CCS');
    expect(mod.safeInternalPath('/dashboard')).toBe('/dashboard');
    expect(mod.safeInternalPath('https://evil.example.com')).toBe('/dashboard');
    expect(mod.safeInternalPath('//evil.example.com')).toBe('/dashboard');
    expect(mod.safeInternalPath(null)).toBe('/dashboard');
    expect(mod.safeInternalPath('', '/login')).toBe('/login');
  });

  it('remembers the destination across the Google round trip and clears it', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
    const mod = await loadModule(CONFIGURED);

    await mod.startGoogleSignIn('/wallet');
    expect(mod.takeReturnTo()).toBe('/wallet');
    // Taken once: a later visit cannot resurrect an old destination.
    expect(mod.takeReturnTo()).toBe('/dashboard');
  });

  it('falls back to the dashboard when nothing was remembered', async () => {
    const mod = await loadModule();
    expect(mod.takeReturnTo()).toBe('/dashboard');
  });
});

describe('redirect errors', () => {
  it('explains a cancelled consent screen', async () => {
    const mod = await loadModule();
    expect(mod.readOAuthRedirectError('?error=access_denied&error_code=otp_expired')).toMatch(
      /cancelled/i,
    );
  });

  it('passes a short provider description through and ignores a missing error', async () => {
    const mod = await loadModule();
    expect(mod.readOAuthRedirectError('?error=server_error&error_description=Provider%20is%20down')).toBe(
      'Provider is down',
    );
    expect(mod.readOAuthRedirectError('?code=abc')).toBeNull();
    expect(mod.readOAuthRedirectError('')).toBeNull();
  });
});

describe('sessions', () => {
  it('returns the session created by the redirect back', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
    const mod = await loadModule(CONFIGURED);

    await expect(mod.readSupabaseSession()).resolves.toMatchObject({ access_token: 'token-1' });
  });

  it('refuses to invent a session when none came back', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const mod = await loadModule(CONFIGURED);

    await expect(mod.readSupabaseSession()).rejects.toThrow(/did not return a sign-in session/i);
  });

  it('clears the Supabase token locally after the exchange', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signOut.mockResolvedValue({ error: null });
    const mod = await loadModule(CONFIGURED);

    await mod.clearSupabaseSession();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('survives a storage failure while clearing', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signOut.mockRejectedValue(new Error('storage unavailable'));
    const mod = await loadModule(CONFIGURED);

    await expect(mod.clearSupabaseSession()).resolves.toBeUndefined();
  });
});

describe('provider failures', () => {
  it('reports an unstarted redirect instead of pretending to be signed in', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signInWithOAuth.mockResolvedValue({ error: { message: 'Provider is not enabled' } });
    const mod = await loadModule(CONFIGURED);

    await expect(mod.startGoogleSignIn()).rejects.toThrow(/not enabled/i);
  });

  it('reports a rejected redirect URL in plain language', async () => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithOAuth: mocks.signInWithOAuth, getSession: mocks.getSession, signOut: mocks.signOut },
    });
    mocks.signInWithOAuth.mockResolvedValue({
      error: { message: 'redirect_uri is not allowed' },
    });
    const mod = await loadModule(CONFIGURED);

    await expect(mod.startGoogleSignIn()).rejects.toThrow(/not allowed as a sign-in redirect/i);
  });
});
