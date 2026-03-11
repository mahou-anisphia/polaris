import time
import uuid

from flask import Flask, g
from flask import request as flask_request
from flask_cors import CORS

from controllers.v1.pm25_controller import pm25_bp
from controllers.v1.dht_controller import dht_bp
from controllers.v1.location_controller import location_bp
from controllers.v2.location_controller import location_v2_bp
from logger import get_logger

API_PREFIX = "/polaris-sensor/api"
V1_PREFIX = f"{API_PREFIX}/v1"
V2_PREFIX = f"{API_PREFIX}/v2"

_logger = get_logger("app")


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.register_blueprint(pm25_bp, url_prefix=V1_PREFIX)
    app.register_blueprint(dht_bp, url_prefix=V1_PREFIX)
    app.register_blueprint(location_bp, url_prefix=V1_PREFIX)
    app.register_blueprint(location_v2_bp, url_prefix=V2_PREFIX)

    @app.before_request
    def _before():
        g.request_id = uuid.uuid4().hex[:8]
        g.start_time = time.monotonic()
        _logger.info(
            "IN  %s %s  from=%s",
            flask_request.method,
            flask_request.path,
            flask_request.remote_addr,
        )

    @app.after_request
    def _after(response):
        elapsed_ms = (time.monotonic() - g.get("start_time", time.monotonic())) * 1000
        _logger.info(
            "OUT %s %s  status=%d  elapsed=%.1fms",
            flask_request.method,
            flask_request.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)
