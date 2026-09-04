#!/usr/bin/env bash
set -euo pipefail

ASTRA_WALL_URL="${ASTRA_WALL_URL:-http://localhost:5173}"

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" --args --kiosk --app="$ASTRA_WALL_URL"
elif [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -a "Microsoft Edge" --args --kiosk --app="$ASTRA_WALL_URL"
else
  open "$ASTRA_WALL_URL"
  echo "Chrome or Edge is required for automatic kiosk mode."
fi
