import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Battery,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import EmptyState from '../components/ui/EmptyState';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/api';
import type { WalletTransaction } from '../types';
import { formatDate, formatPrice } from '../utils/helpers';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: Calendar },
  { id: 'methods', label: 'Payment methods', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]['id'];

const inputClass =
  'h-11 w-full rounded-control border border-line bg-surface-muted px-3.5 text-sm text-ink ' +
  'placeholder:text-ink-subtle transition-colors hover:border-line-strong focus:border-brand ' +
  'focus:outline-none focus:ring-2 focus:ring-brand/25';

const signedAmount = (transaction: WalletTransaction) =>
  `${transaction.amount > 0 ? '+' : '−'}${formatPrice(Math.abs(transaction.amount), 'USD')}`;

const TransactionRow: React.FC<{ transaction: WalletTransaction; showBalance?: boolean }> = ({
  transaction,
  showBalance = false,
}) => {
  const positive = transaction.amount > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownLeft;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-control ${
            positive ? 'bg-success-soft text-success-ink' : 'bg-surface-muted text-ink-muted'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{transaction.description}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
            <span>{formatDate(transaction.createdAt, 'datetime')}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{transaction.type}</span>
            {showBalance && (
              <>
                <span aria-hidden="true">·</span>
                <span>balance after {formatPrice(transaction.balanceAfter, 'USD')}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${positive ? 'text-success-ink' : 'text-ink'}`}>
          {signedAmount(transaction)}
        </p>
        {transaction.simulated && (
          <p className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-warning-ink">
            Simulated
          </p>
        )}
      </div>
    </li>
  );
};

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('25');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => userService.getWallet(),
    enabled: Boolean(user),
  });

  const ledgerQuery = useQuery({
    queryKey: ['wallet', 'transactions', page],
    queryFn: () => userService.getTransactions(page, 20),
    enabled: Boolean(user) && activeTab === 'transactions',
  });

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 30],
    queryFn: () => userService.getAnalytics(30),
    enabled: Boolean(user),
  });

  const wallet = walletQuery.data?.wallet;
  const recent = walletQuery.data?.transactions ?? [];
  const ledger = ledgerQuery.data?.transactions ?? recent;
  const analytics = analyticsQuery.data;

  const creditsAdded = useMemo(
    () =>
      recent
        .filter((transaction) => transaction.type === 'topup')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [recent],
  );

  const averageCostPerKwh = useMemo(() => {
    if (!analytics || analytics.totalEnergyConsumed <= 0) return null;
    return analytics.totalCost / analytics.totalEnergyConsumed;
  }, [analytics]);

  const filteredLedger = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ledger.filter((transaction) => {
      if (typeFilter && transaction.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        transaction.description.toLowerCase().includes(needle) ||
        transaction.type.toLowerCase().includes(needle)
      );
    });
  }, [ledger, search, typeFilter]);

  const refreshWallet = async () => {
    await queryClient.invalidateQueries({ queryKey: ['wallet'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  const submitTopup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setIsToppingUp(true);
    try {
      await userService.topUp(Math.round(amount * 100));
      await refreshWallet();
      setShowTopup(false);
      setMessage(
        `${formatPrice(amount)} was added to your simulated wallet. No card was charged.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The top-up could not be saved.');
    } finally {
      setIsToppingUp(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Description', 'Amount', 'Balance after', 'Simulated'],
      ...ledger.map((transaction) => [
        transaction.createdAt,
        transaction.type,
        transaction.description,
        transaction.amount.toFixed(2),
        transaction.balanceAfter.toFixed(2),
        String(transaction.simulated),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'afterglow-wallet-transactions.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (walletQuery.isPending) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <RowsSkeleton rows={6} />
      </div>
    );
  }

  if (walletQuery.isError || !wallet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div
          role="alert"
          className="rounded-panel border border-error/30 bg-error-soft p-6 text-sm text-error-ink"
        >
          <p className="font-semibold">We could not load your wallet.</p>
          <p className="mt-1">
            {walletQuery.error instanceof Error
              ? walletQuery.error.message
              : 'The wallet service did not respond.'}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => walletQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Charging spend · 30 days',
      value: formatPrice(analytics?.totalCost ?? 0),
      hint: 'From completed simulated sessions.',
      icon: Zap,
    },
    {
      label: 'Energy · 30 days',
      value: `${(analytics?.totalEnergyConsumed ?? 0).toLocaleString()} kWh`,
      hint: 'Estimated, not metered.',
      icon: Battery,
    },
    {
      label: 'Credits added',
      value: formatPrice(creditsAdded),
      hint: 'Top-ups in the latest 20 ledger entries.',
      icon: ArrowUpRight,
    },
    {
      label: 'Average cost',
      value: averageCostPerKwh === null ? '—' : `${formatPrice(averageCostPerKwh)}/kWh`,
      hint: 'Spend divided by estimated energy.',
      icon: Wallet,
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Account"
        title="Your simulated wallet"
        description="The balance and ledger are stored with your Afterglow account. They hold no real money and no card details are collected."
      />

      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Wallet' }]} />

        {message && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm text-success-ink"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-card border border-error/30 bg-error-soft px-4 py-3 text-sm text-error-ink"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ev-label">Available balance</p>
                <p className="ev-figure mt-2 text-[2.4rem] leading-none text-ink">
                  {showBalance ? formatPrice(wallet.balance, wallet.currency) : '••••••'}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                  <Badge tone="warning" dot>
                    Simulated funds
                  </Badge>
                  <span>
                    Updated {formatDate(wallet.updatedAt, 'datetime')} · {wallet.currency}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBalance((visible) => !visible)}
                aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                className="rounded-control border border-line p-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                {showBalance ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setShowTopup((open) => !open);
                  setError('');
                  setMessage('');
                }}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add funds
              </Button>
              <Button
                variant="ghost"
                onClick={exportCsv}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export ledger
              </Button>
            </div>

            {showTopup && (
              <form
                onSubmit={submitTopup}
                className="mt-4 rounded-card border border-line bg-surface-muted p-4"
              >
                <h2 className="ev-card-title text-ink">Simulated top-up</h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  This credits the demo ledger directly. No payment gateway is contacted and no card
                  is charged.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[10, 25, 50, 100].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTopupAmount(String(amount))}
                      aria-pressed={topupAmount === String(amount)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        topupAmount === String(amount)
                          ? 'border-brand bg-brand-soft text-brand-soft-ink'
                          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[10rem] flex-1">
                    <label
                      htmlFor="topup-amount"
                      className="mb-1.5 block text-sm font-medium text-ink"
                    >
                      Amount (USD)
                    </label>
                    <input
                      id="topup-amount"
                      inputMode="decimal"
                      value={topupAmount}
                      onChange={(event) => setTopupAmount(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <Button type="submit" isLoading={isToppingUp}>
                    Add simulated funds
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowTopup(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="ev-card-title text-ink">How this wallet works</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-muted">
              <li className="flex gap-2">
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
                Every balance and ledger entry belongs to your signed-in account.
              </li>
              <li className="flex gap-2">
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
                Ending a simulated charging session debits the ledger; no real money moves.
              </li>
              <li className="flex gap-2">
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
                Card numbers, CVVs and bank credentials are never requested or stored.
              </li>
            </ul>
            <p className="mt-3 text-xs text-ink-subtle">
              {walletQuery.data?.notice ??
                'This is a simulated demo wallet. It holds no real money.'}
            </p>
          </section>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-ink-muted">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-brand" aria-hidden="true" />
              </div>
              <p className="ev-figure mt-2 text-xl text-ink">{stat.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{stat.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-1 rounded-control border border-line bg-surface p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
              }}
              aria-pressed={activeTab === tab.id}
              className={`flex items-center gap-1.5 rounded-[7px] px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface-muted text-brand shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
          {activeTab === 'overview' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="ev-title text-ink">Recent activity</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    The latest entries in your stored simulated ledger.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>
                  View all transactions
                </Button>
              </div>

              {recent.length === 0 ? (
                <EmptyState
                  className="mt-4"
                  icon={Wallet}
                  title="No wallet activity yet"
                  description="Add simulated funds or complete a simulated charging session to create the first ledger entry."
                  action={<Button onClick={() => setShowTopup(true)}>Add funds</Button>}
                />
              ) : (
                <ul className="mt-4 divide-y divide-line rounded-card border border-line">
                  {recent.slice(0, 5).map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="ev-title text-ink">Transaction history</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {ledgerQuery.data?.total ?? ledger.length} stored ledger entries.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportCsv}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Export CSV
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <label htmlFor="transaction-search" className="sr-only">
                    Search transactions
                  </label>
                  <input
                    id="transaction-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search descriptions"
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <div className="sm:w-48">
                  <label htmlFor="transaction-type" className="sr-only">
                    Filter by transaction type
                  </label>
                  <select
                    id="transaction-type"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">All types</option>
                    <option value="charge">Charging</option>
                    <option value="topup">Top-ups</option>
                    <option value="refund">Refunds</option>
                  </select>
                </div>
              </div>

              {ledgerQuery.isPending ? (
                <RowsSkeleton rows={4} className="mt-4" />
              ) : ledgerQuery.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-control border border-error/30 bg-error-soft px-4 py-3 text-sm text-error-ink"
                >
                  <p>Could not load the ledger.</p>
                  <button
                    type="button"
                    onClick={() => ledgerQuery.refetch()}
                    className="mt-1 font-semibold underline"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredLedger.length === 0 ? (
                <p className="mt-4 rounded-control border border-dashed border-line bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">
                  No transactions match this filter.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line rounded-card border border-line">
                  {filteredLedger.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} showBalance />
                  ))}
                </ul>
              )}

              {ledgerQuery.data?.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="ghost" onClick={() => setPage((current) => current + 1)}>
                    Load more transactions
                  </Button>
                </div>
              )}
              {page > 1 && (
                <div className="mt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous page
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'methods' && (
            <div>
              <h2 className="ev-title text-ink">Payment methods</h2>
              <div className="mt-3 flex items-start gap-3 rounded-card border border-line bg-surface-muted p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div className="text-sm leading-relaxed text-ink-muted">
                  <p className="font-semibold text-ink">No payment methods are stored</p>
                  <p className="mt-1">
                    Afterglow does not collect card numbers, CVVs or bank credentials. Top-ups are
                    simulated ledger credits, so there is nothing to add or remove here.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setShowTopup(true)}>
                      Add simulated funds
                    </Button>
                    <ButtonLink to="/membership" variant="ghost" size="sm">
                      Compare membership plans
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="ev-title text-ink">Wallet settings</h2>
              <div className="mt-3 rounded-card border border-line bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">
                <p className="font-semibold text-ink">No automatic charging or billing</p>
                <p className="mt-1">
                  Auto top-up, spending limits and transaction PINs are not implemented because no
                  payment provider is connected. Notification preferences live with your profile.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink to="/profile" size="sm" variant="secondary">
                    Open profile preferences
                  </ButtonLink>
                  <ButtonLink to="/membership" size="sm" variant="ghost">
                    Membership details
                  </ButtonLink>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
          All wallet and charging figures are simulated. Need the full picture?{' '}
          <Link to="/dashboard" className="font-medium text-ink underline underline-offset-2">
            Open analytics
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default WalletPage;
