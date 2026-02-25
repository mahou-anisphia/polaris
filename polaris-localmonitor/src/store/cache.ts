interface CacheEntry<T> {
  data: T;
  timestamp: number; // ms since epoch
}

export const CACHE_TTL = {
  LOCATION: 60 * 60 * 1000,   // 1 hour  — station rarely moves
  EXTERNAL: 5 * 60 * 1000,    // 5 min   — weather/AQI APIs (rate-limit guard)
  SENSOR:   60 * 1000,        // 1 min   — local sensors (spam guard)
} as const;

export const CACHE_KEYS = {
  LOCATION:    'polaris_location',
  WEATHER:     'polaris_weather',
  AIR_QUALITY: 'polaris_air_quality',
  PM:          'polaris_pm',
  DHT:         'polaris_dht',
} as const;

/** Return cached value if it exists and is within TTL, otherwise null. */
export function getCached<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/** Write a value to cache with the current timestamp. */
export function setCached<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Silently ignore — storage full or unavailable (private mode)
  }
}

/** Return the Date when a key was last written, regardless of TTL. Null if absent. */
export function getCacheAge(key: string): Date | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return new Date(entry.timestamp);
  } catch {
    return null;
  }
}

/** True if a cache entry exists AND is within its TTL. */
export function isCacheValid(key: string, ttl: number): boolean {
  return getCached(key, ttl) !== null;
}

/**
 * Return cached value from today regardless of TTL, or null if absent or from
 * a previous calendar day. Used as a stale-fallback when a live fetch fails.
 */
export function getCachedStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const cached = new Date(entry.timestamp);
    const now    = new Date();
    const sameDay =
      cached.getFullYear() === now.getFullYear() &&
      cached.getMonth()    === now.getMonth()    &&
      cached.getDate()     === now.getDate();
    return sameDay ? entry.data : null;
  } catch {
    return null;
  }
}
