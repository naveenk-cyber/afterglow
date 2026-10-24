import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authService, bookingService, stationService, tokenStore } from './api';
import { STORAGE_KEYS } from '../utils/constants';

/** Build a fetch Response stub without depending on a real server. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function envelope<T>(data: T) {
  return { success: true, data };
}

function errorEnvelope(code: string, message: string) {
  return { success: false, data: null, error: { code, message } };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

describe('request handling', () => {
  it('unwraps the success envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ user: { id: 'u1', name: 'Ada' } })));
    await expect(authService.me()).resolves.toMatchObject({ id: 'u1', name: 'Ada' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('attaches the stored session token as a Bearer header', async () => {
    tokenStore.set('tok-123');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(envelope({ user: { id: 'u1', name: 'Test' }, token: 'x', expiresAt: 'y' })),
    );
    await authService.me();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' });
  });

  it('throws an ApiError carrying the API error code and status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorEnvelope('VALIDATION_ERROR', 'Bad input'), 422));
    const error = await authService.login({ email: 'a@b.co', password: 'nope' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Bad input');
    expect(error.status).toBe(422);
  });

  it('clears the in-memory token when the session is rejected with 401', async () => {
    tokenStore.set('expired-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(errorEnvelope('UNAUTHORIZED', 'Session expired'), 401));
    await authService.me().catch(() => undefined);
    // The HttpOnly cookie is cleared by the API; the shim holds no JWT either.
    expect(tokenStore.get()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
  });

  it('reports an unreachable API as a network error (status 0)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = (await authService.me().catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toContain('Could not reach the Afterglow API');
  });
});

describe('auth service', () => {
  it('stores the token returned by login', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        envelope({ user: { id: 'u1', name: 'Test' }, token: 'session-token', expiresAt: '2026-01-01' }),
      ),
    );
    const result = await authService.login({ email: 'demo@afterglow.test', password: 'Demo1234!' });
    expect(result.token).toBe('session-token');
    expect(tokenStore.get()).toBe('session-token');
  });

  it('clears the local session on logout even when the API call fails', async () => {
    tokenStore.set('session-token');
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await authService.logout();
    expect(tokenStore.get()).toBeNull();
  });
});

describe('demo fallback', () => {
  it('serves labelled sample stations when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await stationService.searchStations({}, 1, 5);
    expect(result.source).toBe('demo');
    expect(result.stations.length).toBeGreaterThan(0);
  });

  it('does not hide real API errors behind sample data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorEnvelope('INTERNAL_ERROR', 'Server exploded'), 500));
    const error = (await stationService.searchStations({}, 1, 5).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

describe('query serialisation', () => {
  it('maps search filters onto the documented query parameters', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(envelope({ stations: [], total: 0, page: 1, limit: 12, hasMore: false })),
    );
    await stationService.searchStations(
      {
        query: 'austin',
        connectorTypes: ['CCS', 'CHAdeMO'],
        availability: true,
        rating: 4,
        sort: 'rating',
      },
      2,
      12,
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('q=austin');
    expect(url).toContain('connectorType=CCS&connectorType=CHAdeMO');
    expect(url).toContain('available=true');
    expect(url).toContain('minRating=4');
    expect(url).toContain('sort=rating');
  });

  it('posts booking payloads as JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ booking: { id: 'b1' }, note: 'demo' })));
    await bookingService.createBooking({
      stationId: 'st-1',
      connectorType: 'CCS',
      startTime: '2026-11-01T10:00:00.000Z',
      durationMinutes: 60,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ stationId: 'st-1' });
  });
});
