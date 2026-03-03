import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Wind,
} from 'lucide-react';
import { toast } from 'sonner';
import { pm25ToAQI } from '@/lib/aqi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
const CsvChart = lazy(() =>
  import('@/components/CsvChart').then((m) => ({ default: m.CsvChart })),
);
import { fetchAirQuality, fetchDHT, fetchLocation, fetchPM, fetchWeather } from '@/store';
import { CACHE_KEYS, CACHE_TTL, getCacheAge, getCachedStale, isCacheValid } from '@/store/cache';
import type { AirQualityResponse } from '@/types/AQI';
import type { OpenWeather } from '@/types/OpenWeather';
import type { DHTMonitor, Location, PMMonitor } from '@/types/StationAPI';

interface DashboardData {
  location: Location;
  weather: OpenWeather;
  airQuality: AirQualityResponse;
  pm: PMMonitor;
  dht: DHTMonitor;
}

function aqiLevel(aqi: number) {
  if (aqi <= 50)  return { label: 'Good',                  bg: 'bg-green-100',  fg: 'text-green-800'  };
  if (aqi <= 100) return { label: 'Moderate',               bg: 'bg-amber-100',  fg: 'text-amber-800'  };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)',  bg: 'bg-orange-100', fg: 'text-orange-800' };
  if (aqi <= 200) return { label: 'Unhealthy',              bg: 'bg-red-100',    fg: 'text-red-800'    };
  if (aqi <= 300) return { label: 'Very Unhealthy',         bg: 'bg-purple-100', fg: 'text-purple-800' };
  return           { label: 'Hazardous',                    bg: 'bg-rose-200',   fg: 'text-rose-900'   };
}

