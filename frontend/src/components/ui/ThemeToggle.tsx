import type React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  /** Placement classes from the header; sizing and colour stay internal. */
  className?: string;
}

/**
 * Sun/moon theme switch.
 *
 * One button, not two radio inputs: it is a single control in the header, so it
 * must not add a second tab stop. State is exposed with `aria-pressed` (a
 * standard toggle-button contract) and the stable accessible name is "Dark
 * theme", so assistive technology reads "Dark theme, pressed" in dark mode
 * instead of guessing from an icon. The visible sun/moon is decorative.
 */
const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const hint = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Dark theme"
      aria-pressed={isDark}
      title={hint}
      data-theme-toggle
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      {isDark ? (
        <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
