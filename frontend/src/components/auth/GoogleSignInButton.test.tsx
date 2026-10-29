import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import GoogleSignInButton from './GoogleSignInButton';

const mocks = vi.hoisted(() => ({
  loginWithGoogle: vi.fn(),
  googleSignInEnabled: true,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    googleSignInEnabled: mocks.googleSignInEnabled,
    loginWithGoogle: mocks.loginWithGoogle,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  mocks.googleSignInEnabled = true;
});

describe('GoogleSignInButton', () => {
  it('is hidden entirely when the build is not configured for Google', () => {
    mocks.googleSignInEnabled = false;
    const { container } = renderWithProviders(<GoogleSignInButton />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('starts the Google flow and forwards the intended destination', async () => {
    mocks.loginWithGoogle.mockResolvedValue(undefined);
    renderWithProviders(<GoogleSignInButton returnTo="/wallet" />);

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(mocks.loginWithGoogle).toHaveBeenCalledWith('/wallet');
    // The browser is leaving for Google, so the button keeps reporting progress.
    expect(screen.getByRole('button', { name: 'Opening Google…' })).toBeDisabled();
  });

  it('explains a redirect that could not be started and stays usable', async () => {
    mocks.loginWithGoogle.mockRejectedValue(new Error('Google sign-in is not enabled for this project yet.'));
    renderWithProviders(<GoogleSignInButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google sign-in is not enabled for this project yet.',
    );
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });

  it('lets the sign-up page ask for a sign-up', () => {
    renderWithProviders(<GoogleSignInButton label="Sign up with Google" />);

    expect(screen.getByRole('button', { name: 'Sign up with Google' })).toBeInTheDocument();
  });
});
