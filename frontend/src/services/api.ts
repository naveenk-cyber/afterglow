import type {
  Booking,
  ChargingSession,
  ChargingStation,
  FilterMeta,
  LoginForm,
  Review,
  SearchFilters,
  SearchResult,
  SignupForm,
  User,
  UserAnalytics,
  Vehicle,
  Wallet,
  WalletTransaction,
} from '../types';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import { SAMPLE_STATIONS, searchSampleStations, getSampleStation } from '../data/sampleStations';
import { calculateDistance } from '../utils/helpers';

/**
 * Browser sessions live in an HttpOnly cookie set by the API, so JavaScript
 * cannot read or persist the JWT. `tokenStore` is an in-memory compatibility
 * shim for API-style callers and unit tests; it deliberately does not touch
 * localStorage, so a reload falls back to the cookie.
 */
let memoryToken: string | null = null;

export const tokenStore = {
  get: () => memoryToken,
  set: (token: string) => {
    memoryToken = token;
  },
  clear: () => {
    memoryToken = null;
  },
};

export class ApiError extends Error {
  code: string;
  status: number;
  isNetworkError: boolean;
  details?: unknown;

  constructor(message: string, code = 'ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isNetworkError = status === 0 || code === 'NETWORK_ERROR';
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** AuthProvider registers this to drop local state when the cookie expires. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Do not run the global "session expired" handler on a 401.
   *
   * Used by the session probe: asking "is anyone signed in?" and being told
   * "no" is the normal signed-out path, not an expiry. Firing the handler
   * there cleared the whole query cache mid-flight, which left the landing
   * page's catalogue query stuck on its skeletons for signed-out visitors.
   */
  skipUnauthorizedHandler?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the Afterglow API. Check your connection and that the backend is running.',
      'NETWORK_ERROR',
      0,
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  const envelope = payload as
    | {
        success?: boolean;
        data?: T;
        message?: string;
        error?: { code?: string; message?: string; details?: unknown };
      }
    | null;

  if (!response.ok || !envelope?.success) {
    const message =
      envelope?.error?.message ||
      envelope?.message ||
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : `The request failed (HTTP ${response.status}).`);
    const code = envelope?.error?.code || (response.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR');

    if (response.status === 401) {
      tokenStore.clear();
      if (!options.skipUnauthorizedHandler) unauthorizedHandler?.();
    }
    throw new ApiError(message, code, response.status, envelope?.error?.details);
  }

  return envelope.data as T;
}

/** Remove credentials left behind by the old local-demo build. */
export function clearLegacySessionStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem('chargeease_user_data');
  } catch {
    // Storage can be unavailable in private mode; nothing to clean.
  }
}

export const authService = {
  async login(credentials: LoginForm): Promise<{ user: User; token?: string; expiresAt?: string }> {
    const data = await request<{ user: User; token?: string; expiresAt?: string }>('/auth/login', {
      method: 'POST',
      body: credentials,
    });
    if (data.token) tokenStore.set(data.token);
    return data;
  },

  /**
   * Exchange a Google identity (a Supabase access token) for an Afterglow
   * session. The API verifies the token with Supabase and replies with the
   * same HttpOnly cookie credentials as a password sign-in, so nothing else in
   * the app needs to know which method was used.
   */
  async loginWithSupabase(
    accessToken: string,
  ): Promise<{ user: User; token?: string; expiresAt?: string }> {
    const data = await request<{ user: User; token?: string; expiresAt?: string }>(
      '/auth/oauth/supabase',
      { method: 'POST', body: { accessToken } },
    );
    if (data.token) tokenStore.set(data.token);
    return data;
  },

  async signup(userData: SignupForm): Promise<{ user: User; token?: string; expiresAt?: string }> {
    const parts = (userData.firstName || userData.name || 'Afterglow Driver').trim().split(/\s+/);
    const firstName = parts[0] || 'Afterglow';
    const lastName = userData.lastName || parts.slice(1).join(' ') || 'Driver';

    const data = await request<{ user: User; token?: string; expiresAt?: string }>('/auth/signup', {
      method: 'POST',
      body: {
        firstName,
        lastName,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
        confirmPassword: userData.confirmPassword ?? userData.password,
        newsletter: userData.newsletter,
        rememberMe: true,
      },
    });
    if (data.token) tokenStore.set(data.token);
    return data;
  },

  async me(): Promise<User> {
    // A 401 here means "nobody is signed in", which is a valid answer rather
    // than an expiry — see RequestOptions.skipUnauthorizedHandler.
    const data = await request<{ user: User }>('/auth/me', { skipUnauthorizedHandler: true });
    return data.user;
  },

  async logout(): Promise<void> {
    try {
      await request<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch {
      // Revoked or expired sessions are still a successful local sign-out.
    } finally {
      tokenStore.clear();
    }
  },

  async forgotPassword(email: string): Promise<{ message: string; devResetUrl?: string }> {
    return request<{ message: string; devResetUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });
  },
};

