import axios from "axios";
import type { AirQualityResponse } from "@/types/AQI";
import type { OpenWeather } from "@/types/OpenWeather";
import type { Location, PMMonitor, DHTMonitor } from "@/types/StationAPI";

const STATION_TIMEOUT_MS = 3000;
const HUBBLE_TIMEOUT_MS = 5000;

function stationBase(): string {
  const host = import.meta.env.VITE_STATION_API_ENDPOINT;
  const port = import.meta.env.VITE_STATION_API_PORT;
  return `http://${host}:${port}/polaris-sensor/api/v1`;
}

function hubbleBase(): string {
  const host = import.meta.env.VITE_HUBBLE_API_ENDPOINT;
  const port = import.meta.env.VITE_HUBBLE_API_PORT;
  return `http://${host}:${port}/api/v1`;
}

export async function getStationLocation(): Promise<Location> {
  const { data } = await axios.get<Location>(`${stationBase()}/location`, {
    timeout: STATION_TIMEOUT_MS,
  });
  return data;
}

export async function getStationPM(): Promise<PMMonitor> {
  const { data } = await axios.get<PMMonitor>(`${stationBase()}/pm`, {
    timeout: STATION_TIMEOUT_MS,
  });
  return data;
}

export async function getStationDHT(): Promise<DHTMonitor> {
  const { data } = await axios.get<DHTMonitor>(`${stationBase()}/dht`, {
    timeout: STATION_TIMEOUT_MS,
  });
  return data;
}

export async function getOpenWeather(
  lat: number,
  lon: number,
): Promise<OpenWeather> {
  const { data } = await axios.get<OpenWeather>(
    `${hubbleBase()}/openweather/data`,
    {
      params: { lat, lon },
      timeout: HUBBLE_TIMEOUT_MS,
    },
  );
  return data;
}

export async function getAirQuality(
  lat: number,
  lon: number,
): Promise<AirQualityResponse> {
  const { data } = await axios.get<AirQualityResponse>(
    `${hubbleBase()}/aqi/data`,
    {
      params: { lat, lon },
      timeout: HUBBLE_TIMEOUT_MS,
    },
  );
  return data;
}
