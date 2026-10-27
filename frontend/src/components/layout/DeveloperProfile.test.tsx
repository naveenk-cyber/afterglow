import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import DeveloperProfile from './DeveloperProfile';

const PROFILE_LINKS = [
  { name: 'Portfolio', href: 'https://updatedportfolio-five.vercel.app/' },
  { name: 'GitHub', href: 'https://github.com/naveenk-cyber' },
  { name: 'CodeChef', href: 'https://www.codechef.com/users/enum4linux' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/naveenk369/' },
];

describe('DeveloperProfile', () => {
  it('renders the developer heading, subtitle and bio', () => {
    renderWithProviders(<DeveloperProfile />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Built by Naveen K' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The developer behind Afterglow')).toBeInTheDocument();
    expect(screen.getByText(/B\.Tech Information Technology student/)).toBeInTheDocument();
  });

  it('emphasises only the trailing K of the heading', () => {
    renderWithProviders(<DeveloperProfile />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Built by Naveen K' });
    const emphasised = heading.querySelector('span');

    expect(emphasised).toHaveTextContent('K');
    expect(emphasised?.textContent).toBe('K');
    expect(emphasised).toHaveClass('font-bold');
  });

  it('lists every team member', () => {
    renderWithProviders(<DeveloperProfile />);

    expect(screen.getByText('Team')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(expect.arrayContaining(['Naveen K', 'Sudharshan S', 'Sri Iyappan K']));
  });

  it('links the section to its heading for assistive technology', () => {
    const { container } = renderWithProviders(<DeveloperProfile />);
    const section = container.querySelector('section');

    expect(section).toHaveAttribute('aria-labelledby', 'developer-profile-heading');
    expect(container.querySelector('#developer-profile-heading')).toBe(
      screen.getByRole('heading', { level: 2, name: 'Built by Naveen K' }),
    );
  });

  it.each(PROFILE_LINKS)('opens $name in a new tab safely', ({ name, href }) => {
    renderWithProviders(<DeveloperProfile />);

    const link = screen.getByRole('link', { name: new RegExp(`^${name}`) });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('does not render the ChargeEase credit sentence any more', () => {
    renderWithProviders(<DeveloperProfile />);

    expect(screen.queryByText(/building upon the original ChargeEase/)).not.toBeInTheDocument();
    expect(screen.queryByText(/developed and customized by Naveen/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Unseencoderz/ })).not.toBeInTheDocument();
  });

  it('names every external link so screen readers announce the new tab', () => {
    renderWithProviders(<DeveloperProfile />);

    for (const { name } of PROFILE_LINKS) {
      const link = screen.getByRole('link', { name: new RegExp(`^${name}`) });
      expect(link.textContent).toContain('(opens in a new tab)');
    }
  });
});
