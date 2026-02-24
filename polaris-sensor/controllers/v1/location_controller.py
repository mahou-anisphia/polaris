from flask import Blueprint, jsonify

from services.location_service import get_location

location_bp = Blueprint("location", __name__)


@location_bp.route("/location", methods=["GET"])
def get_location_endpoint():
    """GET /polaris-sensor/api/v1/location — approximate latitude and longitude via ipinfo.io."""
    try:
        data = get_location()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
