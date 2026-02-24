#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="polaris-aqi-logger"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CSV_PATH="${APP_DIR}/data/aqi_log.csv"

echo "Removing ${SERVICE_NAME} service..."

sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

if [[ -f "${UNIT_FILE}" ]]; then
    sudo rm "${UNIT_FILE}"
fi

sudo systemctl daemon-reload

echo "Done. Service removed."
if [[ -f "${CSV_PATH}" ]]; then
    echo "Data file preserved at: ${CSV_PATH}"
fi
