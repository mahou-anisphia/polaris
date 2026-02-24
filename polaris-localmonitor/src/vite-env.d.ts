/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AQAIR_API_KEY: string
  readonly VITE_AQAIR_API_ENDPOINT: string
  readonly VITE_OPENWEATHER_API_KEY: string
  readonly VITE_OPENWEATHER_API_ENDPOINT: string
  readonly VITE_STATION_API_ENDPOINT: string
  readonly VITE_STATION_API_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
