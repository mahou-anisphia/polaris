import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Clock,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react';
import { getAirQuality, getOpenWeather, getStationDHT, getStationLocation, getStationPM } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  if (aqi <= 50)  return { label: 'Good',                 bg: 'bg-green-100',  fg: 'text-green-800'  };
  if (aqi <= 100) return { label: 'Moderate',              bg: 'bg-amber-100',  fg: 'text-amber-800'  };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', bg: 'bg-orange-100', fg: 'text-orange-800' };
  if (aqi <= 200) return { label: 'Unhealthy',             bg: 'bg-red-100',    fg: 'text-red-800'    };
  if (aqi <= 300) return { label: 'Very Unhealthy',        bg: 'bg-purple-100', fg: 'text-purple-800' };
  return           { label: 'Hazardous',                   bg: 'bg-rose-200',   fg: 'text-rose-900'   };
}

function pm25Level(pm25: number) {
  if (pm25 <= 12)    return { label: 'Good',           bg: 'bg-green-100',  fg: 'text-green-800'  };
  if (pm25 <= 35.4)  return { label: 'Moderate',        bg: 'bg-amber-100',  fg: 'text-amber-800'  };
  if (pm25 <= 55.4)  return { label: 'Unhealthy†',      bg: 'bg-orange-100', fg: 'text-orange-800' };
  if (pm25 <= 150.4) return { label: 'Unhealthy',       bg: 'bg-red-100',    fg: 'text-red-800'    };
  if (pm25 <= 250.4) return { label: 'Very Unhealthy',  bg: 'bg-purple-100', fg: 'text-purple-800' };
  return              { label: 'Hazardous',              bg: 'bg-rose-200',   fg: 'text-rose-900'   };
}

