from flask import Blueprint, jsonify

from services.dht_service import read_dht

dht_bp = Blueprint("dht", __name__)


@dht_bp.route("/dht", methods=["GET"])
def get_dht():
    """GET /polaris-sensor/api/v1/dht — current temperature and humidity."""
    try:
        data = read_dht()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
