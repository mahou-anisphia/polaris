# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Polaris** is an IoT environmental monitoring system targeting Raspberry Pi. It consists of two components:

- **`polaris-sensor/`** — Python Flask REST API that reads hardware sensors and exposes JSON endpoints
- **`polaris-localmonitor/`** — React + TypeScript + Vite web dashboard (early scaffold stage)

## Commands

### Frontend (`polaris-localmonitor/`)

```bash
pnpm dev        # Start Vite dev server (localhost:5173)
pnpm build      # TypeScript compile + Vite production build
pnpm lint       # ESLint
pnpm preview    # Preview production build
```

### Backend (`polaris-sensor/`)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/app.py   # Start Flask on 0.0.0.0:5000
```

## Architecture

### Backend (`polaris-sensor/`)

Flask app with a versioned Blueprint structure:

- `src/app.py` — Creates Flask app, registers `/polaris-sensor/api/v1` blueprints
- `src/controllers/v1/` — Route handlers; `pm25_controller.py` and `dht_controller.py`
- `src/services/` — Hardware interface layer; `pm25_service.py` (I2C bus 1, address `0x19`, reads registers `0x06–0x11` as little-endian uint16) and `dht_service.py` (GPIO pin D4, DHT11)
- `src/local_logger/aqi_logger.py` — Standalone CSV recorder (runs as separate systemd service)
- `data/` — CSV output directory (gitignored, created at runtime outside `src/`)

**API endpoints:**

- `GET /polaris-sensor/api/v1/pm` → `{ pm1_0, pm2_5, pm10, unit }`
- `GET /polaris-sensor/api/v1/dht` → `{ temperature, humidity, temperature_unit, humidity_unit }`

### Frontend (`polaris-localmonitor/`)

React 19 + TypeScript (strict mode) + Tailwind CSS v4 + Vite. Currently at scaffold/placeholder stage. ESLint uses the flat config format (`eslint.config.js`).

## Key Technical Notes

- **Deployment target**: Raspberry Pi with I2C and GPIO enabled (see `polaris-sensor/installation.md` for setup)
- **Package manager**: `pnpm` for the frontend
- **TypeScript**: Strict mode enforced; unused variables and parameters are errors
