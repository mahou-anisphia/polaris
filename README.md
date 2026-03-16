_From the series "Stellar Guide"_

# Polaris 🌟

> _The fixed point in the sky — steady, quiet, always watching._

A hardware-anchored environmental sensor station, built on Flask and Python, running on a Raspberry Pi. Polaris sits at the edge of your world, reading the air, measuring the warmth, and sending what it knows downstream — to anyone listening.

## 🌌 Philosophy

> _Polaris: The North Star. It doesn't move. Everything else orients around it._

Most services depend on someone asking. Polaris doesn't wait to be asked. It wakes, it reads, it publishes — then it sleeps again, leaving no process behind. Cron calls it. Kafka carries its words. [Hubble](https://github.com/mahou-anisphia/hubble.git) enriches what it saw.

It's built for the reality of hardware: sensors flicker, networks hiccup, config drifts. So each layer degrades on its own terms. The Flask API keeps serving if one sensor fails. The dashboard falls back to stale cache if the edge node goes quiet. Location resolves from `.env` — and if that's missing, from the sky itself.

The two things it actually needs are a sensor and a Pi. Everything else is optional infrastructure.

**Built on [Flask](https://flask.palletsprojects.com/) and Python, rooted to the earth.**

## ✨ Features

- 🌫 **Particulate matter** — PM1.0, PM2.5, PM10 via I2C PM sensor (`/api/v1/pm`)
- 🌡 **Temperature & humidity** — via DHT11 GPIO sensor (`/api/v1/dht`)
- 📍 **Station location** — coordinate-pinned or IP-resolved fallback (`/api/v1/location`, `/api/v2/location`)
- 📡 **Kafka publishing** — one-shot, cron-triggered push to `polaris-[hostname]-pm` / `polaris-[hostname]-dht`
- 🔇 **Independent sensor failure** — a dead sensor returns HTTP 500 on its endpoint only; the station keeps running
- 🔭 **Hubble-aware** — designed alongside [Hubble](https://github.com/mahou-anisphia/hubble.git), a shared service that wraps every external API (OpenWeather, IQAir); sensor truth from Polaris, sky context from Hubble

## 🚀 Getting Started

```bash
git clone https://github.com/mahou-anisphia/polaris.git
cd polaris-sensor
python3 -m venv .venv --system-site-packages
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in your coordinates and keys
python src/app.py
```

Service starts at `http://0.0.0.0:5000`.

## 🛰 Install as a Service

Installs and starts a systemd unit so the station runs from boot:

```bash
bash scripts/server/install-service.sh
```

```bash
sudo systemctl status polaris-sensor
sudo journalctl -u polaris-sensor -f
```

## 📡 Kafka Publishing

Polaris publishes one-shot via cron — no long-running process, no scheduler drift:

```bash
# Run manually
python src/kafka.py

# Or schedule it — example: every 5 minutes
*/5 * * * * /path/to/.venv/bin/python /path/to/src/kafka.py
```

Each publish cycle emits two messages, to two independent topics:

| Topic                    | Contains                                           |
| ------------------------ | -------------------------------------------------- |
| `polaris-[hostname]-pm`  | PM1.0, PM2.5, PM10, timestamp, station, lat/lon    |
| `polaris-[hostname]-dht` | temperature, humidity, timestamp, station, lat/lon |

Hostname is resolved at runtime via `socket.gethostname()`. Topics are named per-station, so multiple Polaris nodes can publish to the same broker without collision.

> **On failure:** if the PM read fails, the cycle exits before DHT runs. If PM succeeds but DHT fails, the PM message is already on the wire. Either way, the next cron tick tries again from scratch.

## 🌍 Hardware

| Sensor       | Interface | Location       | Reads                 |
| ------------ | --------- | -------------- | --------------------- |
| DHT11        | GPIO      | Pin D4         | Temperature, humidity |
| PM2.5 sensor | I2C Bus 1 | Address `0x19` | PM1.0, PM2.5, PM10    |

Enable I2C if not already active:

```bash
sudo raspi-config   # Interface Options → I2C → Enable
```

## 🔭 API

All endpoints are prefixed with `/polaris-sensor/api`.

```
GET  /v1/pm          → { pm1_0, pm2_5, pm10, unit }
GET  /v1/dht         → { temperature, humidity, temperature_unit, humidity_unit }
GET  /v1/location    → { latitude, longitude }   # IP-resolved fallback if .env unset

GET  /v2/location    → { latitude, longitude }   # .env required; HTTP 500 if unset
```

Sensor endpoints fail independently — a 500 on `/dht` does not affect `/pm`, and the Flask process stays up either way.

## 🌌 Environment

See [`.env.example`](.env.example) for the full reference. Each component reads only the variables it needs.

| Variable                                 | Purpose                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `STATION_LATITUDE` / `STATION_LONGITUDE` | Station coordinates — required for `/v2/location`; Kafka falls back to ipinfo.io if unset |
| `KAFKA_BROKER`                           | Kafka publish destination — Kafka publishing disabled if absent                           |
| `AQAIR_API_KEY` / `AQAIR_API_ENDPOINT`   | AQI logger (legacy, in-flight deprecated)                                                 |

## 🌠 In the Stellar Guide

Polaris is the ground station. It reads the physical world and names what it finds.

[Hubble](https://github.com/mahou-anisphia/hubble.git) is a shared service — a wrapper for every external API. It orbits above, fetching weather and AQI from OpenWeather and IQAir, caching what it saw with Redis, publishing downstream to Kafka. It doesn't know about sensors. Polaris doesn't know about APIs. They don't need to.

The dashboard (`polaris-localmonitor`) queries both — sensor truth from Polaris, sky context from Hubble — and joins them in the UI. For the streaming pipeline, both publish to Kafka independently; consumers join at query time.

Two origins. Different cadences. Different failure modes. Neither waiting on the other.
