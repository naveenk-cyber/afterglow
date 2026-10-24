import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'recentlyViewed';
const CHANGE_EVENT = 'chargeease:recently-viewed-changed';

/** How many stations we keep in the local history. */
export const RECENTLY_VIEWED_LIMIT = 8;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode — history stays in memory for this tab */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Recently viewed stations, stored in this browser only.
 *
 * The station details page records a visit; the finder reads the same list to
 * offer a shortcut back. No account, cookie or server call is involved, and the
 * list is capped so it cannot grow without bound.
 */
export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(readRecent);

  useEffect(() => {
    const sync = () => setIds(readRecent());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const recordVisit = useCallback((id: string) => {
    if (!id) return;
    const next = [id, ...readRecent().filter((item) => item !== id)].slice(
      0,
      RECENTLY_VIEWED_LIMIT,
    );
    writeRecent(next);
    setIds(next);
  }, []);

  const clearRecent = useCallback(() => {
    writeRecent([]);
    setIds([]);
  }, []);

  return { ids, recordVisit, clearRecent };
}
