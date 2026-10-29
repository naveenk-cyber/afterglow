import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, makeUser } from '../../test/renderWithProviders';
import GoogleCallbackPage from './GoogleCallbackPage';
import { ApiError, authService } from '../../services/api';

const mocks = vi.hoisted(() => ({
  readSupabaseSession: vi.fn(),
  clearSupabaseSession: vi.fn(),
}));

// The Supabase SDK is never constructed in jsdom; the two calls this page makes
// are stubbed while the URL parsing and destination helpers stay real.
vi.mock('../../services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabase')>();
  return {
    ...actual,
    readSupabaseSession: mocks.readSupabaseSession,
    clearSupabaseSession: mocks.clearSupabaseSession,
  };
});

function renderCallback(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/auth/callback" element={<GoogleCallbackPage />} />
      <Route path="/dashboard" element={<h1>Driver dashboard</h1>} />
      <Route path="/wallet" element={<h1>Wallet</h1>} />
      <Route path="/search" element={<h1>Station search</h1>} />
      <Route path="/login" element={<h1>Sign in page</h1>} />
    </Routes>,
    { route, withAuth: true },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.clearSupabaseSession.mockResolvedValue(undefined);
  mocks.readSupabaseSession.mockResolvedValue({ access_token: 'supabase-access-token' });
  // No cookie session to restore when the callback lands.
  vi.spyOn(authService, 'me').mockRejectedValue(new ApiError('No session', 'UNAUTHORIZED', 401));
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('GoogleCallbackPage', () => {
  it('exchanges the Supabase token for an Afterglow session and opens the dashboard', async () => {
    const loginWithSupabase = vi
      .spyOn(authService, 'loginWithSupabase')
      .mockResolvedValue({ user: makeUser(), token: 'api-session-token' });

    renderCallback('/auth/callback?code=auth-code-1');

    expect(await screen.findByRole('heading', { name: 'Finishing sign-in' })).toBeInTheDocument();

    // The dashboard only renders once the provider has a signed-in user, so
    // reaching it proves the session was established, not merely requested.
    expect(await screen.findByRole('heading', { name: 'Driver dashboard' })).toBeInTheDocument();
    // The Supabase access token — not an email or a name — is what the API is
    // asked to verify. (Token persistence itself is covered in api.test.ts.)
    expect(loginWithSupabase).toHaveBeenCalledWith('supabase-access-token');
    // The third-party copy of the session is dropped afterwards.
    expect(mocks.clearSupabaseSession).toHaveBeenCalled();
  });

  it('returns the driver to the page that started the sign-in', async () => {
    vi.spyOn(authService, 'loginWithSupabase').mockResolvedValue({ user: makeUser() });
    sessionStorage.setItem('afterglow:oauth:returnTo', '/search?connector=CCS');

    renderCallback('/auth/callback?code=auth-code-2');

    expect(await screen.findByRole('heading', { name: 'Station search' })).toBeInTheDocument();
  });

  it('reports a cancelled Google consent screen without calling the API', async () => {
    const loginWithSupabase = vi.spyOn(authService, 'loginWithSupabase');

    renderCallback('/auth/callback?error=access_denied&error_code=access_denied');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/cancelled/i);
    expect(loginWithSupabase).not.toHaveBeenCalled();
    expect(mocks.clearSupabaseSession).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
  });

  it('surfaces an API rejection instead of leaving the spinner running', async () => {
    vi.spyOn(authService, 'loginWithSupabase').mockRejectedValue(
      new ApiError('That Google sign-in could not be verified.', 'UNAUTHORIZED', 401),
    );

    renderCallback('/auth/callback?code=auth-code-3');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That Google sign-in could not be verified.');
    expect(mocks.clearSupabaseSession).toHaveBeenCalled();
  });

  it('explains itself when opened without a Google response', async () => {
    renderCallback('/auth/callback');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Start one from the sign-in page/i);
    expect(mocks.readSupabaseSession).not.toHaveBeenCalled();
  });
});
