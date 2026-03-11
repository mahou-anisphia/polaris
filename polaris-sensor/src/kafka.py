"""One-shot Kafka publisher — reads PM and DHT sensors once and publishes to Kafka topics."""

import json
import os
import socket
import sys
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from kafka import KafkaProducer

from logger import get_logger
from services.dht_service import read_dht
from services.pm25_service import read_pm

load_dotenv()

_logger = get_logger("kafka")


def resolve_location() -> tuple[float, float]:
    """Return (lat, lon) from .env if set, otherwise fall back to ipinfo.io lookup."""
    lat_str = os.getenv("STATION_LATITUDE")
    lon_str = os.getenv("STATION_LONGITUDE")

    if lat_str and lon_str:
        _logger.info("Location from .env  lat=%s lon=%s", lat_str, lon_str)
        return float(lat_str), float(lon_str)

    _logger.info("STATION_LATITUDE/STATION_LONGITUDE not set — falling back to ipinfo.io")
    resp = requests.get("https://ipinfo.io/json", timeout=5)
    resp.raise_for_status()
    loc = resp.json().get("loc", "")
    if not loc or "," not in loc:
        raise ValueError("Location data unavailable from ipinfo.io")
    lat, lon = loc.split(",", 1)
    _logger.info("Location from ipinfo.io  lat=%s lon=%s", lat, lon)
    return float(lat), float(lon)


def main() -> None:
    kafka_broker = os.getenv("KAFKA_BROKER")
    if not kafka_broker:
        _logger.error("KAFKA_BROKER not set in .env — cannot publish")
        sys.exit(1)

    hostname = socket.gethostname()
    _logger.info("Station hostname: %s", hostname)

    _logger.info("Resolving location...")
    try:
        lat, lon = resolve_location()
    except Exception as e:
        _logger.error("Failed to resolve location: %s", e, exc_info=True)
        sys.exit(1)

    _logger.info("Connecting to Kafka broker: %s", kafka_broker)
    try:
        producer = KafkaProducer(
            bootstrap_servers=[kafka_broker],
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
    except Exception as e:
        _logger.error("Failed to connect to Kafka: %s", e, exc_info=True)
        sys.exit(1)
    _logger.info("Kafka producer connected")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    common = {"timestamp": timestamp, "station": hostname, "latitude": lat, "longitude": lon}

    _logger.info("Reading PM sensor...")
    try:
        pm_data = read_pm()
    except Exception as e:
        _logger.error("PM sensor read failed: %s", e, exc_info=True)
        producer.close()
        sys.exit(1)

    pm_topic = f"polaris-{hostname}-pm"
    pm_message = {**pm_data, **common}
    producer.send(pm_topic, pm_message)
    _logger.info("Published to %s  pm1_0=%s pm2_5=%s pm10=%s", pm_topic, pm_data["pm1_0"], pm_data["pm2_5"], pm_data["pm10"])

    _logger.info("Reading DHT sensor...")
    try:
        dht_data = read_dht()
    except Exception as e:
        _logger.error("DHT sensor read failed: %s", e, exc_info=True)
        producer.flush()
        producer.close()
        sys.exit(1)

    dht_topic = f"polaris-{hostname}-dht"
    dht_message = {**dht_data, **common}
    producer.send(dht_topic, dht_message)
    _logger.info(
        "Published to %s  temperature=%s humidity=%s",
        dht_topic,
        dht_data["temperature"],
        dht_data["humidity"],
    )

    producer.flush()
    producer.close()
    _logger.info("Kafka publish cycle complete — exiting")


if __name__ == "__main__":
    main()
