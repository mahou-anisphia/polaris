#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
CRON_MARKER="# polaris-kafka"

echo "Removing polaris-kafka cron entry..."

CURRENT_CRON=$(crontab -l 2>/dev/null || true)
if echo "${CURRENT_CRON}" | grep -q "${CRON_MARKER}"; then
    echo "${CURRENT_CRON}" | grep -v "${CRON_MARKER}" | crontab -
    echo "Cron entry removed."
else
    echo "No polaris-kafka cron entry found — nothing to remove."
fi

# ---------------------------------------------------------------------------
# Optionally remove Kafka vars from .env
# ---------------------------------------------------------------------------
if [[ -f "${ENV_FILE}" ]]; then
    echo ""
    read -rp "Remove KAFKA_BROKER, STATION_LATITUDE, STATION_LONGITUDE from ${ENV_FILE}? [y/N]: " REMOVE_ENV
    if [[ "${REMOVE_ENV}" =~ ^[Yy]$ ]]; then
        for KEY in KAFKA_BROKER STATION_LATITUDE STATION_LONGITUDE; do
            sed -i "/^${KEY}=/d" "${ENV_FILE}"
        done
        echo "Kafka vars removed from ${ENV_FILE}"
    else
        echo "Env vars left unchanged."
    fi
fi

echo ""
echo "Done."