function signedDelta(a: number, b: number, decimals = 1): string {
  const d = a - b;
  return `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;
}

function deltaClass(a: number, b: number, warn = 1, danger = 5): string {
  const d = Math.abs(a - b);
  if (d < warn)   return 'text-muted-foreground';
  if (d < danger) return 'text-amber-700';
  return 'text-red-700';
}

function AQIBadge({ value, className = '' }: Readonly<{ value: number; className?: string }>) {
  const lvl = aqiLevel(value);
  return (
    <Badge variant="outline" className={`${lvl.bg} ${lvl.fg} border-0 font-medium text-xs ${className}`}>
      {lvl.label}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-5">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    </div>
  );
}

interface DataWarning { title: string; description: string; }

export default function App() {
  const [data, setData]           = useState<DashboardData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [warnings, setWarnings]   = useState<DataWarning[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async (force = false) => {
    // Snapshot cache validity BEFORE fetching so we can report it after
    const weatherWasCached = !force && isCacheValid(CACHE_KEYS.WEATHER, CACHE_TTL.EXTERNAL);

    setLoading(true);
    setError(null);
    setWarnings([]);

    const toastId = force ? toast.loading('Refreshing data…') : undefined;
    const newWarnings: DataWarning[] = [];

    try {
      // Location is required for the weather/AQI fetches; handle it first
      let location: Location;
      try {
        location = await fetchLocation(force);
      } catch {
        const stale = getCachedStale<Location>(CACHE_KEYS.LOCATION);
        if (!stale) throw new Error('Station unreachable and no cached location available');
        newWarnings.push({ title: 'Station unreachable', description: 'Showing cached location data' });
        location = stale;
      }

      const [weatherResult, airQualityResult, pmResult, dhtResult] = await Promise.allSettled([
        fetchWeather(location.latitude, location.longitude, force),
        fetchAirQuality(location.latitude, location.longitude, force),
        fetchPM(force),
        fetchDHT(force),
      ]);

      // Weather
      let weather: OpenWeather;
      if (weatherResult.status === 'fulfilled') {
        weather = weatherResult.value;
      } else {
        const stale = getCachedStale<OpenWeather>(CACHE_KEYS.WEATHER);
        if (!stale) throw new Error('Weather data unavailable and no cached data found');
        newWarnings.push({ title: 'Weather API failed', description: 'Showing cached weather data from earlier today' });
        weather = stale;
      }

      // Air quality
      let airQuality: AirQualityResponse;
      if (airQualityResult.status === 'fulfilled') {
        airQuality = airQualityResult.value;
      } else {
        const stale = getCachedStale<AirQualityResponse>(CACHE_KEYS.AIR_QUALITY);
        if (!stale) throw new Error('Air quality data unavailable and no cached data found');
        newWarnings.push({ title: 'Air quality API failed', description: 'Showing cached AQI data from earlier today' });
        airQuality = stale;
      }

      // PM sensor
      let pm: PMMonitor;
      if (pmResult.status === 'fulfilled') {
        pm = pmResult.value;
      } else {
        const stale = getCachedStale<PMMonitor>(CACHE_KEYS.PM);
        if (!stale) throw new Error('PM sensor data unavailable and no cached data found');
        newWarnings.push({ title: 'PM sensor unreachable', description: 'Showing cached sensor readings from earlier today' });
        pm = stale;
      }

      // DHT sensor
      let dht: DHTMonitor;
      if (dhtResult.status === 'fulfilled') {
        dht = dhtResult.value;
      } else {
        const stale = getCachedStale<DHTMonitor>(CACHE_KEYS.DHT);
        if (!stale) throw new Error('DHT sensor data unavailable and no cached data found');
        newWarnings.push({ title: 'DHT sensor unreachable', description: 'Showing cached sensor readings from earlier today' });
        dht = stale;
      }

      setData({ location, weather, airQuality, pm, dht });
      setWarnings(newWarnings);
      setFromCache(weatherWasCached);
      setLastUpdated(getCacheAge(CACHE_KEYS.WEATHER) ?? new Date());

      if (toastId !== undefined) {
        if (newWarnings.length > 0) {
          toast.warning('Refreshed with some stale data', { id: toastId });
        } else {
          toast.success('Data refreshed', { id: toastId });
        }
      }
    } catch (err) {
      if (toastId !== undefined) toast.dismiss(toastId);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading && data === null) return <LoadingSkeleton />;

  if (error && data === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-center text-foreground font-medium">{error}</p>
            <Button onClick={() => fetchAll(true)} variant="outline" size="sm">
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // ── Derived values ────────────────────────────────────────────────────────

  const { location, weather, airQuality, pm, dht } = data;
  const w        = weather.weather[0];
  const ow       = weather.main;
  const aqi        = airQuality.data.current.pollution;
  const stationAQI = pm25ToAQI(pm.pm2_5);
  const latDir   = location.latitude  >= 0 ? 'N' : 'S';
  const lonDir   = location.longitude >= 0 ? 'E' : 'W';
  const pollTime = new Date(aqi.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">Polaris Monitor</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                {Math.abs(location.latitude).toFixed(4)}°{latDir},{' '}
                {Math.abs(location.longitude).toFixed(4)}°{lonDir}
              </span>
              {lastUpdated && (
                <span className="flex items-center gap-1">
                  <span className="text-border">·</span>
                  <Clock className="size-3.5 shrink-0" />
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {fromCache && <span className="opacity-60 text-xs">cached</span>}
                </span>
              )}
              <span className="hidden sm:inline text-border">·</span>
              <span className="hidden sm:inline text-xs">
                {airQuality.data.city}, {airQuality.data.country}
              </span>
            </div>
          </div>
          <Button
            onClick={() => fetchAll(true)}
            variant="outline"
            size="sm"
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {/* Per-source stale-data alerts */}
        {warnings.map((w) => (
          <Alert key={w.title} variant="destructive" className="rounded-xl">
            <AlertCircle className="size-4" />
            <AlertTitle>{w.title}</AlertTitle>
            <AlertDescription>{w.description}</AlertDescription>
          </Alert>
        ))}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Weather card — OpenWeather data only */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary">Current Weather</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {w && (
                  <img
                    src={`https://openweathermap.org/img/wn/${w.icon}@2x.png`}
                    alt={w.description}
                    className="w-14 h-14"
                  />
                )}
                <div>
                  <div className="text-4xl font-bold text-foreground">{ow.temp.toFixed(1)}°C</div>
                  <div className="text-sm capitalize text-muted-foreground mt-0.5">
                    {w?.description ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Feels like {ow.feels_like.toFixed(1)}°C
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                    <div>
                      Station {dht.temperature.toFixed(1)}°C
                      <span className={`ml-1 ${deltaClass(dht.temperature, ow.temp)}`}>
                        ({signedDelta(dht.temperature, ow.temp)} vs API)
                      </span>
                    </div>
                    <div>
                      {dht.humidity.toFixed(0)}% RH
                      <span className={`ml-1 ${deltaClass(dht.humidity, ow.humidity, 2, 10)}`}>
                        ({signedDelta(dht.humidity, ow.humidity, 0)} vs API)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 pt-1 border-t border-border">
                {([
                  { Icon: Droplets, label: 'Humidity',   val: `${ow.humidity}%` },
                  { Icon: Wind,     label: 'Wind',       val: `${(weather.wind.speed * 3.6).toFixed(1)} km/h` },
                  { Icon: Eye,      label: 'Visibility', val: `${(weather.visibility / 1000).toFixed(1)} km` },
                  { Icon: Gauge,    label: 'Pressure',   val: `${ow.pressure} hPa` },
                ]).map(({ Icon, label, val }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm">
                    <span className="text-secondary shrink-0"><Icon className="size-3.5" /></span>
                    <span className="text-muted-foreground">{label}</span>
                    <span className="ml-auto font-medium text-foreground">{val}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Source: OpenWeatherMap</p>
            </CardContent>
          </Card>

          {/* AQI card — AQAir + local PM sensor */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary">Air Quality</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold text-foreground">{aqi.aqius}</div>
                <div className="mb-0.5 space-y-1">
                  <AQIBadge value={aqi.aqius} />
                  <div className="text-xs text-muted-foreground">
                    US AQI · Main: {aqi.mainus.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM1.0</span>
                  <span className="font-medium text-foreground">{pm.pm1_0} {pm.unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM2.5</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="font-medium text-foreground">{pm.pm2_5} {pm.unit}</span>
                    <span className="text-xs text-muted-foreground">AQI {stationAQI}</span>
                    <AQIBadge value={stationAQI} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM10</span>
                  <span className="font-medium text-foreground">{pm.pm10} {pm.unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Measured at</span>
                  <span className="font-medium text-foreground">{pollTime}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Source: IQAir / AirVisual · Station: I2C 0x19</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Station Overview card ── */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-primary">Station Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Raw sensor readings */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Sensor Readings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-semibold text-foreground">{dht.temperature.toFixed(1)} °{dht.temperature_unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Humidity</span>
                  <span className="font-semibold text-foreground">{dht.humidity.toFixed(1)} {dht.humidity_unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM1.0</span>
                  <span className="font-semibold text-foreground">{pm.pm1_0} {pm.unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM2.5</span>
                  <span className="font-semibold text-foreground">{pm.pm2_5} {pm.unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PM10</span>
                  <span className="font-semibold text-foreground">{pm.pm10} {pm.unit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Station AQI</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{stationAQI}</span>
                    <AQIBadge value={stationAQI} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                DHT11 · GPIO D4 &nbsp;·&nbsp; PM sensor · I2C Bus 1 · 0x19
              </p>
            </div>

            <Separator />

            {/* Atmospheric section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Atmospheric
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Metric', 'OpenWeather', 'Station', 'Δ'].map((h, i) => (
                        <th
                          key={h}
                          className={`pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                            i === 0 ? 'text-left w-32' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2.5 font-medium text-foreground">Temperature</td>
                      <td className="py-2.5 text-right text-foreground">{ow.temp.toFixed(1)} °C</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{dht.temperature.toFixed(1)} °C</td>
                      <td className={`py-2.5 text-right font-semibold ${deltaClass(dht.temperature, ow.temp)}`}>
                        {signedDelta(dht.temperature, ow.temp)} °C
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-foreground">Humidity</td>
                      <td className="py-2.5 text-right text-foreground">{ow.humidity} %</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{dht.humidity.toFixed(1)} %</td>
                      <td className={`py-2.5 text-right font-semibold ${deltaClass(dht.humidity, ow.humidity, 2, 10)}`}>
                        {signedDelta(dht.humidity, ow.humidity, 0)} %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Air quality section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Air Quality (US AQI)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Source', 'AQI', 'Level', 'Δ'].map((h, i) => (
                        <th
                          key={h}
                          className={`pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                            i === 0 ? 'text-left' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2.5 font-medium text-foreground">AQAir</td>
                      <td className="py-2.5 text-right text-foreground">{aqi.aqius}</td>
                      <td className="py-2.5 text-right">
                        <AQIBadge value={aqi.aqius} />
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">—</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-foreground">Station<span className="ml-1 text-xs font-normal text-muted-foreground">(PM2.5→EPA)</span></td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{stationAQI}</td>
                      <td className="py-2.5 text-right">
                        <AQIBadge value={stationAQI} />
                      </td>
                      <td className={`py-2.5 text-right font-semibold ${deltaClass(stationAQI, aqi.aqius, 10, 30)}`}>
                        {signedDelta(stationAQI, aqi.aqius, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Station AQI derived from raw PM2.5 (µg/m³) via EPA linear interpolation.
                Δ is positive when the station sensor reads higher pollution than AQAir reports.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border">
              {[
                { label: 'Good',                  bg: 'bg-green-100',  fg: 'text-green-800'  },
                { label: 'Moderate',               bg: 'bg-amber-100',  fg: 'text-amber-800'  },
                { label: 'Unhealthy (Sensitive)',  bg: 'bg-orange-100', fg: 'text-orange-800' },
                { label: 'Unhealthy',              bg: 'bg-red-100',    fg: 'text-red-800'    },
                { label: 'Very Unhealthy',         bg: 'bg-purple-100', fg: 'text-purple-800' },
                { label: 'Hazardous',              bg: 'bg-rose-200',   fg: 'text-rose-900'   },
              ].map(({ label, bg, fg }) => (
                <span key={label} className={`text-xs px-2 py-0.5 rounded-full ${bg} ${fg}`}>
                  {label}
                </span>
              ))}
            </div>

          </CardContent>
        </Card>

        {/* ── Historical Data chart ── */}
        <Suspense fallback={<Skeleton className="h-52 w-full rounded-2xl" />}>
          <CsvChart />
        </Suspense>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Polaris Sensor Station
          {' · '}External data cached for 5 min · Sensor data cached for 1 min
          {' · '}Refresh forces new fetch
        </p>
      </div>
    </div>
  );
}
