import adafruit_dht
import board

_sensor = adafruit_dht.DHT11(board.D4)


def read_dht():
    """Read temperature and humidity from the DHT11 sensor on GPIO pin D4."""
    temperature = _sensor.temperature
    humidity = _sensor.humidity

    return {
        "temperature": temperature,
        "humidity": humidity,
        "temperature_unit": "°C",
        "humidity_unit": "%",
    }
