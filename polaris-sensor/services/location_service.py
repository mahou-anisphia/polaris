import requests


def get_location():
    """Fetch approximate location via ipinfo.io and return latitude/longitude."""
    response = requests.get("https://ipinfo.io/json", timeout=5)
    response.raise_for_status()
    data = response.json()

    loc = data.get("loc", "")
    if not loc or "," not in loc:
        raise ValueError("Location data unavailable from ipinfo.io")

    lat_str, lon_str = loc.split(",", 1)
    return {
        "latitude": float(lat_str),
        "longitude": float(lon_str),
    }
