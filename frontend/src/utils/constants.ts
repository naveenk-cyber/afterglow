// API Constants
//
// Default to a same-origin path. In development the Vite proxy forwards
// `/api` to the Express server; in production a reverse proxy does the same.
// The previous absolute `http://localhost:5000` default broke whenever
// `localhost` resolved to IPv6 while Express listened on IPv4, and it forced a
// cross-origin request even though the repo documents a proxy.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// App Constants
export const APP_NAME = 'Afterglow';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Find your nearest EV charging spot with ease';

// Charging Station Constants
export const CHARGING_SPEEDS = {
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  DC_FAST: 'DC Fast',
  SUPERCHARGER: 'Supercharger',
} as const;

export const CONNECTOR_TYPES = {
  J1772: 'J1772',
  CCS: 'CCS',
  CHADEMO: 'CHAdeMO',
  TESLA: 'Tesla',
  TYPE_2: 'Type 2',
} as const;

export const STATION_STATUS = {
  AVAILABLE: 'Available',
  BUSY: 'Busy',
  OUT_OF_SERVICE: 'Out of Service',
  COMING_SOON: 'Coming Soon',
} as const;

export const HOST_TYPES = [
  'Tesla',
  'ChargePoint',
  'EVgo',
  'Electrify America',
  'Shell Recharge',
  'BP Pulse',
  'Other',
];

// Common Amenities
export const AMENITIES = [
  'Restrooms',
  'Restaurant',
  'Shopping',
  'WiFi',
  'ATM',
  'Parking',
  '24/7 Access',
  'Covered Parking',
  'Hotel',
  'Grocery Store',
  'Gas Station',
  'EV Service',
];

// Map Constants
export const DEFAULT_MAP_CENTER = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 4,
};

export const MAP_STYLES = {
  DEFAULT: 'mapbox://styles/mapbox/streets-v11',
  SATELLITE: 'mapbox://styles/mapbox/satellite-v9',
  DARK: 'mapbox://styles/mapbox/dark-v10',
};

// Search Constants
export const SEARCH_RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100]; // in miles
export const DEFAULT_SEARCH_RADIUS = 25;
export const MAX_SEARCH_RESULTS = 100;

// Booking Constants
export const BOOKING_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const MINIMUM_BOOKING_DURATION = 15; // minutes
export const MAXIMUM_BOOKING_DURATION = 480; // 8 hours

// User Constants
export const MEMBERSHIP_LEVELS = {
  FREE: 'Free',
  PREMIUM: 'Premium',
  ELITE: 'Elite',
} as const;

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      'Basic station search',
      'Up to 5 bookings per month',
      'Community reviews',
      'Mobile app access',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 9.99,
    features: [
      'Unlimited bookings',
      'Advanced filtering',
      'Priority customer support',
      'Exclusive partner discounts',
      'Real-time availability',
      'Route planning',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 19.99,
    features: [
      'All Premium features',
      'Concierge booking service',
      'VIP charging locations',
      'Carbon footprint tracking',
      'Personal charging advisor',
      'Early access to new features',
    ],
  },
];

// Form Validation Constants
export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-()]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You need to log in to access this feature.',
  FORBIDDEN: 'You don\'t have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  GEOLOCATION_DENIED: 'Location access denied. Please enable location services.',
  GEOLOCATION_UNAVAILABLE: 'Location services are not available.',
  GEOLOCATION_TIMEOUT: 'Location request timed out.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  BOOKING_CREATED: 'Booking created successfully!',
  BOOKING_CANCELLED: 'Booking cancelled successfully.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  PAYMENT_SUCCESSFUL: 'Payment processed successfully.',
  REVIEW_SUBMITTED: 'Review submitted successfully.',
  ACCOUNT_CREATED: 'Account created successfully! Welcome to Afterglow.',
  PASSWORD_RESET: 'Password reset email sent successfully.',
};

// Theme Constants
export const THEME = {
  COLORS: {
    PRIMARY: '#FF6B35',
    PRIMARY_LIGHT: '#FF8A65',
    PRIMARY_DARK: '#E55722',
    SECONDARY: '#1F2937',
    SUCCESS: '#10B981',
    WARNING: '#F59E0B',
    ERROR: '#EF4444',
    INFO: '#3B82F6',
  },
  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px',
  },
};

// Date/Time Constants
export const DATE_FORMATS = {
  SHORT: 'MMM d',
  MEDIUM: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  TIME: 'h:mm a',
  DATETIME: 'MMM d, yyyy h:mm a',
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'chargeease_auth_token',
  REFRESH_TOKEN: 'chargeease_refresh_token',
  USER_PREFERENCES: 'chargeease_user_preferences',
  SEARCH_HISTORY: 'chargeease_search_history',
  FAVORITE_STATIONS: 'chargeease_favorite_stations',
  LAST_LOCATION: 'chargeease_last_location',
};

// URL Patterns
export const ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  STATION_DETAILS: '/station/:id',
  BOOKING: '/booking',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  BOOKINGS: '/bookings',
  REVIEWS: '/reviews',
  SUPPORT: '/support',
  ABOUT: '/about',
  CONTACT: '/contact',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  MEMBERSHIP: '/membership',
} as const;

// External URLs
export const EXTERNAL_URLS = {
  TERMS_OF_SERVICE: 'https://afterglow.app/terms',
  PRIVACY_POLICY: 'https://afterglow.app/privacy',
  SUPPORT_EMAIL: 'support@afterglow.app',
  HELP_CENTER: 'https://help.afterglow.app',
  SOCIAL: {
    TWITTER: 'https://twitter.com/afterglow',
    FACEBOOK: 'https://facebook.com/afterglow',
    INSTAGRAM: 'https://instagram.com/afterglow',
    LINKEDIN: 'https://linkedin.com/company/afterglow',
  },
};

// Feature Flags (for development)
export const FEATURE_FLAGS = {
  ENABLE_REAL_TIME_UPDATES: false,
  ENABLE_AI_RECOMMENDATIONS: false,
  ENABLE_CARBON_TRACKING: true,
  ENABLE_SOCIAL_LOGIN: true,
  ENABLE_DARK_MODE: true,
  ENABLE_OFFLINE_MODE: false,
};

// Rate Limiting
export const RATE_LIMITS = {
  SEARCH_REQUESTS_PER_MINUTE: 60,
  BOOKING_REQUESTS_PER_HOUR: 10,
  REVIEW_REQUESTS_PER_DAY: 5,
};