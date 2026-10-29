// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';

// The landing page ships with the entry bundle so its hero (the LCP element)
// never waits on a second request. Every other route is split out: they pull in
// Leaflet, the form stack and the chart/map components, none of which the home
// page needs.
import Home from './components/Home';

const SearchPage = React.lazy(() => import('./pages/SearchPage'));
const ComparePage = React.lazy(() => import('./pages/ComparePage'));
const StationDetailsPage = React.lazy(() => import('./pages/StationDetailsPage'));
const BookingPage = React.lazy(() => import('./pages/BookingPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const SessionDetailPage = React.lazy(() => import('./pages/SessionDetailPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const WalletPage = React.lazy(() => import('./pages/WalletPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const MembershipPage = React.lazy(() => import('./pages/MembershipPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Auth pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
// Landing point for the Google round trip (Supabase posts the browser back here).
const GoogleCallbackPage = React.lazy(() => import('./pages/auth/GoogleCallbackPage'));

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

/**
 * Shown only while a split route chunk is fetching. It mirrors the page rhythm
 * (label, title, card grid) so the swap does not jump the layout.
 */
const RouteFallback: React.FC = () => (
  <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8" aria-busy="true">
    <span className="sr-only">Loading page</span>
    <div className="h-3 w-24 animate-pulse rounded-full bg-surface-muted" />
    <div className="mt-4 h-10 w-[min(28rem,80%)] animate-pulse rounded-card bg-surface-muted" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-card bg-surface-muted" />
      ))}
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <MainLayout>
            <React.Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/station/:id" element={<StationDetailsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/membership" element={<MembershipPage />} />

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<GoogleCallbackPage />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/bookings" element={
                <ProtectedRoute>
                  <BookingPage />
                </ProtectedRoute>
              } />
              <Route path="/sessions/:id" element={
                <ProtectedRoute>
                  <SessionDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/wallet" element={
                <ProtectedRoute>
                  <WalletPage />
                </ProtectedRoute>
              } />

              {/* Redirect old routes */}
              <Route path="/map" element={<Navigate to="/search?view=map" replace />} />
              
              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </React.Suspense>
          </MainLayout>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;