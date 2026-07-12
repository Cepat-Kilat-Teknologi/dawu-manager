#!/bin/bash
set -euo pipefail

# dawu-manager systemd installer
# Usage: sudo ./install.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: run as root (sudo ./install.sh)"
  exit 1
fi

echo "==> Installing dawu-manager..."

# Create system user
if ! id -u dawu &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin --create-home --home-dir /opt/dawu-manager dawu
  echo "  Created user: dawu"
fi

# Install dawu-manager
npm install -g dawu-manager
echo "  Installed dawu-manager globally"

# Create environment file
mkdir -p /etc/dawu-manager
if [ ! -f /etc/dawu-manager/dawu.env ]; then
  SECRET=$(openssl rand -base64 32)
  cat > /etc/dawu-manager/dawu.env << EOF
NEXTAUTH_SECRET=${SECRET}
NEXTAUTH_URL=http://localhost:3789
PORT=3789
EOF
  chmod 640 /etc/dawu-manager/dawu.env
  chown root:dawu /etc/dawu-manager/dawu.env
  echo "  Created /etc/dawu-manager/dawu.env"
else
  echo "  /etc/dawu-manager/dawu.env already exists (skipped)"
fi

# Install systemd service
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "${SCRIPT_DIR}/dawu-manager.service" /etc/systemd/system/
systemctl daemon-reload
echo "  Installed systemd service"

# Start and enable
systemctl enable --now dawu-manager
echo "  Started dawu-manager"

echo ""
echo "==> dawu-manager is running!"
echo "    URL:  http://localhost:3789"
echo "    Logs: journalctl -u dawu-manager -f"
echo ""
echo "    First visit will redirect to /setup to create admin account."
