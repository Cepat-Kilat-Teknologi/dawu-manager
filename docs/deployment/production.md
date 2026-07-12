# Production Checklist

This page consolidates all production deployment considerations into a single checklist. Follow these steps when deploying dawu-manager to a production environment.

---

## 1. Generate Secrets

Generate cryptographically strong secrets for all required environment variables:

```bash
# NEXTAUTH_SECRET (required)
openssl rand -base64 32

# ENCRYPTION_KEY (recommended, separate from NEXTAUTH_SECRET)
openssl rand -base64 32
```

Never reuse secrets across environments (development, staging, production).

---

## 2. Configure Environment Variables

Set the following environment variables for your deployment method (systemd env file, Docker environment, or `.env` file):

| Variable | Production Value |
|----------|-----------------|
| `NEXTAUTH_SECRET` | Generated secret (32+ characters) |
| `ENCRYPTION_KEY` | Generated secret (32+ characters) |
| `NEXTAUTH_URL` | Full public URL (e.g., `https://dawu.example.com`) |
| `DATABASE_URL` | Path to SQLite database file |
| `PORT` | `3789` (or your chosen port) |
| `NODE_ENV` | `production` |

!!! warning "NEXTAUTH_SECRET persistence"
    If `NEXTAUTH_SECRET` changes, all existing JWT sessions are invalidated and users must log in again. Additionally, if `ENCRYPTION_KEY` is not set separately, changing `NEXTAUTH_SECRET` makes existing encrypted API keys unreadable. Always back up these values securely.

---

## 3. TLS Termination

Production deployments must use HTTPS. Options:

| Method | Description |
|--------|-------------|
| Nginx reverse proxy | Recommended. See [Nginx Reverse Proxy](nginx.md) |
| Caddy reverse proxy | Automatic HTTPS with Let's Encrypt |
| Cloud load balancer | AWS ALB, GCP Load Balancer, etc. |
| Cloudflare Tunnel | Zero-config TLS with Cloudflare |

After configuring TLS, update `NEXTAUTH_URL` to use `https://`.

---

## 4. Database Backup Strategy

SQLite databases are single files, making backups straightforward:

### Automated Daily Backup

```bash
# Create backup directory
sudo mkdir -p /var/lib/dawu-manager/backups

# Add to crontab (runs daily at 2:00 AM)
sudo crontab -e
```

```
0 2 * * * cp /var/lib/dawu-manager/data.db /var/lib/dawu-manager/backups/data-$(date +\%Y\%m\%d).db
```

### Backup Retention

```bash
# Remove backups older than 30 days
find /var/lib/dawu-manager/backups -name "data-*.db" -mtime +30 -delete
```

### Off-Site Backup

Copy backups to a remote location:

```bash
rsync -az /var/lib/dawu-manager/backups/ backup-server:/backups/dawu-manager/
```

---

## 5. Firewall Configuration

Open only the necessary ports:

```bash
# If using Nginx (recommended)
sudo ufw allow 80/tcp    # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH

# If exposing dawu-manager directly (not recommended)
sudo ufw allow 3789/tcp
```

Ensure that port 3789 is not exposed to the public internet when using a reverse proxy. The proxy should be the only ingress point.

---

## 6. Process Management

Choose a process management strategy:

| Method | When to Use |
|--------|-------------|
| [systemd](systemd.md) | Bare-metal or VM deployments |
| [Docker](docker.md) | Container-based deployments |
| Docker Compose | Multi-container environments |

Ensure the service is configured to restart on failure and start automatically on boot.

---

## 7. Monitoring

### Service Health

Monitor the dawu-manager process:

```bash
# systemd
sudo systemctl is-active dawu-manager

# Docker
docker inspect --format='{{.State.Health.Status}}' dawu-manager
```

### Application Health

Set up an external monitor (uptime checker) to poll the health endpoint:

```
GET https://dawu.example.com/api/auth/csrf
```

Expected response: HTTP 200 with a JSON body containing a CSRF token.

### Log Monitoring

Monitor application logs for errors:

```bash
# systemd
sudo journalctl -u dawu-manager -p err --since '1 hour ago'

# Docker
docker logs dawu-manager 2>&1 | grep -i error
```

---

## 8. Performance Considerations

### SQLite Write Concurrency

SQLite uses file-level locking for writes. This is sufficient for dawu-manager's workload (primarily proxying requests to BNG nodes), but be aware of the following:

- Write operations (audit log entries, node status updates) are serialized.
- Read operations can run concurrently.
- Under heavy write load (many concurrent fleet operations), slight latency increases are expected.

For most deployments managing up to 100 BNG nodes, SQLite performance is more than adequate.

### Node.js Memory

The default Node.js heap size (approximately 1.5 GB) is sufficient for dawu-manager. No custom `--max-old-space-size` configuration is needed.

### Static Assets

Next.js standalone output includes only the files needed to run the application. Static assets are served directly by the Node.js process. If serving many concurrent users, placing Nginx in front (with `proxy_cache` for static assets) reduces load on the Node.js process.

---

## 9. Security Hardening

### File Permissions

| Path | Owner | Mode | Description |
|------|-------|------|-------------|
| `/etc/dawu-manager/dawu.env` | `root:dawu` | `640` | Environment file with secrets |
| `/var/lib/dawu-manager/data.db` | `dawu:dawu` | `600` | SQLite database |
| `/var/lib/dawu-manager/backups/` | `dawu:dawu` | `700` | Backup directory |

### Service User

Run dawu-manager as a dedicated unprivileged user (e.g., `dawu`). Never run as root.

### Network Segmentation

dawu-manager needs network access to:

1. **Inbound** -- Web browsers on the management network (port 443 via Nginx).
2. **Outbound** -- dawos-agent instances on BNG nodes (port 8470).

Consider placing dawu-manager in a management VLAN with access to the BNG node network. Restrict access from subscriber-facing networks.

---

## 10. Disaster Recovery

### Complete Restoration

To restore dawu-manager from a backup:

1. Install dawu-manager on a new server (see [Installation](../getting-started/installation.md)).
2. Copy the database backup to the data directory.
3. Set the same `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` values as the original deployment.
4. Start the service.

!!! danger "Secret key recovery"
    If `NEXTAUTH_SECRET` or `ENCRYPTION_KEY` is lost and no backup of the values exists, encrypted API keys stored in the database cannot be decrypted. All BNG nodes would need to be re-registered with their API keys. Store secret keys securely in a password manager or secrets vault.

### Recovery Time Objective

With a recent database backup and documented environment configuration, dawu-manager can be restored on a new server in under 15 minutes.

---

## Pre-Launch Checklist

Before going live, verify every item:

- [ ] `NEXTAUTH_SECRET` set to a strong, unique value
- [ ] `ENCRYPTION_KEY` set to a separate strong value (recommended)
- [ ] `NEXTAUTH_URL` set to the public HTTPS URL
- [ ] TLS certificate installed and working
- [ ] HTTP-to-HTTPS redirect configured
- [ ] Service starts automatically on boot
- [ ] Service restarts automatically on failure
- [ ] Database backup cron job configured
- [ ] Firewall rules allow only necessary ports
- [ ] Application accessible from the management network
- [ ] First admin account created via `/setup`
- [ ] At least one BNG node added and showing "Online"
- [ ] Login and logout flow working correctly
- [ ] Audit log recording actions
- [ ] Error logs clean (no recurring errors)
- [ ] Secret values stored securely in a password manager
