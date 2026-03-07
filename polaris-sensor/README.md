# polaris-sensor

Flask REST API that reads hardware sensors on a Raspberry Pi and exposes their data as JSON. Designed to run as a systemd service.

## Sensors

| Sensor       | Interface | Location       | Reads                 |
| ------------ | --------- | -------------- | --------------------- |
| DHT11        | GPIO      | Pin D4         | Temperature, humidity |
| PM2.5 sensor | I2C Bus 1 | Address `0x19` | PM1.0, PM2.5, PM10    |

## API Endpoints

All endpoints are prefixed with `/polaris-sensor/api/v1`.

| Method | Path        | Response                                                     |
| ------ | ----------- | ------------------------------------------------------------ |
| GET    | `/pm`       | `{ pm1_0, pm2_5, pm10, unit }`                               |
| GET    | `/dht`      | `{ temperature, humidity, temperature_unit, humidity_unit }` |
| GET    | `/location` | `{ latitude, longitude }`                                    |

### Example Responses

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

**GET /polaris-sensor/api/v1/location**

```json
{
  "latitude": 14.5995,
  "longitude": 120.9842
}
```

## Setup

Prerequisites: Raspberry Pi with I2C and GPIO enabled, Python 3.9+.

```bash
cd polaris-sensor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Enable I2C if not already active:

```bash
sudo raspi-config  # Interface Options → I2C → Enable
```

## Run

```bash
python src/app.py
```

Server starts on `http://0.0.0.0:5000`.

## Install as systemd Service

Installs and starts a systemd unit so the API runs on boot:

```bash
bash scripts/server/install-service.sh
```

Useful commands after install:

```bash
sudo systemctl status polaris-sensor
sudo journalctl -u polaris-sensor -f
```

To remove the service:

```bash
bash scripts/server/uninstall-service.sh
```
