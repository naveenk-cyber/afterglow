import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUser, renderWithProviders } from '../test/renderWithProviders';
import WalletPage from './WalletPage';
import { authService, tokenStore, userService } from '../services/api';
import type { UserAnalytics, WalletTransaction } from '../types';

const TOPUP: WalletTransaction = {
  id: 'tx-1',
  userId: 'user-test-1',
  type: 'topup',
  amount: 100,
  balanceAfter: 247.85,
  description: 'Simulated wallet top-up',
  reference: null,
  simulated: true,
  createdAt: '2026-10-20T10:00:00.000Z',
};

const CHARGE: WalletTransaction = {
  id: 'tx-2',
  userId: 'user-test-1',
  type: 'charge',
  amount: -25.5,
  balanceAfter: 147.85,
  description: 'Simulated charging session',
  reference: 'sess-1',
  simulated: true,
  createdAt: '2026-10-21T10:00:00.000Z',
};

const ANALYTICS: UserAnalytics = {
  totalSessions: 4,
  totalEnergyConsumed: 120,
  totalCost: 42,
  carbonFootprintSaved: 0,
  favoriteStations: [],
  monthlyUsage: [],
  rangeDays: 30,
};

function walletResponse() {
  return {
    wallet: {
      id: 'wallet-1',
      userId: 'user-test-1',
      balanceMinor: 24785,
      balance: 247.85,
      currency: 'USD',
      simulated: true,
      updatedAt: '2026-10-21T10:00:00.000Z',
    },
    transactions: [CHARGE, TOPUP],
    simulated: true,
    notice: 'This is a simulated demo wallet. It holds no real money.',
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.set('test-token');
  vi.spyOn(authService, 'me').mockResolvedValue(makeUser());
  vi.spyOn(userService, 'getWallet').mockResolvedValue(walletResponse());
  vi.spyOn(userService, 'getAnalytics').mockResolvedValue(ANALYTICS);
  vi.spyOn(userService, 'getTransactions').mockResolvedValue({
    transactions: [CHARGE, TOPUP],
    total: 2,
    page: 1,
    limit: 20,
    hasMore: false,
  });
});

describe('WalletPage — stored wallet and ledger', () => {
  it('renders the balance and transactions returned by the API', async () => {
    renderWithProviders(<WalletPage />, { route: '/wallet', withAuth: true });

    expect(await screen.findByText('$247.85')).toBeInTheDocument();
    expect(screen.getByText('Simulated wallet top-up')).toBeInTheDocument();
    expect(screen.getByText('Simulated charging session')).toBeInTheDocument();
    expect(screen.getByText('$42.00')).toBeInTheDocument();
  });

  it('posts a simulated top-up in minor units and confirms no card was charged', async () => {
    const topUp = vi.spyOn(userService, 'topUp').mockResolvedValue({
      wallet: walletResponse().wallet,
      transaction: TOPUP,
      simulated: true,
      notice: 'simulated',
    });

    renderWithProviders(<WalletPage />, { route: '/wallet', withAuth: true });
    await screen.findByText('$247.85');

    await userEvent.click(screen.getByRole('button', { name: 'Add funds' }));
    await userEvent.click(screen.getByRole('button', { name: '$10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add simulated funds' }));

    await waitFor(() => expect(topUp).toHaveBeenCalledWith(1000));
    expect(
      await screen.findByText('$10.00 was added to your simulated wallet. No card was charged.'),
    ).toBeInTheDocument();
  });

  it('explains that no payment method is stored', async () => {
    renderWithProviders(<WalletPage />, { route: '/wallet', withAuth: true });
    await screen.findByText('$247.85');

    await userEvent.click(screen.getByRole('button', { name: 'Payment methods' }));
    expect(screen.getByText('No payment methods are stored')).toBeInTheDocument();
  });
});
