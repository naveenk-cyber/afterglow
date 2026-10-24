import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from '../context/ThemeContext';
import type { User } from '../types';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history entry (use it to test route-specific behaviour). */
  route?: string;
  /**
   * Wrap the tree in the real AuthProvider. Its session restore runs against
   * the API client, so tests that use it should stub `authService`.
   */
  withAuth?: boolean;
}

/** Test QueryClient: no retries and no caching between tests. */
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** Render a component with the providers every page expects. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', withAuth = false, ...options }: RenderWithProvidersOptions = {},
) {
  const queryClient = makeTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const tree = <ThemeProvider>{children}</ThemeProvider>;

    return (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>
          {withAuth ? <AuthProvider>{tree}</AuthProvider> : tree}
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

/** Build a complete `User` object without repeating every field in each test. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-1',
    email: 'test@afterglow.test',
    name: 'Test Driver',
    avatar: null,
    vehicles: [],
    membershipLevel: 'Free',
    preferences: {
      units: 'imperial',
      language: 'en',
      notifications: { email: true, push: false, sms: false },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
