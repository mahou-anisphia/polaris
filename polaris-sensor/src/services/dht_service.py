import adafruit_dht
import board

from logger import get_logger

_sensor = adafruit_dht.DHT11(board.D4)

_logger = get_logger("services.dht")


def read_dht():
    """Read temperature and humidity from the DHT11 sensor on GPIO pin D4."""
    _logger.info("Reading DHT11 on pin D4")
    try:
        temperature = _sensor.temperature
        humidity = _sensor.humidity
        _logger.info(
            "DHT11 read OK  temperature=%s°C  humidity=%s%%", temperature, humidity
        )
        return {
            "temperature": temperature,
            "humidity": humidity,
            "temperature_unit": "°C",
            "humidity_unit": "%",
        }
    except Exception as e:
        _logger.error("DHT11 read error: %s", e, exc_info=True)
        raise
