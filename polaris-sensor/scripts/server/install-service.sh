#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="polaris-sensor"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Resolve the polaris-sensor directory (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VENV_PYTHON="${APP_DIR}/.venv/bin/python"

if [[ ! -f "${APP_DIR}/src/app.py" ]]; then
    echo "ERROR: src/app.py not found in ${APP_DIR}" >&2
    exit 1
fi

if [[ ! -x "${VENV_PYTHON}" ]]; then
    echo "ERROR: venv not found at ${APP_DIR}/.venv" >&2
    echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Env setup: manual entry or import from file
# ---------------------------------------------------------------------------
ENV_FILE="${APP_DIR}/.env"
echo ""
echo "Environment setup"
echo "  (a) Enter values manually"
echo "  (b) Import from an existing .env file"
echo "  (s) Skip — I will configure .env myself"
echo ""
read -rp "Choose [a/b/s]: " ENV_CHOICE

case "${ENV_CHOICE}" in
    a|A)
        read -rp "AQAIR_API_KEY: " INPUT_API_KEY
        read -rp "AQAIR_API_ENDPOINT [default: api.airvisual.com]: " INPUT_ENDPOINT
        INPUT_ENDPOINT="${INPUT_ENDPOINT:-api.airvisual.com}"

        if [[ -z "${INPUT_API_KEY}" ]]; then
            echo "ERROR: AQAIR_API_KEY is required." >&2
            exit 1
        fi

        touch "${ENV_FILE}"
        for KEY in AQAIR_API_KEY AQAIR_API_ENDPOINT; do
            sed -i "/^${KEY}=/d" "${ENV_FILE}"
        done
        {
            echo "AQAIR_API_KEY=${INPUT_API_KEY}"
            echo "AQAIR_API_ENDPOINT=${INPUT_ENDPOINT}"
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

        API_KEY_VAL=$(grep -E '^AQAIR_API_KEY=' "${IMPORT_PATH}" | head -1 | cut -d= -f2- || true)
        ENDPOINT_VAL=$(grep -E '^AQAIR_API_ENDPOINT=' "${IMPORT_PATH}" | head -1 | cut -d= -f2- || true)

        if [[ -z "${API_KEY_VAL}" ]]; then
            echo "ERROR: AQAIR_API_KEY is missing from ${IMPORT_PATH}" >&2
            exit 1
        fi
        ENDPOINT_VAL="${ENDPOINT_VAL:-api.airvisual.com}"

        touch "${ENV_FILE}"
        for KEY in AQAIR_API_KEY AQAIR_API_ENDPOINT; do
            sed -i "/^${KEY}=/d" "${ENV_FILE}"
        done
        {
            echo "AQAIR_API_KEY=${API_KEY_VAL}"
            echo "AQAIR_API_ENDPOINT=${ENDPOINT_VAL}"
        } >> "${ENV_FILE}"
        echo "Imported from ${IMPORT_PATH} into ${ENV_FILE}"
        ;;

    s|S)
        echo "Skipping env setup — make sure ${ENV_FILE} is configured before starting the service."
        ;;

    *)
        echo "ERROR: Invalid choice '${ENV_CHOICE}'" >&2
        exit 1
        ;;
esac

echo "Installing ${SERVICE_NAME} service..."
echo "  App dir : ${APP_DIR}"
echo "  Python  : ${VENV_PYTHON}"
echo "  Unit    : ${UNIT_FILE}"

sudo tee "${UNIT_FILE}" > /dev/null <<EOF
[Unit]
Description=Polaris Sensor API
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}/src
ExecStart=${VENV_PYTHON} app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl start "${SERVICE_NAME}"

echo ""
echo "Service started. Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
