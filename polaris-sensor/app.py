from flask import Flask

from controllers.v1.pm25_controller import pm25_bp
from controllers.v1.dht_controller import dht_bp
from controllers.v1.location_controller import location_bp

API_PREFIX = "/polaris-sensor/api"
V1_PREFIX = f"{API_PREFIX}/v1"


def create_app():
    app = Flask(__name__)

    app.register_blueprint(pm25_bp, url_prefix=V1_PREFIX)
    app.register_blueprint(dht_bp, url_prefix=V1_PREFIX)
    app.register_blueprint(location_bp, url_prefix=V1_PREFIX)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)
