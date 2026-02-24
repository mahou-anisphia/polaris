#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="polaris-sensor"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Removing ${SERVICE_NAME} service..."

sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

if [[ -f "${UNIT_FILE}" ]]; then
    sudo rm "${UNIT_FILE}"
fi

sudo systemctl daemon-reload

echo "Done. Service removed."
