#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="polaris-aqi-logger"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Resolve the polaris-sensor directory (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VENV_PYTHON="${APP_DIR}/.venv/bin/python"
CSV_PATH="${APP_DIR}/data/aqi_log.csv"

if [[ ! -f "${APP_DIR}/src/local_logger/aqi_logger.py" ]]; then
    echo "ERROR: src/local_logger/aqi_logger.py not found in ${APP_DIR}" >&2
    exit 1
fi

if [[ ! -x "${VENV_PYTHON}" ]]; then
    echo "ERROR: venv not found at ${APP_DIR}/.venv" >&2
    echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
    exit 1
fi

echo "Installing ${SERVICE_NAME} service..."
echo "  App dir : ${APP_DIR}"
echo "  Python  : ${VENV_PYTHON}"
echo "  Unit    : ${UNIT_FILE}"

sudo tee "${UNIT_FILE}" > /dev/null <<EOF
[Unit]
Description=Polaris AQI Logger (CSV every 5 min)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}/src
Environment=PYTHONPATH=${APP_DIR}/src
ExecStart=${VENV_PYTHON} local_logger/aqi_logger.py

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl start "${SERVICE_NAME}"

echo ""
echo "Logger started. Data file recorded at: ${CSV_PATH}"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
