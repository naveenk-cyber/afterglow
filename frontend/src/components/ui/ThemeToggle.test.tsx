import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, THEME_STORAGE_KEY } from '../../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

/**
 * The jsdom `matchMedia` stub in src/test/setup.ts reports `matches: false` for
 * every query, so there is never a "prefers light" signal here. That is exactly
 * the no-signal case the product must resolve to: the dark baseline.
 */
describe('ThemeToggle', () => {
  it('falls back to the dark baseline when nothing is stored and the OS is silent', () => {
    renderToggle();
    const button = screen.getByRole('button', { name: 'Dark theme' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('switches to light instantly and persists the explicit choice', async () => {
    renderToggle();
    await userEvent.click(screen.getByRole('button', { name: 'Dark theme' }));

    const button = screen.getByRole('button', { name: 'Dark theme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a stored preference on mount without being clicked', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderToggle();

    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(document.documentElement).toHaveClass('light');
  });

  it('does not persist anything until the user actually chooses', () => {
    renderToggle();
    // Applying the resolved theme is not a choice: writing it here would look
    // like one and freeze out the OS preference on the next visit.
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('keeps the theme-color meta in step with the active theme', async () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#0A0B0C');
    document.head.appendChild(meta);

    renderToggle();
    expect(meta.getAttribute('content')).toBe('#0A0B0C');

    const button = screen.getByRole('button', { name: 'Dark theme' });
    await userEvent.click(button);
    expect(meta.getAttribute('content')).toBe('#F5F8FC');

    await userEvent.click(button);
    expect(meta.getAttribute('content')).toBe('#0A0B0C');

    meta.remove();
  });
});
