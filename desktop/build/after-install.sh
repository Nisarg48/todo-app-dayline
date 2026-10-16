#!/bin/sh
# Runs as root after the .deb is installed.
# Ensures Electron's sandbox helper is setuid root so Dayline launches
# on first double-click (Ubuntu App Center installs don't set this).
set -e
SANDBOX="/opt/Dayline/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX" || true
  chmod 4755 "$SANDBOX" || true
fi
exit 0