function signedDelta(a: number, b: number, decimals = 1): string {
  const d = a - b;
  return `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;
}

function deltaClass(a: number, b: number): string {
  const d = Math.abs(a - b);
  if (d < 1) return 'text-muted-foreground';
  if (d < 5) return 'text-amber-700';
  return 'text-red-700';
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await getStationLocation();
      const [weather, airQuality, pm, dht] = await Promise.all([
        getOpenWeather(location.latitude, location.longitude),
        getAirQuality(location.latitude, location.longitude),
        getStationPM(),
        getStationDHT(),
      ]);
      setData({ location, weather, airQuality, pm, dht });
      setLastUpdated(new Date());
    } catch (err) {
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

  if (loading && data === null) return <LoadingSkeleton />;

  if (error && data === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-center text-foreground font-medium">{error}</p>
            <Button onClick={fetchAll} variant="outline" size="sm">
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { location, weather, airQuality, pm, dht } = data;
  const w = weather.weather[0];
  const ow = weather.main;
  const aqi = airQuality.data.current.pollution;
  const aqiWeather = airQuality.data.current.weather;
  const aqiLvl = aqiLevel(aqi.aqius);
  const pm25Lvl = pm25Level(pm.pm2_5);
  const latDir = location.latitude >= 0 ? 'N' : 'S';
  const lonDir = location.longitude >= 0 ? 'E' : 'W';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">
              Polaris Monitor
            </h1>
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
                </span>
              )}
              <span className="hidden sm:inline text-border">·</span>
              <span className="hidden sm:inline text-xs">
                {airQuality.data.city}, {airQuality.data.country}
              </span>
            </div>
          </div>
          <Button
            onClick={fetchAll}
            variant="outline"
            size="sm"
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {/* Stale-data error banner */}
        {error && data && (
          <div className="flex items-center gap-2 text-sm text-destructive px-1">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* OpenWeather card */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary">
                Current Weather
              </CardTitle>
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
                  <div className="text-4xl font-bold text-foreground">
                    {ow.temp.toFixed(1)}°C
                  </div>
                  <div className="text-sm capitalize text-muted-foreground mt-0.5">
                    {w?.description ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Feels like {ow.feels_like.toFixed(1)}°C
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
            </CardContent>
          </Card>

          {/* AQAir card */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary">
                Air Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold text-foreground">{aqi.aqius}</div>
                <div className="mb-0.5 space-y-1">
                  <Badge
                    variant="outline"
                    className={`${aqiLvl.bg} ${aqiLvl.fg} border-0 font-medium text-xs`}
                  >
                    {aqiLvl.label}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    US AQI · Main: {aqi.mainus.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 pt-1 border-t border-border">
                {([
                  { Icon: Thermometer, label: 'Temp',     val: `${aqiWeather.tp.toFixed(1)}°C` },
                  { Icon: Droplets,    label: 'Humidity', val: `${aqiWeather.hu}%` },
                  { Icon: Wind,        label: 'Wind',     val: `${(aqiWeather.ws * 3.6).toFixed(1)} km/h` },
                  { Icon: Gauge,       label: 'Pressure', val: `${aqiWeather.pr} hPa` },
                ]).map(({ Icon, label, val }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm">
                    <span className="text-secondary shrink-0"><Icon className="size-3.5" /></span>
                    <span className="text-muted-foreground">{label}</span>
                    <span className="ml-auto font-medium text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* DHT Sensor card */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
                <Thermometer className="size-4" />
                DHT Sensor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Temperature</span>
                  <span className="text-3xl font-bold text-foreground">
                    {dht.temperature.toFixed(1)}°{dht.temperature_unit}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Humidity</span>
                  <span className="text-3xl font-bold text-foreground">
                    {dht.humidity.toFixed(1)}{dht.humidity_unit}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Local sensor · GPIO D4 · DHT11
              </p>
            </CardContent>
          </Card>

          {/* PM Sensor card */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
                <Activity className="size-4" />
                Particulate Matter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                ['PM1.0', pm.pm1_0,  undefined],
                ['PM2.5', pm.pm2_5,  pm25Lvl],
                ['PM10',  pm.pm10,   undefined],
              ] as [string, number, ReturnType<typeof pm25Level> | undefined][]).map(([label, val, level]) => (
                <div key={label} className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
                    <div className="text-2xl font-semibold text-foreground">
                      {val}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{pm.unit}</span>
                    </div>
                  </div>
                  {level && (
                    <Badge
                      variant="outline"
                      className={`${level.bg} ${level.fg} border-0 font-medium mb-0.5`}
                    >
                      {level.label}
                    </Badge>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Local sensor · I2C Bus 1 · 0x19
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Comparison card */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-primary">
              Field Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Metric', 'OpenWeather', 'AQAir', 'Station', 'Δ vs OW'].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
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
                    <td className="py-3 font-medium text-foreground">Temperature</td>
                    <td className="py-3 text-right text-foreground">{ow.temp.toFixed(1)} °C</td>
                    <td className="py-3 text-right text-foreground">{aqiWeather.tp.toFixed(1)} °C</td>
                    <td className="py-3 text-right font-semibold text-foreground">{dht.temperature.toFixed(1)} °C</td>
                    <td className={`py-3 text-right font-semibold ${deltaClass(dht.temperature, ow.temp)}`}>
                      {signedDelta(dht.temperature, ow.temp)} °C
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-foreground">Humidity</td>
                    <td className="py-3 text-right text-foreground">{ow.humidity} %</td>
                    <td className="py-3 text-right text-foreground">{aqiWeather.hu} %</td>
                    <td className="py-3 text-right font-semibold text-foreground">{dht.humidity.toFixed(1)} %</td>
                    <td className={`py-3 text-right font-semibold ${deltaClass(dht.humidity, ow.humidity)}`}>
                      {signedDelta(dht.humidity, ow.humidity, 0)} %
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              † Unhealthy for sensitive groups: people with heart/lung disease, older adults, children.
              Station Δ is positive when the sensor reads higher than the OpenWeather forecast.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Polaris Sensor Station · Auto-refreshes every 5 minutes
        </p>
      </div>
    </div>
  );
}
