_From the series Stellar Guide_

# Polaris

Polaris is an IoT environmental monitoring system built for Granny's house. It reads temperature, humidity, and particulate matter from local sensors on a Raspberry Pi and surfaces the data through a local web dashboard enriched with live weather and air quality context from external APIs.

## Components

| Component                                        | Description                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [`polaris-sensor/`](polaris-sensor/)             | Python Flask REST API — reads hardware sensors and exposes JSON endpoints                   |
| [`polaris-localmonitor/`](polaris-localmonitor/) | React + TypeScript dashboard — displays sensor data alongside OpenWeatherMap and IQAir data |

## Quick Start

**Backend — on the Pi:**

```bash
cd polaris-sensor
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

**Frontend — on any machine on the same network:**

```bash
cd polaris-localmonitor
pnpm install
# configure .env (see polaris-localmonitor/README.md)
pnpm dev
```

## Deployment

`polaris-sensor` can be installed as a systemd service so it starts automatically on boot:

```bash
cd polaris-sensor
bash scripts/install-service.sh
```

See [`polaris-sensor/installation.md`](polaris-sensor/installation.md) for full setup details including I2C and GPIO prerequisites.
