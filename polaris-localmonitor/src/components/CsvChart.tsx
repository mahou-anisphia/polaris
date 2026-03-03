import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, BarChart2, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CsvRow {
  ts: number;
  label: string;
  pm1_0: number;
  pm2_5: number;
  pm10: number;
  aqi_api: number;
  aqi_sensor: number;
}

interface HourlyPoint {
  hour: number;
  hourLabel: string;
  pm1_0: number;
  pm2_5: number;
  pm10: number;
  aqi_api: number;
  aqi_sensor: number;
  count: number;
}

interface InsightsData {
  count: number;
  stats: Record<string, { min: number; max: number; avg: number }>;
  peak: { value: number; label: string };
  aqiDist: Array<{ label: string; count: number; pct: number; fg: string; bg: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERIES = [
  { key: 'pm1_0'      as const, label: 'PM1.0',        color: '#818cf8', axis: 'pm'  as const },
  { key: 'pm2_5'      as const, label: 'PM2.5',        color: '#fbbf24', axis: 'pm'  as const },
  { key: 'pm10'       as const, label: 'PM10',         color: '#34d399', axis: 'pm'  as const },
  { key: 'aqi_api'    as const, label: 'AQI (API)',    color: '#60a5fa', axis: 'aqi' as const },
  { key: 'aqi_sensor' as const, label: 'AQI (Sensor)', color: '#f87171', axis: 'aqi' as const },
];

type SeriesKey = typeof SERIES[number]['key'];

const AQI_BANDS = [
  { label: 'Good',              max: 50,       fg: 'text-green-700',  bg: 'bg-green-100'  },
  { label: 'Moderate',          max: 100,      fg: 'text-amber-700',  bg: 'bg-amber-100'  },
  { label: 'Unhealthy (Sens.)', max: 150,      fg: 'text-orange-700', bg: 'bg-orange-100' },
  { label: 'Unhealthy',         max: 200,      fg: 'text-red-700',    bg: 'bg-red-100'    },
  { label: 'Very Unhealthy',    max: 300,      fg: 'text-purple-700', bg: 'bg-purple-100' },
  { label: 'Hazardous',         max: Infinity, fg: 'text-rose-800',   bg: 'bg-rose-200'   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a UTC unix-ms timestamp to a short local-time label.
 * JS Date methods always render in the browser's local timezone,
 * so no manual offset math is needed here.
 */
function utcToLocal(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Converts a UTC unix-ms timestamp to the string format expected by
 * <input type="datetime-local"> (local time, no timezone suffix).
 */
function toInputValue(ts: number): string {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const EXPECTED_HEADER = 'timestamp_utc,pm1_0,pm2_5,pm10,aqi_api,aqi_sensor';

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  const rows: CsvRow[] = [];

  const header = lines[0]?.trim().toLowerCase().replaceAll(' ', '');
  if (header !== EXPECTED_HEADER) {
    const got = (lines[0]?.trim() ?? '(empty)').slice(0, 80);
    throw new Error(
      `Unexpected CSV format.\nExpected: ${EXPECTED_HEADER}\nGot: ${got}${(lines[0]?.length ?? 0) > 80 ? '…' : ''}`,
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(',');
    if (cols.length < 6) continue;

    const ts = Date.parse(cols[0].trim());
    if (Number.isNaN(ts)) continue;

    rows.push({
      ts,
      label:      utcToLocal(ts),
      pm1_0:      Number(cols[1]),
      pm2_5:      Number(cols[2]),
      pm10:       Number(cols[3]),
      aqi_api:    Number(cols[4]),
      aqi_sensor: Number(cols[5]),
    });
  }

  return rows.sort((a, b) => a.ts - b.ts);
}

function computeHourlyPattern(rows: CsvRow[]): HourlyPoint[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    sums: { pm1_0: 0, pm2_5: 0, pm10: 0, aqi_api: 0, aqi_sensor: 0 } as Record<SeriesKey, number>,
    count: 0,
  }));

  for (const row of rows) {
    const h = new Date(row.ts).getHours(); // local hour
    buckets[h].count++;
    for (const s of SERIES) buckets[h].sums[s.key] += row[s.key];
  }

  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      hour:       b.hour,
      hourLabel:  new Date(0, 0, 0, b.hour).toLocaleTimeString([], { hour: 'numeric', hour12: true }),
      pm1_0:      round1(b.sums.pm1_0      / b.count),
      pm2_5:      round1(b.sums.pm2_5      / b.count),
      pm10:       round1(b.sums.pm10       / b.count),
      aqi_api:    round1(b.sums.aqi_api    / b.count),
      aqi_sensor: round1(b.sums.aqi_sensor / b.count),
      count:      b.count,
    }));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function accumulateSeriesStats(rows: CsvRow[]) {
  const sums: Record<string, number> = {};
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  for (const s of SERIES) { sums[s.key] = 0; mins[s.key] = Infinity; maxs[s.key] = -Infinity; }
  for (const row of rows) {
    for (const s of SERIES) {
      const v = row[s.key];
      sums[s.key] += v;
      if (v < mins[s.key]) mins[s.key] = v;
      if (v > maxs[s.key]) maxs[s.key] = v;
    }
  }
  return { sums, mins, maxs };
}

function countAqiBands(rows: CsvRow[]): number[] {
  const counts = AQI_BANDS.map(() => 0);
  for (const row of rows) {
    const i = AQI_BANDS.findIndex((b) => row.aqi_sensor <= b.max);
    if (i !== -1) counts[i]++;
  }
  return counts;
}

function computeInsights(rows: CsvRow[]): InsightsData | null {
  if (rows.length === 0) return null;

  const { sums, mins, maxs } = accumulateSeriesStats(rows);
  const stats: Record<string, { min: number; max: number; avg: number }> = {};
  for (const s of SERIES) {
    stats[s.key] = { min: mins[s.key], max: maxs[s.key], avg: round1(sums[s.key] / rows.length) };
  }

  const peakRow  = rows.reduce((best, r) => (r.aqi_sensor > best.aqi_sensor ? r : best), rows[0]);
  const bandCounts = countAqiBands(rows);

  const aqiDist = AQI_BANDS.map((b, i) => ({
    label: b.label,
    count: bandCounts[i],
    pct:   Math.round((bandCounts[i] / rows.length) * 100),
    fg:    b.fg,
    bg:    b.bg,
  })).filter((d) => d.count > 0);

  return { count: rows.length, stats, peak: { value: peakRow.aqi_sensor, label: peakRow.label }, aqiDist };
}

// ── Insights panel ────────────────────────────────────────────────────────────

const KEY_METRICS = [
  { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³', color: '#fbbf24' },
  { key: 'pm10',  label: 'PM10',  unit: 'µg/m³', color: '#34d399' },
  { key: 'aqi_sensor', label: 'AQI (Sensor)', unit: '', color: '#f87171' },
] as const;

function InsightsPanel({ data }: Readonly<{ data: InsightsData }>) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Insights · {data.count} readings
      </p>

      {/* Stat mini-cards */}
      <div className="grid grid-cols-3 gap-2">
        {KEY_METRICS.map(({ key, label, unit, color }) => {
          const s = data.stats[key];
          return (
            <div key={key} className="bg-card rounded-lg p-2 space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <div className="text-base font-bold text-foreground leading-snug">
                {s.avg}
                {unit && (
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.min}–{s.max}
              </div>
            </div>
          );
        })}
      </div>

      {/* Peak event */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="text-muted-foreground">Peak AQI (sensor):</span>
        <span className="font-semibold text-foreground">{data.peak.value}</span>
        <span className="text-muted-foreground">at {data.peak.label}</span>
      </div>

      {/* AQI distribution */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">AQI distribution (sensor)</p>
        <div className="flex h-2.5 rounded-full overflow-hidden w-full gap-px">
          {data.aqiDist.map((d) => (
            <div
              key={d.label}
              className={d.bg}
              style={{ flex: d.count }}
              title={`${d.label}: ${d.count} readings (${d.pct}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {data.aqiDist.map((d) => (
            <span key={d.label} className={`text-xs ${d.fg}`}>
              {d.label} {d.pct}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chart shared config ───────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--foreground)',
};

const CHART_LABEL_STYLE = { fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' };

// ── Main component ────────────────────────────────────────────────────────────

export function CsvChart() {
  const [rows, setRows]             = useState<CsvRow[]>([]);
  const [filename, setFilename]     = useState('');
  const [dragging, setDragging]     = useState(false);
  const [visible, setVisible]       = useState<Set<SeriesKey>>(new Set(SERIES.map((s) => s.key)));
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd,   setRangeEnd]   = useState('');
  const [view, setView]           = useState<'series' | 'hourly'>('series');
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File loading ───────────────────────────────────────────────────────────

  const load = useCallback(async (file: File) => {
    try {
      const text   = await file.text();
      const parsed = parseCSV(text);
      setLoadError(null);
      setFilename(file.name);
      setRows(parsed);
      if (parsed.length > 0) {
        setRangeStart(toInputValue(parsed[0].ts));
        setRangeEnd(toInputValue((parsed.at(-1) ?? parsed[0]).ts));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to parse file');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) load(file);
    },
    [load],
  );

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const start = rangeStart ? new Date(rangeStart).getTime() : -Infinity;
    const end   = rangeEnd   ? new Date(rangeEnd).getTime()   :  Infinity;
    return rows.filter((r) => r.ts >= start && r.ts <= end);
  }, [rows, rangeStart, rangeEnd]);

  const hourlyData = useMemo(() => computeHourlyPattern(filtered), [filtered]);
  const insights   = useMemo(() => computeInsights(filtered), [filtered]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetRange = useCallback(() => {
    if (rows.length > 0) {
      setRangeStart(toInputValue(rows[0].ts));
      setRangeEnd(toInputValue((rows.at(-1) ?? rows[0]).ts));
    }
  }, [rows]);

  const toggleSeries = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearData = () => {
    setRows([]);
    setFilename('');
    setRangeStart('');
    setRangeEnd('');
    setView('series');
  };

  // ── Dropzone ───────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
            <BarChart2 className="size-4" />
            Historical Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Drop a CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse · columns:{' '}
                <span className="font-mono">
                  timestamp_utc, pm1_0, pm2_5, pm10, aqi_api, aqi_sensor
                </span>
              </p>
            </div>
            {loadError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-left w-full max-w-sm overflow-hidden">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive whitespace-pre-wrap break-all">{loadError}</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }}
            />
          </button>
        </CardContent>
      </Card>
    );
  }

  // ── Chart card ─────────────────────────────────────────────────────────────

  const isHourly  = view === 'hourly';
  const chartData = isHourly ? hourlyData : filtered;
  const xKey      = isHourly ? 'hourLabel' : 'label';

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
            <BarChart2 className="size-4" />
            Historical Data
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{filename}</span>
            <Badge variant="outline" className="text-xs">
              {filtered.length} / {rows.length} pts
            </Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearData}>
              <X className="size-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Controls ── */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">

            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
              {(['series', 'hourly'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 font-medium transition-colors ${
                    view === v
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {v === 'series' ? 'Time Series' : 'Hourly Pattern'}
                </button>
              ))}
            </div>

            {/* Series toggles */}
            <div className="flex flex-wrap gap-1.5">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  style={{ borderColor: s.color, color: s.color, background: `${s.color}22` }}
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-medium transition-opacity ${
                    visible.has(s.key) ? 'opacity-100' : 'opacity-25'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range — time series only */}
          {!isHourly && (
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-muted-foreground">From</span>
              <input
                type="datetime-local"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="datetime-local"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
              />
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={resetRange}>
                Reset
              </Button>
            </div>
          )}
        </div>

        {/* ── Insights ── */}
        {insights && <InsightsPanel data={insights} />}

        {/* ── Chart ── */}
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={isHourly ? 20 : 80}
            />
            <YAxis
              yAxisId="pm"
              orientation="left"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{
                value: 'µg/m³',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                style: { fontSize: 9, fill: 'var(--muted-foreground)' },
              }}
            />
            <YAxis
              yAxisId="aqi"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{
                value: 'AQI',
                angle: 90,
                position: 'insideRight',
                offset: 12,
                style: { fontSize: 9, fill: 'var(--muted-foreground)' },
              }}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_LABEL_STYLE}
            />

            {/* Brush — time series only */}
            {!isHourly && (
              <Brush
                dataKey="label"
                height={24}
                stroke="var(--border)"
                fill="var(--muted)"
                travellerWidth={8}
              />
            )}

            {/* PM series: bars in hourly view, lines in time series */}
            {SERIES.filter((s) => s.axis === 'pm' && visible.has(s.key)).map((s) =>
              isHourly ? (
                <Bar
                  key={s.key}
                  yAxisId="pm"
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  fillOpacity={0.75}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  yAxisId="pm"
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ),
            )}

            {/* AQI series — always lines */}
            {SERIES.filter((s) => s.axis === 'aqi' && visible.has(s.key)).map((s) => (
              <Line
                key={s.key}
                yAxisId="aqi"
                type={isHourly ? 'linear' : 'monotone'}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={isHourly ? 2 : 1.5}
                dot={isHourly ? { r: 3, fill: s.color } : false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        <p className="text-xs text-muted-foreground">
          {isHourly
            ? `Averages per hour of local time across ${filtered.length} readings · bars: PM (µg/m³) · lines: AQI`
            : 'Drag the brush handles below the chart to zoom · all times in local timezone · left: PM (µg/m³) · right: AQI'}
        </p>

      </CardContent>
    </Card>
  );
}
