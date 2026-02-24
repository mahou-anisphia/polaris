# polaris-localmonitor

Local web dashboard for the Polaris sensor station. Pulls live readings from `polaris-sensor` and enriches them with external weather and air quality data.

## Tech Stack

- React 19 + TypeScript (strict)
- Vite 7
- Tailwind CSS v4
- shadcn/ui + Radix UI
- lucide-react
- axios

## Dashboard Cards

| Card                 | Data shown                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Current Weather**  | OpenWeatherMap temperature, conditions, humidity, wind, visibility, pressure — plus DHT11 sensor readings as inline comparison |
| **Air Quality**      | IQAir US AQI + main pollutant — plus station PM1.0 / PM2.5 / PM10 with computed station AQI                                    |
| **Station Overview** | All raw sensor readings (DHT11 + PM) followed by field comparison tables (station vs API for temperature, humidity, and AQI)   |

## Environment Variables

Create a `.env` file in `polaris-localmonitor/`:

```env
VITE_STATION_API_ENDPOINT=<pi-ip-address>
VITE_STATION_API_PORT=5000

VITE_OPENWEATHER_API_ENDPOINT=api.openweathermap.org
VITE_OPENWEATHER_API_KEY=<your-key>

VITE_AQAIR_API_ENDPOINT=api.airvisual.com
VITE_AQAIR_API_KEY=<your-key>
```

## Commands

```bash
pnpm dev        # Start dev server on localhost:5173
pnpm build      # TypeScript check + production build
pnpm lint       # ESLint
pnpm preview    # Serve production build locally
```

## Data & Caching

| Source                   | Cache TTL |
| ------------------------ | --------- |
| OpenWeatherMap, IQAir    | 5 minutes |
| polaris-sensor (PM, DHT) | 1 minute  |
| Station location         | 1 minute  |

Refresh button forces a new fetch bypassing the cache.

## Adding shadcn Components

```bash
pnpm shadcn:add <component-name>
```

## Docker

> **Important:** Vite bakes `VITE_*` variables into the static bundle **at build time**. They cannot be changed after the image is built — you must pass them as `--build-arg` flags during `docker build`.

### Build the image

```bash
docker build \
  --build-arg VITE_STATION_API_ENDPOINT=<pi-ip-address> \
  --build-arg VITE_STATION_API_PORT=5000 \
  --build-arg VITE_OPENWEATHER_API_ENDPOINT=api.openweathermap.org \
  --build-arg VITE_OPENWEATHER_API_KEY=<your-key> \
  --build-arg VITE_AQAIR_API_ENDPOINT=api.airvisual.com \
  --build-arg VITE_AQAIR_API_KEY=<your-key> \
  -t polaris-localmonitor \
  .
```

To avoid repeating all flags you can source your `.env` file and pass its values inline:

```bash
export $(grep -v '^#' .env | xargs) && docker build \
  --build-arg VITE_STATION_API_ENDPOINT \
  --build-arg VITE_STATION_API_PORT \
  --build-arg VITE_OPENWEATHER_API_ENDPOINT \
  --build-arg VITE_OPENWEATHER_API_KEY \
  --build-arg VITE_AQAIR_API_ENDPOINT \
  --build-arg VITE_AQAIR_API_KEY \
  -t polaris-localmonitor \
  .
```

*(When a `--build-arg` is given without `=value`, Docker reads it from the current shell environment.)*

### Run the container

The built image serves the static files on port 80 via nginx. Map it to any host port:

```bash
docker run -d -p 8080:80 --name polaris-localmonitor polaris-localmonitor
```

Dashboard is then available at `http://localhost:8080`.
