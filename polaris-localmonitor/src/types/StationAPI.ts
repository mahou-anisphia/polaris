export interface Location {
  latitude: number;
  longitude: number;
}

export interface PMMonitor {
  pm10: number;
  pm1_0: number;
  pm2_5: number;
  unit: string;
}

export interface DHTMonitor {
  humidity: number;
  humidity_unit: string;
  temperature: number;
  temperature_unit: string;
}
