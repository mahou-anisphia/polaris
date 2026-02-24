# Polaris Sensor — Installation

## Prerequisites

- Raspberry Pi (or compatible SBC) with GPIO and I2C enabled
- Python 3.9+
- I2C enabled (`sudo raspi-config` → Interface Options → I2C → Enable)
- DHT11 sensor wired to GPIO pin D4
- PM2.5 sensor on I2C bus 1 at address `0x19`

## Setup

```bash
cd polaris-sensor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

The server starts on `http://0.0.0.0:5000`.

## Endpoints

| Method | Path                              | Description                 |
| ------ | --------------------------------- | --------------------------- |
| GET    | `/polaris-sensor/api/v1/pm`       | PM1.0, PM2.5, PM10 readings |
| GET    | `/polaris-sensor/api/v1/dht`      | Temperature and humidity    |
| GET    | `/polaris-sensor/api/v1/location` | Station location            |

## Example responses

**GET /polaris-sensor/api/v1/pm**

```json
{
  "pm1_0": 72,
  "pm2_5": 107,
  "pm10": 113,
  "unit": "μg/m³"
}
```

**GET /polaris-sensor/api/v1/dht**

```json
{
  "temperature": 28,
  "humidity": 65,
  "temperature_unit": "°C",
  "humidity_unit": "%"
}
```
