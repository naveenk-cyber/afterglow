import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ScrollManager from './ScrollManager';

/**
 * Regression coverage for the navigation bug: a link clicked at the bottom of
 * one route used to open the next route at the same scroll offset, so the
 * footer "Contact" link landed on the Contact page's footer.
 */

let scrollY = 0;
let scrollTo: ReturnType<typeof vi.fn>;

function stubScroll() {
  scrollTo = vi.fn();
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    configurable: true,
    value: scrollTo,
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  });
}

const lastCall = () => scrollTo.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;

function QueryLink() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/search?q=second')}>
      Change filter
    </button>
  );
}

function Links() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/contact')}>
        Contact
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

function renderAt(route: string, children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ScrollManager />
      {children}
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/search" element={<p>Search</p>} />
        <Route path="/contact" element={<p>Contact page</p>} />
        <Route path="/about" element={<p>About page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScrollManager', () => {
  beforeEach(() => {
    scrollY = 0;
    stubScroll();
  });

  it('opens a newly pushed route at the top instead of the previous offset', async () => {
    const user = userEvent.setup();
    scrollY = 5200;
    renderAt('/', <Links />);

    await user.click(screen.getByRole('button', { name: 'Contact' }));

    expect(screen.getByText('Contact page')).toBeInTheDocument();
    expect(lastCall()).toMatchObject({ top: 0, left: 0 });
  });

  it('never scrolls when only the query string changes', async () => {
    const user = userEvent.setup();
    renderAt('/search?q=first', <QueryLink />);

    await user.click(screen.getByRole('button', { name: 'Change filter' }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('restores the offset of the history entry on back navigation', async () => {
    const user = userEvent.setup();
    renderAt('/', <Links />);

    // Stand in for the user reading the homepage halfway down.
    scrollY = 1800;
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });

    await user.click(screen.getByRole('button', { name: 'Contact' }));
    expect(lastCall()).toMatchObject({ top: 0 });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Back' }));
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });

    expect(screen.getByText('Home')).toBeInTheDocument();
    await waitFor(() => expect(lastCall()).toMatchObject({ top: 1800 }));
  });

  it('scrolls a hash target into view below the sticky header', async () => {
    const target = document.createElement('div');
    target.id = 'faq';
    target.getBoundingClientRect = () =>
      ({ top: 300, bottom: 400, left: 0, right: 0, width: 0, height: 100, x: 0, y: 300 }) as DOMRect;
    document.body.appendChild(target);

    renderAt('/#faq', <p>Page</p>);

    expect(lastCall()).toMatchObject({ top: 300 - 84 });
    target.remove();
  });
});
