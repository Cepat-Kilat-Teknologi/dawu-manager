# Systemd Service

Run dawu-manager natively on a Linux server managed by systemd.

## Prerequisites

- Node.js 20+ (`node --version`)
- npm (`npm --version`)

## Quick Install

```bash
sudo ./install.sh
```

This will:
1. Create a `dawu` system user
2. Install dawu-manager globally via npm
3. Generate a NEXTAUTH_SECRET
4. Create the systemd service
5. Start and enable the service

## Manual Install

```bash
# 1. Create system user
sudo useradd --system --shell /usr/sbin/nologin --create-home --home-dir /opt/dawu-manager dawu

# 2. Install dawu-manager
sudo npm install -g dawu-manager

# 3. Create environment file
sudo mkdir -p /etc/dawu-manager
sudo tee /etc/dawu-manager/dawu.env > /dev/null << EOF
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3789
PORT=3789
EOF
sudo chmod 640 /etc/dawu-manager/dawu.env
sudo chown root:dawu /etc/dawu-manager/dawu.env

# 4. Copy service file
sudo cp dawu-manager.service /etc/systemd/system/
sudo systemctl daemon-reload

# 5. Start and enable
sudo systemctl enable --now dawu-manager

# 6. Verify
sudo systemctl status dawu-manager
curl -sf http://localhost:3789/api/auth/csrf
```

## Operations

```bash
# Status
sudo systemctl status dawu-manager

# Logs
sudo journalctl -u dawu-manager -f

# Restart
sudo systemctl restart dawu-manager

# Stop
sudo systemctl stop dawu-manager

# Upgrade
sudo npm update -g dawu-manager
sudo systemctl restart dawu-manager

# Backup database
cp /opt/dawu-manager/.dawu-manager/data.db ./backup-$(date +%Y%m%d).db
```

## Uninstall

```bash
sudo systemctl disable --now dawu-manager
sudo rm /etc/systemd/system/dawu-manager.service
sudo systemctl daemon-reload
sudo npm uninstall -g dawu-manager
sudo rm -rf /etc/dawu-manager
sudo userdel -r dawu
```
