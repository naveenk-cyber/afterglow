import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUser, renderWithProviders } from '../test/renderWithProviders';
import ProfilePage from './ProfilePage';
import { authService, stationService, tokenStore, userService } from '../services/api';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.set('test-token');
  vi.spyOn(authService, 'me').mockResolvedValue(makeUser());
  vi.spyOn(stationService, 'getFavorites').mockResolvedValue([]);
});

describe('ProfilePage — validation and saved data', () => {
  it('blocks a save without a name and explains why', async () => {
    const updateProfile = vi.spyOn(userService, 'updateProfile');
    renderWithProviders(<ProfilePage />, { withAuth: true });

    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Add your full name before saving.');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves profile changes and confirms them', async () => {
    const updateProfile = vi
      .spyOn(userService, 'updateProfile')
      .mockResolvedValue(makeUser({ name: 'Ada Lovelace' }));
    renderWithProviders(<ProfilePage />, { withAuth: true });

    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ada Lovelace');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada Lovelace' })),
    );
    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
  });

  it('requires a make and model before adding a vehicle', async () => {
    const createVehicle = vi.spyOn(userService, 'createVehicle');
    renderWithProviders(<ProfilePage />, { withAuth: true });

    await userEvent.click(await screen.findByRole('button', { name: 'Vehicles' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add the vehicle make and model.',
    );
    expect(createVehicle).not.toHaveBeenCalled();
  });

  it('lists saved stations returned by the API', async () => {
    vi.spyOn(stationService, 'getFavorites').mockResolvedValue([
      {
        id: 'st-1',
        name: 'Embarcadero Center Garage',
        address: '4 Embarcadero Center',
        latitude: 37.79,
        longitude: -122.39,
        operator: 'ChargePoint',
        hostType: 'Other',
        chargingSpeed: 'Level 2',
        rating: 0,
        reviewCount: 0,
        amenities: [],
        connectorTypes: [],
        pricing: { currency: 'USD' },
        availability: { status: 'Available', availableConnectors: 1, totalConnectors: 2 },
        images: [],
        operatingHours: { isOpen24Hours: true },
      },
    ]);

    renderWithProviders(<ProfilePage />, { withAuth: true });

    expect(await screen.findByText('Embarcadero Center Garage')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Remove Embarcadero Center Garage/ }),
    ).toBeInTheDocument();
  });
});
