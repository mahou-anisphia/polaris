import axios from "axios";
import type { AirQualityResponse } from "@/types/AQI";
import type { OpenWeather } from "@/types/OpenWeather";
import type { Location, PMMonitor, DHTMonitor } from "@/types/StationAPI";

const STATION_TIMEOUT_MS = 3000;

function stationBase(): string {
  const host = import.meta.env.VITE_STATION_API_ENDPOINT;
  const port = import.meta.env.VITE_STATION_API_PORT;
  return `http://${host}:${port}/polaris-sensor/api/v1`;
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
    `https://${import.meta.env.VITE_OPENWEATHER_API_ENDPOINT}/data/2.5/weather`,
    {
      params: {
        lat,
        lon,
        appid: import.meta.env.VITE_OPENWEATHER_API_KEY,
        units: "metric",
      },
    },
  );
  return data;
}

export async function getAirQuality(
  lat: number,
  lon: number,
): Promise<AirQualityResponse> {
  const { data } = await axios.get<AirQualityResponse>(
    `https://${import.meta.env.VITE_AQAIR_API_ENDPOINT}/v2/nearest_city`,
    {
      params: {
        lat,
        lon,
        key: import.meta.env.VITE_AQAIR_API_KEY,
      },
    },
  );
  return data;
}
