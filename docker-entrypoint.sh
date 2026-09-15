#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

xlsx_count=$(find "$DATA_DIR" -maxdepth 1 \( -iname '*.xlsx' \) ! -name '~$*' 2>/dev/null | wc -l | tr -d ' ')
if [ "$xlsx_count" = "0" ] && [ -d /app/seed ]; then
  cp /app/seed/*.xlsx "$DATA_DIR"/ 2>/dev/null || true
fi

export HOSTING="${HOSTING:-vps}"
export PORT="${PORT:-43127}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

exec node server.js
