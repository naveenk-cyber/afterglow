import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Kept identical to the key the bootstrap script in `index.html` reads. The
 * script runs before the first paint, so the class on <html> is already correct
 * by the time React mounts and this provider only has to stay in step with it.
 */
export const THEME_STORAGE_KEY = 'chargeease_theme';

/** Must match the `theme-color` colours in index.html. */
const THEME_COLOR: Record<Theme, string> = { dark: '#0A0B0C', light: '#F5F8FC' };

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    // Storage can throw in private mode or when cookies are blocked; the theme
    // simply stops persisting rather than breaking the render.
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Resolution order: an explicit choice, then the OS preference, then dark —
 * the palette the product is designed around, and the value baked into the
 * <html> class so a browser without JavaScript still gets the intended look.
 */
function getPreferredTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

/** Applies the theme to <html> so both the CSS variables and `dark:` variants flip. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // `light` is a real class, not just the absence of `dark`: the light token
  // block is scoped to `:root.light`.
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore persistence failures */
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);
  // Tracks whether the user has ever chosen a theme themselves. Without this,
  // writing the resolved value on mount would look like an explicit choice and
  // the OS preference could never be honoured again on a later visit.
  const hasChosen = useRef<boolean>(readStoredTheme() !== null);

  useEffect(() => {
    applyTheme(theme);
    if (hasChosen.current) storeTheme(theme);
  }, [theme]);

  // Follow the OS while the user has not picked a theme themselves.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (!hasChosen.current) setThemeState(systemTheme());
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // A choice made in one tab applies to the others.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(isTheme(event.newValue) ? event.newValue : systemTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    hasChosen.current = true;
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    hasChosen.current = true;
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
