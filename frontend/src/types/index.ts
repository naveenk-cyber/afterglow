// Core Types
export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  /** City is optional because older API payloads only carried a full address. */
  city?: string;
  postcode?: string;
  operator?: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  distance?: number;
  amenities: string[];
  connectorTypes: ConnectorType[];
  chargingSpeed: ChargingSpeed;
  pricing: Pricing;
  availability: StationAvailability;
  images: string[];
  operatingHours: OperatingHours;
  hostType: 'Tesla' | 'ChargePoint' | 'EVgo' | 'Electrify America' | 'Other';
  /** `sample` marks bundled demo data, so the UI can label it honestly. */
  dataSource?: 'database' | 'sample';
  lastSyncedAt?: string;
}

export interface ConnectorType {
  id?: string;
  type: 'J1772' | 'CCS' | 'CHAdeMO' | 'Tesla' | 'Type 2';
  maxPower: number; // in kW
  available: boolean;
  count: number;
  /** Exact free connectors for this type, when the feed reports it. */
  availableCount?: number;
}

export type ChargingSpeed = 'Level 1' | 'Level 2' | 'DC Fast' | 'Supercharger';

export interface Pricing {
  perKwh?: number;
  perMinute?: number;
  sessionFee?: number;
  currency: string;
}

export interface StationAvailability {
  status: 'Available' | 'Busy' | 'Out of Service' | 'Coming Soon';
  availableConnectors: number;
  totalConnectors: number;
  estimatedWaitTime?: number; // in minutes
}

export interface OperatingHours {
  isOpen24Hours: boolean;
  schedule?: {
    [key: string]: { // day of week
      open: string;
      close: string;
    };
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string | null;
  vehicles: Vehicle[];
  preferences: UserPreferences;
  membershipLevel: 'Free' | 'Premium' | 'Elite';
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  batteryCapacity: number; // in kWh
  connectorTypes: string[];
  estimatedRange: number; // in miles/km
  isDefault: boolean;
}

export interface UserPreferences {
  units: 'metric' | 'imperial';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  paymentMethod?: PaymentMethod;
}

// Booking Types
export interface Booking {
  id: string;
  userId: string;
  stationId: string;
  station: ChargingStation;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  connectorType: string;
  /** API statuses are lower-case; the UI maps them to display labels. */
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  totalCost: number;
  currency?: string;
  /** True for reservations that never touch real charging hardware. */
  simulated?: boolean;
  energyDelivered?: number; // in kWh
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

// Search Types
export type SearchSort = 'distance' | 'price' | 'rating' | 'speed' | 'availability' | 'name';

export interface SearchFilters {
  /** Free-text query matched against name, address, city and operator. */
  query?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in miles/km
  };
  chargingSpeed?: ChargingSpeed[];
  connectorTypes?: string[];
  amenities?: string[];
  operators?: string[];
  availability?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  hostTypes?: string[];
  sort?: SearchSort;
}

export interface SearchResult {
  stations: ChargingStation[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** `demo` means the API was unreachable and bundled sample data was used. */
  source?: 'database' | 'demo';
}

export interface FilterMeta {
  operators: string[];
  connectorTypes: string[];
  chargingSpeeds: string[];
  amenities: string[];
  priceRange: { min: number; max: number };
}

// Analytics Types
export interface UserAnalytics {
  totalSessions: number;
  totalEnergyConsumed: number; // in kWh
  totalCost: number;
  carbonFootprintSaved: number; // in kg CO2
  favoriteStations: ChargingStation[];
  monthlyUsage: MonthlyUsage[];
  /** Extended fields returned by GET /users/analytics?days=. */
  rangeDays?: number;
  rangeStart?: string;
  rangeEnd?: string;
  averageDurationMinutes?: number;
  sessionsPerWeek?: number;
  totalBookings?: number;
  previousPeriod?: AnalyticsPeriod;
  dailyUsage?: DailyUsage[];
  connectorUsage?: ConnectorUsage[];
  recentSessions?: ChargingSession[];
  upcomingBookings?: Booking[];
}

export interface MonthlyUsage {
  month: string;
  sessions: number;
  energyConsumed: number;
  cost: number;
}

export interface DailyUsage {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  sessions: number;
  energyConsumed: number;
  cost: number;
}

export interface ConnectorUsage {
  label: string;
  value: number;
}

export interface AnalyticsPeriod {
  totalSessions: number;
  totalEnergyConsumed: number;
  totalCost: number;
  averageDurationMinutes: number;
  sessionsPerWeek: number;
}

export interface ChargingSession {
  id: string;
  bookingId: string | null;
  stationId: string;
  station: ChargingStation | null;
  connectorType: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  status: 'active' | 'completed';
  energyKwh: number;
  cost: number;
  currency: string;
  simulated: boolean;
  operatorConfirmed: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  balanceMinor: number;
  balance: number;
  currency: string;
  simulated: boolean;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'topup' | 'charge' | 'refund' | string;
  amount: number;
  balanceAfter: number;
  description: string;
  reference: string | null;
  simulated: boolean;
  createdAt: string;
}

// Review Types
export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  stationId: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupForm {
  /** Either a single display name or the split fields used by the form. */
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
  newsletter?: boolean;
  agreeToTerms: boolean;
}

export interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// Map Types
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCenter {
  latitude: number;
  longitude: number;
  zoom: number;
}