/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUBBLE_API_ENDPOINT: string
  readonly VITE_HUBBLE_API_PORT: string
  readonly VITE_STATION_API_ENDPOINT: string
  readonly VITE_STATION_API_PORT: string
  readonly VITE_FALLBACK_STATION_LATITUDE?: string
  readonly VITE_FALLBACK_STATION_LONGITUDE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
