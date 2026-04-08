import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Clock,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Wind,
  Activity,
  TrendingUp,
  Thermometer,
} from "lucide-react";
import { toast } from "sonner";
import { pm25ToAQI } from "@/lib/aqi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAirQuality,
  fetchDHT,
  fetchLocation,
  fetchPM,
  fetchWeather,
} from "@/store";
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCacheAge,
  getCachedStale,
  isCacheValid,
} from "@/store/cache";
import type { AirQualityResponse } from "@/types/AQI";
import type { OpenWeather } from "@/types/OpenWeather";
import type { DHTMonitor, Location, PMMonitor } from "@/types/StationAPI";

interface DashboardData {
  location: Location;
  weather: OpenWeather;
  airQuality: AirQualityResponse;
  pm: PMMonitor;
  dht: DHTMonitor;
}

function aqiLevel(aqi: number) {
  if (aqi <= 50)
    return {
      label: "Good",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      fg: "text-emerald-700 dark:text-emerald-400",
    };
  if (aqi <= 100)
    return {
      label: "Moderate",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      fg: "text-amber-700 dark:text-amber-400",
    };
  if (aqi <= 150)
    return {
      label: "Unhealthy (Sensitive)",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      fg: "text-orange-700 dark:text-orange-400",
    };
  if (aqi <= 200)
    return {
      label: "Unhealthy",
      bg: "bg-red-50 dark:bg-red-950/30",
      fg: "text-red-700 dark:text-red-400",
    };
  if (aqi <= 300)
    return {
      label: "Very Unhealthy",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      fg: "text-purple-700 dark:text-purple-400",
    };
  return {
    label: "Hazardous",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    fg: "text-rose-700 dark:text-rose-400",
  };
}

function signedDelta(a: number, b: number, decimals = 1): string {
  const d = a - b;
  return `${d >= 0 ? "+" : ""}${d.toFixed(decimals)}`;
}

function deltaClass(a: number, b: number, warn = 1, danger = 5): string {
  const d = Math.abs(a - b);
  if (d < warn) return "text-muted-foreground";
  if (d < danger) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function AQIBadge({
  value,
  className = "",
}: Readonly<{ value: number; className?: string }>) {
  const lvl = aqiLevel(value);
  return (
    <Badge
      variant="outline"
      className={`${lvl.bg} ${lvl.fg} border-0 font-semibold ${className}`}
    >
      {lvl.label}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20 p-8 md:p-16">
      <div className="max-w-7xl mx-auto space-y-10">
        <Skeleton className="h-40 w-full rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[0, 1].map((i) => (
            <Skeleton
              key={i}
              className="h-96 w-full rounded-3xl animate-pulse"
            />
          ))}
        </div>
        <Skeleton className="h-[500px] w-full rounded-3xl animate-pulse" />
      </div>
    </div>
  );
}

