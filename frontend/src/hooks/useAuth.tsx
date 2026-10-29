import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginForm, SignupForm, User } from '../types';
import {
  ApiError,
  authService,
  clearLegacySessionStorage,
  setUnauthorizedHandler,
  tokenStore,
  userService,
} from '../services/api';
import {
  clearSupabaseSession,
  googleSignInEnabled,
  startGoogleSignIn,
} from '../services/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True while the initial cookie session is being restored. */
  isLoading: boolean;
  /** Set when the session could not be checked (for example, the API is down). */
  sessionError: string | null;
  login: (credentials: LoginForm) => Promise<void>;
  signup: (userData: SignupForm) => Promise<void>;
  /** True when this build can offer "Continue with Google". */
  googleSignInEnabled: boolean;
  /**
   * Hand the browser to Google. Resolves only when the redirect could not be
   * started, so a resolved call is not a completed sign-in.
   */
  loginWithGoogle: (returnTo?: string) => Promise<void>;
  /**
   * Finish a Google sign-in: swap the Supabase access token for an Afterglow
   * session. Used by /auth/callback only.
   */
  completeGoogleLogin: (accessToken: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Persist a partial profile through the API and update local state. */
  updateUser: (patch: Partial<User>) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // A 401 from any request means the HttpOnly cookie and/or bearer token is no
  // longer valid, so every consumer must drop the signed-in view at once.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const restore = useCallback(async () => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const restored = await authService.me();
      if (mounted.current) setUser(restored);
    } catch (error) {
      if (!mounted.current) return;
      setUser(null);
      // A network failure is not proof the session is invalid. Keep the token
      // (the cookie is untouched anyway) and surface the reason so the sign-in
      // page can explain why the account area sent the driver back.
      if (error instanceof ApiError && error.isNetworkError) {
        setSessionError(error.message);
      } else {
        // The API rejected the session (expired, revoked or malformed), so the
        // bearer shim must not outlive it. The HttpOnly cookie is cleared by the
        // API's Set-Cookie response.
        tokenStore.clear();
      }
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Remove credentials written by the previous local-only demo build before
    // checking the real server session.
    clearLegacySessionStorage();
    void restore();
  }, [restore]);

  const login = async (credentials: LoginForm) => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const result = await authService.login(credentials);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupForm) => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const result = await authService.signup(userData);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (returnTo?: string) => {
    setSessionError(null);
    await startGoogleSignIn(returnTo);
  };

  const completeGoogleLogin = async (accessToken: string): Promise<User> => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const result = await authService.loginWithSupabase(accessToken);
      setUser(result.user);
      return result.user;
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      clearSession();
      // Drop the Google copy too, so a shared machine is not left signed in to
      // Google (and cannot silently re-enter Afterglow through it).
      await clearSupabaseSession();
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    const current = await authService.me();
    setUser(current);
  };

  const updateUser = async (patch: Partial<User>): Promise<User> => {
    const updated = await userService.updateProfile(patch);
    setUser(updated);
    return updated;
  };

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    sessionError,
    login,
    signup,
    googleSignInEnabled,
    loginWithGoogle,
    completeGoogleLogin,
    logout,
    refreshUser,
    updateUser,
  };
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