export const userService = {
  async getProfile(): Promise<User> {
    const data = await request<{ user: User }>('/users/profile');
    return data.user;
  },

  async updateProfile(patch: Partial<User>): Promise<User> {
    const data = await request<{ user: User }>('/users/profile', {
      method: 'PUT',
      body: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
      },
    });
    return data.user;
  },

  async getVehicles(): Promise<Vehicle[]> {
    const data = await request<{ vehicles: Vehicle[] }>('/users/vehicles');
    return data.vehicles;
  },

  async createVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const data = await request<{ vehicle: Vehicle }>('/users/vehicles', {
      method: 'POST',
      body: vehicle,
    });
    return data.vehicle;
  },

  async updateVehicle(id: string, patch: Partial<Vehicle>): Promise<Vehicle> {
    const data = await request<{ vehicle: Vehicle }>(`/users/vehicles/${id}`, {
      method: 'PUT',
      body: patch,
    });
    return data.vehicle;
  },

  async deleteVehicle(id: string): Promise<void> {
    await request(`/users/vehicles/${id}`, { method: 'DELETE' });
  },

  async getFavorites(): Promise<ChargingStation[]> {
    const data = await request<{ stations: ChargingStation[] }>('/users/favorites');
    return data.stations;
  },

  async getAnalytics(days = 30): Promise<UserAnalytics> {
    const data = await request<{ analytics: UserAnalytics; notice: string }>(
      `/users/analytics?days=${days}`,
    );
    return data.analytics;
  },

  async getWallet(): Promise<{
    wallet: Wallet;
    transactions: WalletTransaction[];
    simulated: boolean;
    notice: string;
  }> {
    return request('/users/wallet');
  },

  async topUp(amountMinor: number): Promise<{
    wallet: Wallet;
    transaction: WalletTransaction;
    simulated: boolean;
    notice: string;
  }> {
    return request('/users/wallet/topup', { method: 'POST', body: { amountMinor } });
  },
  async getTransactions(page = 1, limit = 20): Promise<{
    transactions: WalletTransaction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return request(`/users/wallet/transactions?page=${page}&limit=${limit}`);
  },
};

