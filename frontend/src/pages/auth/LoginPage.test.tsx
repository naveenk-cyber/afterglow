import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import LoginPage from './LoginPage';
import { ApiError, authService, tokenStore } from '../../services/api';

/** Resolve the request URL that fetch was asked for, in call order. */
function calledUrls(): string[] {
  const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
  return mock.mock.calls.map((call) => String(call[0]));
}

function sessionResponse(user: { id: string; name: string; email: string } = {
  id: 'u1',
  name: 'Demo Driver',
  email: 'demo@afterglow.test',
}) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        success: true,
        data: { user, token: 'session-token', expiresAt: '2027-01-01T00:00:00.000Z' },
      }),
  } as unknown as Response);
}

function errorResponse(status: number, code: string, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: async () => JSON.stringify({ success: false, data: null, error: { code, message } }),
  } as unknown as Response);
}

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<h1>Driver dashboard</h1>} />
      <Route path="/signup" element={<h1>Create account</h1>} />
    </Routes>,
    { route: '/login', withAuth: true },
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  tokenStore.clear();
  // There is no cookie session to restore in these tests; the API rejects me().
  vi.spyOn(authService, 'me').mockRejectedValue(
    new ApiError('No session', 'UNAUTHORIZED', 401),
  );
});

describe('LoginPage', () => {
  it('shows the sign-in form with accessible fields', async () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('validates the email before calling the API', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Demo1234!');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in, stores the session token and forwards to the dashboard', async () => {
    fetchMock.mockImplementationOnce(() => sessionResponse());
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'demo@afterglow.test');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Demo1234!');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Driver dashboard' })).toBeInTheDocument();
    expect(calledUrls()[0]).toContain('/auth/login');
    expect(tokenStore.get()).toBe('session-token');
  });

  it('surfaces an invalid-credentials error from the API', async () => {
    fetchMock.mockImplementationOnce(() =>
      errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'demo@afterglow.test');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(tokenStore.get()).toBeNull();
  });

  it('fills and submits the seeded demo credentials from the hint panel', async () => {
    fetchMock.mockImplementationOnce(() => sessionResponse());
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: /use the demo account/i }));
    expect(screen.getByText('demo@afterglow.test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /sign in with demo account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    ) as { email: string; password: string };
    expect(body).toMatchObject({ email: 'demo@afterglow.test', password: 'Demo1234!' });
  });
});
