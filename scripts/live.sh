#!/usr/bin/env bash
# Build, serve dist locally, and optionally expose it through a Cloudflare
# quick tunnel (no account required). Ctrl+C stops both.
#
#   ./scripts/live.sh              # local + public quick-tunnel URL
#   PORT=8080 ./scripts/live.sh    # different local port
#
# A quick tunnel is temporary: the URL changes on every run and dies with this
# process. Use docs/DEPLOY.md for a durable host.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-4173}"

npm run build

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

CLOUDFLARED="${CLOUDFLARED:-$(command -v cloudflared || true)}"
if [ -z "$CLOUDFLARED" ] && [ -x "$HOME/.local/bin/cloudflared" ]; then
  CLOUDFLARED="$HOME/.local/bin/cloudflared"
fi

echo "Local: http://127.0.0.1:$PORT"
if [ -z "$CLOUDFLARED" ]; then
  echo "cloudflared not found — serving locally only."
  echo "Install it from https://github.com/cloudflare/cloudflared/releases for a public URL."
  wait "$SERVER_PID"
else
  echo "Public quick tunnel starting; the URL appears below and dies with this process."
  "$CLOUDFLARED" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate
fi
