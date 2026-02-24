/** EPA PM2.5 24-hour average breakpoints for US AQI linear interpolation. */
const BREAKPOINTS = [
  { cLow: 0.0,   cHigh: 12.0,   aqiLow: 0,   aqiHigh: 50  },
  { cLow: 12.1,  cHigh: 35.4,   aqiLow: 51,  aqiHigh: 100 },
  { cLow: 35.5,  cHigh: 55.4,   aqiLow: 101, aqiHigh: 150 },
  { cLow: 55.5,  cHigh: 150.4,  aqiLow: 151, aqiHigh: 200 },
  { cLow: 150.5, cHigh: 250.4,  aqiLow: 201, aqiHigh: 300 },
  { cLow: 250.5, cHigh: 350.4,  aqiLow: 301, aqiHigh: 400 },
  { cLow: 350.5, cHigh: 500.4,  aqiLow: 401, aqiHigh: 500 },
] as const;

/**
 * Convert PM2.5 concentration (µg/m³) to US AQI.
 * Uses EPA standard: truncate input to 1 decimal, then linear interpolation
 * between the appropriate concentration breakpoints.
 */
export function pm25ToAQI(pm25: number): number {
  const c = Math.floor(pm25 * 10) / 10; // EPA truncates, does not round
  if (c > 500.4) return 500;
  const bp = BREAKPOINTS.find(({ cLow, cHigh }) => c >= cLow && c <= cHigh);
  if (!bp) return 0;
  const { cLow, cHigh, aqiLow, aqiHigh } = bp;
  return Math.round(((aqiHigh - aqiLow) / (cHigh - cLow)) * (c - cLow) + aqiLow);
}
