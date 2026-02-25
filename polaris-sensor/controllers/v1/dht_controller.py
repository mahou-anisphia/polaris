from flask import Blueprint, jsonify

from logger import get_logger
from services.dht_service import read_dht

dht_bp = Blueprint("dht", __name__)

_logger = get_logger("controllers.dht")


@dht_bp.route("/dht", methods=["GET"])
def get_dht():
    """GET /polaris-sensor/api/v1/dht — current temperature and humidity."""
    _logger.info("Reading DHT sensor")
    try:
        data = read_dht()
        _logger.info(
            "DHT sensor OK  temperature=%s%s  humidity=%s%s",
            data["temperature"],
            data["temperature_unit"],
            data["humidity"],
            data["humidity_unit"],
        )
        return jsonify(data)
    except Exception as e:
        _logger.error("DHT sensor read failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500
