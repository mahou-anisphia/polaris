import {
  getAirQuality,
  getOpenWeather,
  getStationDHT,
  getStationLocation,
  getStationPM,
} from '@/api';
import type { AirQualityResponse } from '@/types/AQI';
import type { OpenWeather } from '@/types/OpenWeather';
import type { DHTMonitor, Location, PMMonitor } from '@/types/StationAPI';
import { CACHE_KEYS, CACHE_TTL, getCached, setCached } from './cache';

async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  force: boolean,
): Promise<T> {
  if (!force) {
    const hit = getCached<T>(key, ttl);
    if (hit !== null) return hit;
  }
  const data = await fetcher();
  setCached(key, data);
  return data;
}

export function fetchLocation(force = false): Promise<Location> {
  return withCache(CACHE_KEYS.LOCATION, CACHE_TTL.LOCATION, getStationLocation, force);
}

export function fetchWeather(lat: number, lon: number, force = false): Promise<OpenWeather> {
  return withCache(
    CACHE_KEYS.WEATHER,
    CACHE_TTL.EXTERNAL,
    () => getOpenWeather(lat, lon),
    force,
  );
}

export function fetchAirQuality(lat: number, lon: number, force = false): Promise<AirQualityResponse> {
  return withCache(
    CACHE_KEYS.AIR_QUALITY,
    CACHE_TTL.EXTERNAL,
    () => getAirQuality(lat, lon),
    force,
  );
}

export function fetchPM(force = false): Promise<PMMonitor> {
  return withCache(CACHE_KEYS.PM, CACHE_TTL.SENSOR, getStationPM, force);
}

export function fetchDHT(force = false): Promise<DHTMonitor> {
  return withCache(CACHE_KEYS.DHT, CACHE_TTL.SENSOR, getStationDHT, force);
}
