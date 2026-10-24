import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChargingStation } from '../types';
import { stationService } from '../services/api';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'chargeease_favorites';
const CHANGE_EVENT = 'chargeease:favorites-changed';

function readLocalFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* localStorage unavailable (private mode) — favourites stay in memory */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Saved stations for signed-in drivers come from `GET /users/favorites`, so
 * they follow the account across devices. Guests keep a browser-only list,
 * which is clearly the lesser mode: saving a station asks them to sign in.
 */
export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localFavorites, setLocalFavorites] = useState<string[]>(readLocalFavorites);

  useEffect(() => {
    const sync = () => setLocalFavorites(readLocalFavorites());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: () => stationService.getFavorites(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const stations: ChargingStation[] = user ? favoritesQuery.data ?? [] : [];
  const favorites = user ? stations.map((station) => station.id) : localFavorites;

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const currentlySaved = favorites.includes(id);

      if (!user) {
        const next = currentlySaved
          ? localFavorites.filter((item) => item !== id)
          : [id, ...localFavorites];
        writeLocalFavorites(next);
        setLocalFavorites(next);
        return !currentlySaved;
      }

      const previous = favoritesQuery.data ?? [];
      const optimistic = currentlySaved
        ? previous.filter((station) => station.id !== id)
        : previous;
      queryClient.setQueryData(['favorites'], optimistic);

      try {
        if (currentlySaved) {
          await stationService.removeFavorite(id);
        } else {
          await stationService.addFavorite(id);
        }
        await queryClient.invalidateQueries({ queryKey: ['favorites'] });
        return !currentlySaved;
      } catch (error) {
        queryClient.setQueryData(['favorites'], previous);
        throw error;
      }
    },
    [favorites, localFavorites, user, favoritesQuery.data, queryClient],
  );

  const removeFavorite = useCallback(
    async (id: string) => {
      if (user) {
        await stationService.removeFavorite(id);
        await queryClient.invalidateQueries({ queryKey: ['favorites'] });
        return;
      }
      const next = localFavorites.filter((item) => item !== id);
      writeLocalFavorites(next);
      setLocalFavorites(next);
    },
    [localFavorites, queryClient, user],
  );

  return {
    favorites,
    stations,
    isLoading: user ? favoritesQuery.isPending : false,
    error: user ? favoritesQuery.error : null,
    isFavorite,
    toggleFavorite,
    removeFavorite,
  };
}
