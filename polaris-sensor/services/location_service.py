import requests

from logger import get_logger

_logger = get_logger("services.location")


def get_location():
    """Fetch approximate location via ipinfo.io and return latitude/longitude."""
    _logger.info("GET https://ipinfo.io/json")
    response = requests.get("https://ipinfo.io/json", timeout=5)
    response.raise_for_status()
    _logger.info("ipinfo.io response  status=%d", response.status_code)

    data = response.json()
    loc = data.get("loc", "")
    if not loc or "," not in loc:
        raise ValueError("Location data unavailable from ipinfo.io")

    lat_str, lon_str = loc.split(",", 1)
    result = {
        "latitude": float(lat_str),
        "longitude": float(lon_str),
    }
    _logger.info("Location parsed  lat=%s lon=%s", result["latitude"], result["longitude"])
    return result
