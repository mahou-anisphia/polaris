from flask import Blueprint, jsonify

from logger import get_logger
from services.pm25_service import read_pm

pm25_bp = Blueprint("pm25", __name__)

_logger = get_logger("controllers.pm25")


@pm25_bp.route("/pm", methods=["GET"])
def get_pm():
    """GET /polaris-sensor/api/v1/pm — current particulate matter readings."""
    _logger.info("Reading PM sensor")
    try:
        data = read_pm()
        _logger.info(
            "PM sensor OK  pm1_0=%s pm2_5=%s pm10=%s unit=%s",
            data["pm1_0"],
            data["pm2_5"],
            data["pm10"],
            data["unit"],
        )
        return jsonify(data)
    except Exception as e:
        _logger.error("PM sensor read failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500
