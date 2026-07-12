# Systemd Service

Running dawu-manager as a systemd service provides automatic startup on boot, process supervision, and log integration with journald. This is the recommended approach for bare-metal or VM deployments where Docker is not used.

---

## Prerequisites

- Node.js 20 or later installed on the host.
- dawu-manager installed globally or via npx.
- A dedicated non-root user for running the service.

---

## Create a Service User

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin dawu
```

---

## Install dawu-manager

### Option A: Global npm Install

```bash
sudo npm install -g dawu-manager
```

### Option B: Local Install

```bash
sudo mkdir -p /opt/dawu-manager
sudo chown dawu:dawu /opt/dawu-manager
sudo -u dawu npm install --prefix /opt/dawu-manager dawu-manager
```

---

## Create the Data Directory

```bash
sudo mkdir -p /var/lib/dawu-manager
sudo chown dawu:dawu /var/lib/dawu-manager
```

---

## Create the Environment File

```bash
sudo mkdir -p /etc/dawu-manager
```

Create `/etc/dawu-manager/dawu.env`:

```bash
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://your-server-ip:3789
DATABASE_URL=file:/var/lib/dawu-manager/data.db
PORT=3789
NODE_ENV=production
```

Set permissions:

```bash
sudo chown root:dawu /etc/dawu-manager/dawu.env
sudo chmod 640 /etc/dawu-manager/dawu.env
```

Generate a secret:

```bash
openssl rand -base64 32
```

---

## Create the Systemd Unit

Create `/etc/systemd/system/dawu-manager.service`:

```ini
[Unit]
Description=dawu-manager - BNG Node Management Dashboard
Documentation=https://github.com/Cepat-Kilat-Teknologi/dawu-manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dawu
Group=dawu
EnvironmentFile=/etc/dawu-manager/dawu.env
ExecStart=/usr/bin/npx dawu-manager --port 3789
WorkingDirectory=/var/lib/dawu-manager
Restart=on-failure
RestartSec=5
StartLimitBurst=3
StartLimitIntervalSec=60

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/dawu-manager
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dawu-manager

[Install]
WantedBy=multi-user.target
```

If dawu-manager was installed locally (Option B), change the `ExecStart` line:

```ini
ExecStart=/opt/dawu-manager/node_modules/.bin/dawu-manager --port 3789
```

---

## Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable dawu-manager
sudo systemctl start dawu-manager
```

---

## Verify

```bash
# Check service status
sudo systemctl status dawu-manager

# Test the health endpoint
curl -sf http://localhost:3789/api/auth/csrf

# View recent logs
sudo journalctl -u dawu-manager --since '5 minutes ago' --no-pager
```

---

## Managing the Service

| Command | Description |
|---------|-------------|
| `sudo systemctl start dawu-manager` | Start the service |
| `sudo systemctl stop dawu-manager` | Stop the service |
| `sudo systemctl restart dawu-manager` | Restart the service |
| `sudo systemctl status dawu-manager` | Check current status |
| `sudo systemctl enable dawu-manager` | Enable auto-start on boot |
| `sudo systemctl disable dawu-manager` | Disable auto-start on boot |

---

## Log Management

dawu-manager logs are captured by journald:

```bash
# Follow logs in real time
sudo journalctl -u dawu-manager -f

# Show logs from the last hour
sudo journalctl -u dawu-manager --since '1 hour ago'

# Show only error-level messages
sudo journalctl -u dawu-manager -p err

# Export logs to a file
sudo journalctl -u dawu-manager --since today > /tmp/dawu-logs.txt
```

---

## Upgrading

```bash
# Stop the service
sudo systemctl stop dawu-manager

# Update the package
sudo npm install -g dawu-manager@latest

# Start the service (migrations run automatically on startup)
sudo systemctl start dawu-manager

# Verify the new version is running
curl -sf http://localhost:3789/api/auth/csrf
```

---

## Backup

### Database Backup

The SQLite database is a single file. Back it up by copying:

```bash
sudo -u dawu cp /var/lib/dawu-manager/data.db /var/lib/dawu-manager/data.db.bak
```

For automated backups, create a cron job:

```bash
sudo crontab -u dawu -e
```

Add:

```
0 2 * * * cp /var/lib/dawu-manager/data.db /var/lib/dawu-manager/backups/data-$(date +\%Y\%m\%d).db
```

### Configuration Backup

Back up the environment file:

```bash
sudo cp /etc/dawu-manager/dawu.env /etc/dawu-manager/dawu.env.bak
```

---

## Security Hardening

The systemd unit includes several security directives:

| Directive | Effect |
|-----------|--------|
| `NoNewPrivileges=yes` | Prevents the process from gaining additional privileges |
| `ProtectSystem=strict` | Mounts the filesystem as read-only except for allowed paths |
| `ProtectHome=yes` | Makes home directories inaccessible |
| `ReadWritePaths=/var/lib/dawu-manager` | Only the data directory is writable |
| `PrivateTmp=yes` | Gives the service its own /tmp directory |
| `ProtectKernelTunables=yes` | Prevents modification of kernel parameters |
| `ProtectKernelModules=yes` | Prevents loading kernel modules |
| `ProtectControlGroups=yes` | Prevents modification of control groups |
