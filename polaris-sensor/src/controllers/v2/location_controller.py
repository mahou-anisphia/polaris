import os

from dotenv import load_dotenv
from flask import Blueprint, jsonify

from logger import get_logger

load_dotenv()

location_v2_bp = Blueprint("location_v2", __name__)

_logger = get_logger("controllers.v2.location")


@location_v2_bp.route("/location", methods=["GET"])
def get_location_endpoint():
    """GET /polaris-sensor/api/v2/location — returns station lat/lon configured in .env."""
    lat_str = os.getenv("STATION_LATITUDE")
    lon_str = os.getenv("STATION_LONGITUDE")

    missing = [name for name, val in [("STATION_LATITUDE", lat_str), ("STATION_LONGITUDE", lon_str)] if not val]
    if missing:
        msg = f"Missing required environment variable(s): {', '.join(missing)}"
        _logger.error(msg)
        return jsonify({"error": msg}), 500

    try:
        latitude = float(lat_str)
        longitude = float(lon_str)
    except ValueError as e:
        msg = f"Invalid location value in .env: {e}"
        _logger.error(msg)
        return jsonify({"error": msg}), 500

    _logger.info("Location OK  lat=%s lon=%s", latitude, longitude)
    return jsonify({"latitude": latitude, "longitude": longitude})