interface DataWarning {
  title: string;
  description: string;
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DataWarning[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async (force = false) => {
    const weatherWasCached =
      !force && isCacheValid(CACHE_KEYS.WEATHER, CACHE_TTL.EXTERNAL);

    setLoading(true);
    setError(null);
    setWarnings([]);

    const toastId = force ? toast.loading("Refreshing data…") : undefined;
    const newWarnings: DataWarning[] = [];

    try {
      let location: Location;
      try {
        location = await fetchLocation(force);
      } catch {
        const stale = getCachedStale<Location>(CACHE_KEYS.LOCATION);
        if (!stale)
          throw new Error(
            "Station unreachable and no cached location available",
          );
        newWarnings.push({
          title: "Station unreachable",
          description: "Showing cached location data",
        });
        location = stale;
      }

      const [weatherResult, airQualityResult, pmResult, dhtResult] =
        await Promise.allSettled([
          fetchWeather(location.latitude, location.longitude, force),
          fetchAirQuality(location.latitude, location.longitude, force),
          fetchPM(force),
          fetchDHT(force),
        ]);

      let weather: OpenWeather;
      if (weatherResult.status === "fulfilled") {
        weather = weatherResult.value;
      } else {
        const stale = getCachedStale<OpenWeather>(CACHE_KEYS.WEATHER);
        if (!stale)
          throw new Error("Weather data unavailable and no cached data found");
        newWarnings.push({
          title: "Weather API failed",
          description: "Showing cached weather data from earlier today",
        });
        weather = stale;
      }

      let airQuality: AirQualityResponse;
      if (airQualityResult.status === "fulfilled") {
        airQuality = airQualityResult.value;
      } else {
        const stale = getCachedStale<AirQualityResponse>(
          CACHE_KEYS.AIR_QUALITY,
        );
        if (!stale)
          throw new Error(
            "Air quality data unavailable and no cached data found",
          );
        newWarnings.push({
          title: "Air quality API failed",
          description: "Showing cached AQI data from earlier today",
        });
        airQuality = stale;
      }

      let pm: PMMonitor;
      if (pmResult.status === "fulfilled") {
        pm = pmResult.value;
      } else {
        const stale = getCachedStale<PMMonitor>(CACHE_KEYS.PM);
        if (!stale)
          throw new Error(
            "PM sensor data unavailable and no cached data found",
          );
        newWarnings.push({
          title: "PM sensor unreachable",
          description: "Showing cached sensor readings from earlier today",
        });
        pm = stale;
      }

      let dht: DHTMonitor;
      if (dhtResult.status === "fulfilled") {
        dht = dhtResult.value;
      } else {
        const stale = getCachedStale<DHTMonitor>(CACHE_KEYS.DHT);
        if (!stale)
          throw new Error(
            "DHT sensor data unavailable and no cached data found",
          );
        newWarnings.push({
          title: "DHT sensor unreachable",
          description: "Showing cached sensor readings from earlier today",
        });
        dht = stale;
      }

      setData({ location, weather, airQuality, pm, dht });
      setWarnings(newWarnings);
      setFromCache(weatherWasCached);
      setLastUpdated(getCacheAge(CACHE_KEYS.WEATHER) ?? new Date());

      if (toastId !== undefined) {
        if (newWarnings.length > 0) {
          toast.warning("Refreshed with some stale data", { id: toastId });
        } else {
          toast.success("Data refreshed", { id: toastId });
        }
      }
    } catch (err) {
      if (toastId !== undefined) toast.dismiss(toastId);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
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
      <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20 flex items-center justify-center p-8">
        <Card className="max-w-md w-full rounded-3xl border border-border/50 shadow-2xl backdrop-blur-xl bg-card/80">
          <CardContent className="flex flex-col items-center gap-8 py-20">
            <div className="rounded-full bg-destructive/10 p-8 animate-pulse">
              <AlertCircle className="size-16 text-destructive" />
            </div>
            <p className="text-center text-foreground font-medium text-lg max-w-xs">
              {error}
            </p>
            <Button
              onClick={() => fetchAll(true)}
              variant="outline"
              size="lg"
              className="rounded-full px-10 py-6 text-base font-medium transition-all hover:scale-105 hover:shadow-lg"
            >
              <RefreshCw className="size-5 mr-2" />
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
  const stationAQI = pm25ToAQI(pm.pm2_5);
  const latDir = location.latitude >= 0 ? "N" : "S";
  const lonDir = location.longitude >= 0 ? "E" : "W";
  const pollTime = new Date(aqi.ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20 p-8 md:p-16">
      <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-1000">
        {/* Header */}
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 p-4 backdrop-blur-sm border border-primary/10 animate-float">
                <Activity className="size-8 text-primary" />
              </div>
              <div>
                <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight">
                  Polaris
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Environmental Monitoring Station
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground pl-1">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                <span className="font-mono text-xs">
                  {Math.abs(location.latitude).toFixed(4)}°{latDir},{" "}
                  {Math.abs(location.longitude).toFixed(4)}°{lonDir}
                </span>
              </span>
              {lastUpdated && (
                <>
                  <span className="text-border">•</span>
                  <span className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0 text-primary" />
                    <span className="font-medium">
                      {lastUpdated.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {fromCache && (
                      <span className="opacity-60 text-xs">(cached)</span>
                    )}
                  </span>
                </>
              )}
              <span className="hidden sm:inline text-border">•</span>
              <span className="hidden sm:inline font-medium">
                {airQuality.data.city}, {airQuality.data.country}
              </span>
            </div>
          </div>
          <Button
            onClick={() => fetchAll(true)}
            variant="outline"
            size="lg"
            disabled={loading}
            className="shrink-0 rounded-full px-8 py-6 transition-all hover:scale-105 hover:shadow-lg border-border/50 backdrop-blur-sm"
          >
            <RefreshCw
              className={`size-5 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            <span className="font-semibold">
              {loading ? "Refreshing…" : "Refresh"}
            </span>
          </Button>
        </div>

        {/* Warnings */}
        {warnings.map((w) => (
          <Alert
            key={w.title}
            variant="destructive"
            className="rounded-2xl border-0 shadow-lg animate-in slide-in-from-top-2 duration-500 backdrop-blur-sm bg-destructive/5"
          >
            <AlertCircle className="size-5" />
            <AlertTitle className="text-base font-semibold">
              {w.title}
            </AlertTitle>
            <AlertDescription className="text-sm">
              {w.description}
            </AlertDescription>
          </Alert>
        ))}

        {/* Main Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Weather Card */}
          <Card className="rounded-3xl border border-border/50 shadow-xl backdrop-blur-xl bg-card/80 transition-all hover:shadow-2xl hover:scale-[1.02] duration-500 animate-in slide-in-from-left group overflow-hidden relative">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="pb-6 space-y-2 relative z-10">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2">
                  <Thermometer className="size-5 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Current Weather
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              <div className="flex items-start gap-6">
                {w && (
                  <div className="rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 p-4 backdrop-blur-sm">
                    <img
                      src={`https://openweathermap.org/img/wn/${w.icon}@4x.png`}
                      alt={w.description}
                      className="w-24 h-24"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-3">
                  <div className="text-7xl font-bold text-foreground tracking-tight">
                    {ow.temp.toFixed(1)}°
                  </div>
                  <div className="text-lg capitalize text-muted-foreground font-medium">
                    {w?.description ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Feels like {ow.feels_like.toFixed(1)}°C
                  </div>
                  <div className="text-xs text-muted-foreground mt-4 space-y-2 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span>Station</span>
                      <span className="font-semibold">
                        {dht.temperature.toFixed(1)}°C
                        <span
                          className={`ml-2 ${deltaClass(dht.temperature, ow.temp)}`}
                        >
                          {signedDelta(dht.temperature, ow.temp)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Humidity</span>
                      <span className="font-semibold">
                        {dht.humidity.toFixed(0)}%
                        <span
                          className={`ml-2 ${deltaClass(dht.humidity, ow.humidity, 2, 10)}`}
                        >
                          {signedDelta(dht.humidity, ow.humidity, 0)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {[
                  { Icon: Droplets, label: "Humidity", val: `${ow.humidity}%` },
                  {
                    Icon: Wind,
                    label: "Wind",
                    val: `${(weather.wind.speed * 3.6).toFixed(1)} km/h`,
                  },
                  {
                    Icon: Eye,
                    label: "Visibility",
                    val: `${(weather.visibility / 1000).toFixed(1)} km`,
                  },
                  { Icon: Gauge, label: "Pressure", val: `${ow.pressure} hPa` },
                ].map(({ Icon, label, val }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 text-sm p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300"
                  >
                    <span className="text-primary shrink-0">
                      <Icon className="size-5" />
                    </span>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground font-medium">
                        {label}
                      </div>
                      <div className="font-bold text-foreground text-base">
                        {val}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-2 font-medium">
                Source: OpenWeatherMap
              </p>
            </CardContent>
          </Card>

          {/* Air Quality Card */}
          <Card className="rounded-3xl border border-border/50 shadow-xl backdrop-blur-xl bg-card/80 transition-all hover:shadow-2xl hover:scale-[1.02] duration-500 animate-in slide-in-from-right group overflow-hidden relative">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="pb-6 space-y-2 relative z-10">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2">
                  <Wind className="size-5 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Air Quality
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              <div className="flex items-start gap-6">
                <div className="space-y-3">
                  <div className="text-7xl font-bold text-foreground tracking-tight">
                    {aqi.aqius}
                  </div>
                  <AQIBadge value={aqi.aqius} className="text-sm px-4 py-1.5" />
                </div>
                <div className="flex-1 space-y-3 pt-2">
                  <div className="text-base text-muted-foreground font-semibold">
                    US AQI Index
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Main pollutant:{" "}
                    <span className="font-semibold">
                      {aqi.mainus.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">
                    Measured at {pollTime}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM1.0
                  </span>
                  <span className="font-bold text-foreground text-base">
                    {pm.pm1_0}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {pm.unit}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM2.5
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground text-base">
                      {pm.pm2_5}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {pm.unit}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <AQIBadge value={stationAQI} className="text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM10
                  </span>
                  <span className="font-bold text-foreground text-base">
                    {pm.pm10}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {pm.unit}
                    </span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2 font-medium">
                Source: IQAir / AirVisual • Station: I2C 0x19
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Station Overview Card */}
        <Card className="rounded-3xl border border-border/50 shadow-xl backdrop-blur-xl bg-card/80 transition-all hover:shadow-2xl duration-500 animate-in slide-in-from-bottom group overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-8 space-y-2 relative z-10">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Station Overview
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-10 relative z-10">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
                Sensor Readings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    Temperature
                  </span>
                  <span className="font-bold text-foreground text-lg">
                    {dht.temperature.toFixed(1)} °{dht.temperature_unit}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    Humidity
                  </span>
                  <span className="font-bold text-foreground text-lg">
                    {dht.humidity.toFixed(1)} {dht.humidity_unit}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM1.0
                  </span>
                  <span className="font-bold text-foreground text-lg">
                    {pm.pm1_0} {pm.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM2.5
                  </span>
                  <span className="font-bold text-foreground text-lg">
                    {pm.pm2_5} {pm.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    PM10
                  </span>
                  <span className="font-bold text-foreground text-lg">
                    {pm.pm10} {pm.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 backdrop-blur-sm transition-all hover:from-muted/70 hover:to-muted/30 hover:scale-105 duration-300">
                  <span className="text-sm text-muted-foreground font-semibold">
                    Station AQI
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-lg">
                      {stationAQI}
                    </span>
                    <AQIBadge value={stationAQI} className="text-xs" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 font-medium">
                DHT11 • GPIO D4 • PM sensor • I2C Bus 1 • 0x19
              </p>
            </div>

            <Separator className="bg-border/50" />

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
                Atmospheric Comparison
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Metric", "OpenWeather", "Station", "Δ"].map((h, i) => (
                        <th
                          key={h}
                          className={`pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider ${
                            i === 0 ? "text-left w-32" : "text-right"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr className="transition-all hover:bg-muted/20">
                      <td className="py-4 font-semibold text-foreground">
                        Temperature
                      </td>
                      <td className="py-4 text-right text-foreground">
                        {ow.temp.toFixed(1)} °C
                      </td>
                      <td className="py-4 text-right font-bold text-foreground">
                        {dht.temperature.toFixed(1)} °C
                      </td>
                      <td
                        className={`py-4 text-right font-bold ${deltaClass(dht.temperature, ow.temp)}`}
                      >
                        {signedDelta(dht.temperature, ow.temp)} °C
                      </td>
                    </tr>
                    <tr className="transition-all hover:bg-muted/20">
                      <td className="py-4 font-semibold text-foreground">
                        Humidity
                      </td>
                      <td className="py-4 text-right text-foreground">
                        {ow.humidity} %
                      </td>
                      <td className="py-4 text-right font-bold text-foreground">
                        {dht.humidity.toFixed(1)} %
                      </td>
                      <td
                        className={`py-4 text-right font-bold ${deltaClass(dht.humidity, ow.humidity, 2, 10)}`}
                      >
                        {signedDelta(dht.humidity, ow.humidity, 0)} %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Separator className="bg-border/50" />

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
                Air Quality Comparison (US AQI)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Source", "AQI", "Level", "Δ"].map((h, i) => (
                        <th
                          key={h}
                          className={`pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider ${
                            i === 0 ? "text-left" : "text-right"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr className="transition-all hover:bg-muted/20">
                      <td className="py-4 font-semibold text-foreground">
                        AQAir
                      </td>
                      <td className="py-4 text-right text-foreground text-lg font-bold">
                        {aqi.aqius}
                      </td>
                      <td className="py-4 text-right">
                        <AQIBadge value={aqi.aqius} className="text-xs" />
                      </td>
                      <td className="py-4 text-right text-muted-foreground">
                        —
                      </td>
                    </tr>
                    <tr className="transition-all hover:bg-muted/20">
                      <td className="py-4 font-semibold text-foreground">
                        Station
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (PM2.5→EPA)
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-foreground text-lg">
                        {stationAQI}
                      </td>
                      <td className="py-4 text-right">
                        <AQIBadge value={stationAQI} className="text-xs" />
                      </td>
                      <td
                        className={`py-4 text-right font-bold ${deltaClass(stationAQI, aqi.aqius, 10, 30)}`}
                      >
                        {signedDelta(stationAQI, aqi.aqius, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
                Station AQI derived from raw PM2.5 (µg/m³) via EPA linear
                interpolation. Δ is positive when the station sensor reads
                higher pollution than AQAir reports.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
              {[
                {
                  label: "Good",
                  bg: "bg-emerald-50 dark:bg-emerald-950/30",
                  fg: "text-emerald-700 dark:text-emerald-400",
                },
                {
                  label: "Moderate",
                  bg: "bg-amber-50 dark:bg-amber-950/30",
                  fg: "text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Unhealthy (Sens.)",
                  bg: "bg-orange-50 dark:bg-orange-950/30",
                  fg: "text-orange-700 dark:text-orange-400",
                },
                {
                  label: "Unhealthy",
                  bg: "bg-red-50 dark:bg-red-950/30",
                  fg: "text-red-700 dark:text-red-400",
                },
                {
                  label: "Very Unhealthy",
                  bg: "bg-purple-50 dark:bg-purple-950/30",
                  fg: "text-purple-700 dark:text-purple-400",
                },
                {
                  label: "Hazardous",
                  bg: "bg-rose-50 dark:bg-rose-950/30",
                  fg: "text-rose-700 dark:text-rose-400",
                },
              ].map(({ label, bg, fg }) => (
                <span
                  key={label}
                  className={`text-xs px-4 py-2 rounded-full font-semibold ${bg} ${fg} transition-all hover:scale-105 duration-300`}
                >
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground pb-8 font-medium">
          Polaris Sensor Station
          {" • "}External data cached for 5 min • Sensor data cached for 1 min
          {" • "}Refresh forces new fetch
        </p>
      </div>
    </div>
  );
}
