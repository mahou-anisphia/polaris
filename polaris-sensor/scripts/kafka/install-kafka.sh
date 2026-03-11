#!/usr/bin/env bash
set -euo pipefail

# Resolve the polaris-sensor directory (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VENV_PYTHON="${APP_DIR}/.venv/bin/python"
ENV_FILE="${APP_DIR}/.env"

if [[ ! -f "${APP_DIR}/src/kafka.py" ]]; then
    echo "ERROR: src/kafka.py not found in ${APP_DIR}" >&2
    exit 1
fi

if [[ ! -x "${VENV_PYTHON}" ]]; then
    echo "ERROR: venv not found at ${APP_DIR}/.venv" >&2
    echo "Run: python3 -m venv --system-site-packages .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Env setup: manual entry or import from file
# ---------------------------------------------------------------------------
echo ""
echo "Kafka environment setup"
echo "  (a) Enter values manually"
echo "  (b) Import from an existing .env file"
echo ""
read -rp "Choose [a/b]: " ENV_CHOICE

case "${ENV_CHOICE}" in
    a|A)
        read -rp "KAFKA_BROKER (e.g. 192.168.1.100:9092): " INPUT_BROKER
        read -rp "STATION_LATITUDE: " INPUT_LAT
        read -rp "STATION_LONGITUDE: " INPUT_LON

        if [[ -z "${INPUT_BROKER}" || -z "${INPUT_LAT}" || -z "${INPUT_LON}" ]]; then
            echo "ERROR: All three values are required." >&2
            exit 1
        fi

        # Write or update vars in .env
        touch "${ENV_FILE}"
        for KEY in KAFKA_BROKER STATION_LATITUDE STATION_LONGITUDE; do
            sed -i "/^${KEY}=/d" "${ENV_FILE}"
        done
        {
            echo "KAFKA_BROKER=${INPUT_BROKER}"
            echo "STATION_LATITUDE=${INPUT_LAT}"
            echo "STATION_LONGITUDE=${INPUT_LON}"
        } >> "${ENV_FILE}"
        echo "Written to ${ENV_FILE}"
        ;;

    b|B)
        read -rp "Path to .env file: " IMPORT_PATH
        IMPORT_PATH="${IMPORT_PATH/#\~/$HOME}"

        if [[ ! -f "${IMPORT_PATH}" ]]; then
            echo "ERROR: File not found: ${IMPORT_PATH}" >&2
            exit 1
        fi

        BROKER_VAL=$(grep -E '^KAFKA_BROKER=' "${IMPORT_PATH}" | head -1 | cut -d= -f2- || true)
        LAT_VAL=$(grep -E '^STATION_LATITUDE=' "${IMPORT_PATH}" | head -1 | cut -d= -f2- || true)
        LON_VAL=$(grep -E '^STATION_LONGITUDE=' "${IMPORT_PATH}" | head -1 | cut -d= -f2- || true)

        MISSING=()
        [[ -z "${BROKER_VAL}" ]] && MISSING+=("KAFKA_BROKER")
        [[ -z "${LAT_VAL}" ]]    && MISSING+=("STATION_LATITUDE")
        [[ -z "${LON_VAL}" ]]    && MISSING+=("STATION_LONGITUDE")

        if [[ ${#MISSING[@]} -gt 0 ]]; then
            echo "ERROR: The following required variables are missing from ${IMPORT_PATH}:" >&2
            printf '  %s\n' "${MISSING[@]}" >&2
            exit 1
        fi

        touch "${ENV_FILE}"
        for KEY in KAFKA_BROKER STATION_LATITUDE STATION_LONGITUDE; do
            sed -i "/^${KEY}=/d" "${ENV_FILE}"
        done
        {
            echo "KAFKA_BROKER=${BROKER_VAL}"
            echo "STATION_LATITUDE=${LAT_VAL}"
            echo "STATION_LONGITUDE=${LON_VAL}"
        } >> "${ENV_FILE}"
        echo "Imported from ${IMPORT_PATH} into ${ENV_FILE}"
        ;;

    *)
        echo "ERROR: Invalid choice '${ENV_CHOICE}'" >&2
        exit 1
        ;;
esac

# ---------------------------------------------------------------------------
# Cron interval
# ---------------------------------------------------------------------------
echo ""
read -rp "Cron interval in minutes [default: 5]: " CRON_INTERVAL
CRON_INTERVAL="${CRON_INTERVAL:-5}"

if ! [[ "${CRON_INTERVAL}" =~ ^[0-9]+$ ]] || [[ "${CRON_INTERVAL}" -lt 1 ]]; then
    echo "ERROR: Interval must be a positive integer." >&2
    exit 1
fi

if [[ "${CRON_INTERVAL}" -eq 1 ]]; then
    CRON_SCHEDULE="* * * * *"
else
    CRON_SCHEDULE="*/${CRON_INTERVAL} * * * *"
fi

CRON_CMD="PYTHONPATH=${APP_DIR}/src ${VENV_PYTHON} ${APP_DIR}/src/kafka.py >> ${APP_DIR}/kafka.log 2>&1"
CRON_ENTRY="${CRON_SCHEDULE} ${CRON_CMD}"
CRON_MARKER="# polaris-kafka"

# Remove any existing polaris-kafka cron entry, then add the new one
( crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" ; echo "${CRON_ENTRY} ${CRON_MARKER}" ) | crontab -

echo ""
echo "Cron job installed (every ${CRON_INTERVAL} min):"
echo "  ${CRON_ENTRY}"
echo ""
echo "Logs: ${APP_DIR}/kafka.log"
echo "To remove: run scripts/kafka/uninstall-kafka.sh"
