"""Standalone AQI logger — reads local PM sensor + AQAir API every 5 minutes, writes to CSV."""

import csv
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from logger import get_logger
from services.pm25_service import read_pm

load_dotenv()

AQAIR_API_KEY = os.getenv("AQAIR_API_KEY")
AQAIR_API_ENDPOINT = os.getenv("AQAIR_API_ENDPOINT", "api.airvisual.com")

INTERVAL_SECONDS = 5 * 60
# data/ lives at the polaris-sensor root, one level above this file's directory
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA_DIR / "aqi_log.csv"
CSV_COLUMNS = ["timestamp_utc", "pm1_0", "pm2_5", "pm10", "aqi_api", "aqi_sensor"]

# EPA PM2.5 breakpoints: (c_low, c_high, aqi_low, aqi_high)
_BREAKPOINTS = [
    (0.0, 12.0, 0, 50),
    (12.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 150.4, 151, 200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500),
]

_logger = get_logger("local_logger")


def pm25_to_aqi(pm25: float) -> int:
    """Convert PM2.5 µg/m³ to US AQI using EPA linear interpolation."""
    c = math.floor(pm25 * 10) / 10  # EPA truncates, does not round
    if c > 500.4:
        return 500
    for c_low, c_high, aqi_low, aqi_high in _BREAKPOINTS:
        if c_low <= c <= c_high:
            return round((aqi_high - aqi_low) / (c_high - c_low) * (c - c_low) + aqi_low)
    return 0


def get_location() -> tuple[float, float]:
    """Fetch approximate lat/lon via ipinfo.io."""
    resp = requests.get("https://ipinfo.io/json", timeout=5)
    resp.raise_for_status()
    loc = resp.json().get("loc", "")
    if not loc or "," not in loc:
        raise ValueError("Location data unavailable from ipinfo.io")
    lat, lon = loc.split(",", 1)
    return float(lat), float(lon)


def fetch_api_aqi(lat: float, lon: float) -> int | None:
    """Call AQAir (AirVisual) API and return the US AQI value."""
    if not AQAIR_API_KEY:
        _logger.warning("AQAIR_API_KEY not set, skipping API AQI")
        return None
    resp = requests.get(
        f"https://{AQAIR_API_ENDPOINT}/v2/nearest_city",
        params={"lat": lat, "lon": lon, "key": AQAIR_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["data"]["current"]["pollution"]["aqius"]


def ensure_csv() -> None:
    """Create data directory and CSV with header if they don't exist."""
    DATA_DIR.mkdir(exist_ok=True)
    if not CSV_PATH.exists():
        with open(CSV_PATH, "w", newline="") as f:
            csv.writer(f).writerow(CSV_COLUMNS)


def append_row(row: dict) -> None:
    """Append a single row to the CSV."""
    with open(CSV_PATH, "a", newline="") as f:
        csv.DictWriter(f, fieldnames=CSV_COLUMNS).writerow(row)


def collect_once(lat: float, lon: float) -> None:
    """Run one collection cycle: read sensor, call API, write CSV row."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    pm = read_pm()
    aqi_sensor = pm25_to_aqi(pm["pm2_5"])

    try:
        aqi_api = fetch_api_aqi(lat, lon)
    except Exception as e:
        _logger.warning("AQAir API error: %s", e)
        aqi_api = None

    row = {
        "timestamp_utc": ts,
        "pm1_0": pm["pm1_0"],
        "pm2_5": pm["pm2_5"],
        "pm10": pm["pm10"],
        "aqi_api": aqi_api if aqi_api is not None else "",
        "aqi_sensor": aqi_sensor,
    }
    append_row(row)
    _logger.info(
        "Recorded  PM2.5=%s  AQI(sensor)=%s  AQI(api)=%s",
        pm["pm2_5"],
        aqi_sensor,
        aqi_api,
    )


def main() -> None:
    ensure_csv()
    _logger.info("AQI logger started. Recording to %s", CSV_PATH)

    lat, lon = get_location()
    _logger.info("Location resolved  lat=%s lon=%s", lat, lon)

    while True:
        try:
            collect_once(lat, lon)
        except Exception as e:
            _logger.error("Collection cycle failed: %s", e, exc_info=True)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
