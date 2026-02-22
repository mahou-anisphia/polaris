from flask import Blueprint, jsonify

from services.pm25_service import read_pm

pm25_bp = Blueprint("pm25", __name__)


@pm25_bp.route("/pm", methods=["GET"])
def get_pm():
    """GET /polaris-sensor/api/v1/pm — current particulate matter readings."""
    try:
        data = read_pm()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
