from flask import Blueprint, jsonify

from logger import get_logger
from services.location_service import get_location

location_bp = Blueprint("location", __name__)

_logger = get_logger("controllers.location")


@location_bp.route("/location", methods=["GET"])
def get_location_endpoint():
    """GET /polaris-sensor/api/v1/location — approximate latitude and longitude via ipinfo.io."""
    _logger.info("Fetching location")
    try:
        data = get_location()
        _logger.info("Location OK  lat=%s lon=%s", data["latitude"], data["longitude"])
        return jsonify(data)
    except Exception as e:
        _logger.error("Location fetch failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500