function sampleFilterMeta(): FilterMeta {
  const connectors = new Set<string>();
  const speeds = new Set<string>();
  const amenities = new Set<string>();
  const operators = new Set<string>();
  let min = Infinity;
  let max = 0;

  for (const station of SAMPLE_STATIONS) {
    station.connectorTypes.forEach((connector) => connectors.add(connector.type));
    speeds.add(station.chargingSpeed);
    station.amenities.forEach((amenity) => amenities.add(amenity));
    if (station.operator) operators.add(station.operator);
    const price = station.pricing.perKwh;
    if (price != null) {
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
  }

  return {
    operators: [...operators].sort(),
    connectorTypes: [...connectors].sort(),
    chargingSpeeds: [...speeds].sort(),
    amenities: [...amenities].sort(),
    priceRange: { min: Number.isFinite(min) ? min : 0, max },
  };
}

export const stationService = {
  async searchStations(filters: SearchFilters, page = 1, limit = 12): Promise<SearchResult> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.query) params.append('q', filters.query);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.location) {
      params.append('lat', String(filters.location.latitude));
      params.append('lng', String(filters.location.longitude));
      params.append('radius', String(filters.location.radius));
    }
    filters.chargingSpeed?.forEach((speed) => params.append('chargingSpeed', speed));
    filters.connectorTypes?.forEach((type) => params.append('connectorType', type));
    filters.operators?.forEach((operator) => params.append('operator', operator));
    filters.amenities?.forEach((amenity) => params.append('amenity', amenity));
    if (filters.availability) params.append('available', 'true');
    if (filters.rating) params.append('minRating', String(filters.rating));
    if (filters.priceRange) {
      params.append('minPrice', String(filters.priceRange.min));
      params.append('maxPrice', String(filters.priceRange.max));
    }

    try {
      const result = await request<SearchResult>(`/stations?${params.toString()}`);
      return { ...result, source: result.source ?? 'database' };
    } catch (error) {
      // Only an unreachable API falls back to bundled sample data. A real HTTP
      // error (validation, server fault) is surfaced so the user can retry.
      if (!(error instanceof ApiError) || !error.isNetworkError) throw error;
      return searchSampleStations(filters, page, limit);
    }
  },

  async getStationById(
    id: string,
    origin?: { latitude: number; longitude: number },
  ): Promise<ChargingStation> {
    const params = new URLSearchParams();
    if (origin) {
      params.append('lat', String(origin.latitude));
      params.append('lng', String(origin.longitude));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    try {
      const data = await request<{ station: ChargingStation }>(`/stations/${id}${suffix}`);
      return { ...data.station, dataSource: data.station.dataSource ?? 'database' };
    } catch (error) {
      const sample = getSampleStation(id);
      if (sample && error instanceof ApiError && error.isNetworkError) {
        const distance = origin
          ? calculateDistance(origin.latitude, origin.longitude, sample.latitude, sample.longitude)
          : undefined;
        return { ...sample, distance };
      }
      throw error;
    }
  },

  async getReviews(
    stationId: string,
    page = 1,
    limit = 10,
  ): Promise<{ reviews: Review[]; total: number }> {
    try {
      return await request<{ reviews: Review[]; total: number }>(
        `/stations/${stationId}/reviews?page=${page}&limit=${limit}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError && getSampleStation(stationId)) {
        return { reviews: [], total: 0 };
      }
      throw error;
    }
  },

  async getStationReviews(stationId: string, page = 1, limit = 10) {
    return this.getReviews(stationId, page, limit);
  },

  async createReview(review: {
    stationId: string;
    rating: number;
    title: string;
    comment: string;
  }): Promise<Review> {
    const data = await request<{ review: Review }>(`/stations/${review.stationId}/reviews`, {
      method: 'POST',
      body: { rating: review.rating, title: review.title, comment: review.comment },
    });
    return data.review;
  },

  async getNearbyStations(lat: number, lng: number, radius = 25): Promise<ChargingStation[]> {
    const data = await request<{ stations: ChargingStation[] }>(
      `/stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    );
    return data.stations;
  },

  async getPopularStations(): Promise<ChargingStation[]> {
    return (await this.searchStations({ sort: 'rating' }, 1, 6)).stations;
  },

  async getTopRatedStations(): Promise<ChargingStation[]> {
    return (await this.searchStations({ sort: 'rating' }, 1, 6)).stations;
  },

  async getFilterMeta(): Promise<FilterMeta> {
    try {
      return await request<FilterMeta>('/stations/meta/filters');
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) return sampleFilterMeta();
      throw error;
    }
  },

  async getFavorites(): Promise<ChargingStation[]> {
    return userService.getFavorites();
  },

  async addFavorite(stationId: string): Promise<void> {
    await request(`/stations/${stationId}/favorite`, { method: 'POST' });
  },

  async removeFavorite(stationId: string): Promise<void> {
    await request(`/stations/${stationId}/favorite`, { method: 'DELETE' });
  },

  async addToFavorites(stationId: string): Promise<void> {
    return this.addFavorite(stationId);
  },

  async removeFromFavorites(stationId: string): Promise<void> {
    return this.removeFavorite(stationId);
  },

  async getFavoriteStations(): Promise<ChargingStation[]> {
    return this.getFavorites();
  },
};

export const bookingService = {
  async createBooking(bookingData: {
    stationId: string;
    connectorType: string;
    startTime: string;
    durationMinutes: number;
  }): Promise<Booking> {
    const data = await request<{ booking: Booking; note: string }>('/bookings', {
      method: 'POST',
      body: bookingData,
    });
    return data.booking;
  },

  async getBookings(
    status?: string,
    page = 1,
    limit = 10,
  ): Promise<{ bookings: Booking[]; total: number; page: number; limit: number; hasMore: boolean }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status && status !== 'all') params.append('status', status);
    return request(`/bookings?${params.toString()}`);
  },

  async getBookingById(id: string): Promise<Booking> {
    const data = await request<{ booking: Booking }>(`/bookings/${id}`);
    return data.booking;
  },

  async cancelBooking(id: string): Promise<Booking> {
    const data = await request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'POST' });
    return data.booking;
  },

  async startCharging(id: string): Promise<{ session: ChargingSession; note: string }> {
    return request(`/bookings/${id}/start`, { method: 'POST' });
  },

  async stopCharging(
    id: string,
  ): Promise<{ session: ChargingSession; chargingCost: number; note: string }> {
    return request(`/bookings/${id}/stop`, { method: 'POST' });
  },

  async getSession(id: string): Promise<ChargingSession> {
    const data = await request<{ session: ChargingSession }>(`/bookings/sessions/${id}`);
    return data.session;
  },

  async getHistory(page = 1, limit = 20): Promise<{
    sessions: ChargingSession[];
    total: number;
    page: number;
    limit: number;
  }> {
    return request(`/bookings/history?page=${page}&limit=${limit}`);
  },
};

export const reviewService = {
  async createReview(reviewData: {
    stationId: string;
    rating: number;
    title: string;
    comment: string;
  }): Promise<Review> {
    return stationService.createReview(reviewData);
  },
};

export default {
  auth: authService,
  user: userService,
  station: stationService,
  booking: bookingService,
  review: reviewService,
};
