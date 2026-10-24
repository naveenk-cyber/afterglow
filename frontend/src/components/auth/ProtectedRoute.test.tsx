import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { makeUser, renderWithProviders } from '../../test/renderWithProviders';
import ProtectedRoute from './ProtectedRoute';
import { ApiError, authService, tokenStore } from '../../services/api';
import { STORAGE_KEYS } from '../../utils/constants';

/** A tiny route table so redirects can be asserted without the whole app. */
function renderGuard() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<h1>Sign in</h1>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <h1>Driver dashboard</h1>
          </ProtectedRoute>
        }
      />
    </Routes>,
    { route: '/dashboard', withAuth: true },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.clear();
});

describe('ProtectedRoute', () => {
  it('redirects to the login page when there is no stored session', async () => {
    renderGuard();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Driver dashboard')).not.toBeInTheDocument();
  });

  it('renders the protected page for a valid stored session', async () => {
    tokenStore.set('valid-token');
    vi.spyOn(authService, 'me').mockResolvedValue(makeUser({ name: 'Ada Lovelace' }));

    renderGuard();
    expect(await screen.findByRole('heading', { name: 'Driver dashboard' })).toBeInTheDocument();
    expect(tokenStore.get()).toBe('valid-token');
  });

  it('drops an expired session and asks the visitor to sign in again', async () => {
    tokenStore.set('expired-token');
    vi.spyOn(authService, 'me').mockRejectedValue(
      new ApiError('Session expired', 'UNAUTHORIZED', 401),
    );

    renderGuard();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
  });

  it('keeps the stored token when the API is simply unreachable', async () => {
    tokenStore.set('offline-token');
    vi.spyOn(authService, 'me').mockRejectedValue(
      new ApiError('Could not reach the Afterglow API.', 'NETWORK_ERROR', 0),
    );

    renderGuard();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    // A network blip must not log the driver out.
    expect(tokenStore.get()).toBe('offline-token');
  });
});
