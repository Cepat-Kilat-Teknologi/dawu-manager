# Upgrade Guide

Step-by-step instructions for upgrading dawu-manager to a new version.

---

## Before You Begin

### Prerequisites

- Access to the server running dawu-manager.
- Internet access to pull packages from npm or container registries.
- A database backup (recommended before any upgrade).

### Check the Current Version

=== "npx"

    ```bash
    npx dawu-manager --version
    ```

=== "Docker"

    ```bash
    docker exec dawu-manager cat /app/package.json | grep '"version"'
    ```

=== "From source"

    ```bash
    cat package.json | grep '"version"'
    ```

### Read the Changelog

Before upgrading, review the [Changelog](../development/changelog.md) for breaking changes, new features, and migration steps between your current version and the target version.

---

## Back Up Your Database

Always back up before upgrading. The SQLite database file contains all your nodes, users, audit logs, alert rules, and settings.

=== "npx"

    ```bash
    cp ~/.dawu-manager/data.db ~/.dawu-manager/data.db.bak
    ```

=== "Docker"

    ```bash
    docker cp dawu-manager:/data/dawu.db ./dawu-backup-$(date +%Y%m%d).db
    ```

=== "From source"

    ```bash
    cp prisma/dev.db prisma/dev.db.bak
    ```

---

## Standard Upgrade

### npx

The simplest upgrade method. Database migrations run automatically on startup.

```bash
npx dawu-manager@latest
```

To upgrade to a specific version:

```bash
npx dawu-manager@0.2.0
```

!!! note "Cache clearing"
    If npx serves a cached old version, clear the cache first:
    ```bash
    npx clear-npx-cache 2>/dev/null; npx dawu-manager@latest
    ```

### Docker

Pull the latest image and restart the container. The entrypoint script runs `prisma migrate deploy` automatically before starting the server.

```bash
# Pull the latest image
docker compose pull

# Restart with the new image
docker compose up -d
```

To upgrade to a specific version tag:

```bash
# Edit docker-compose.yml to pin the version
# image: ghcr.io/cepat-kilat-teknologi/dawu-manager:0.2.0
docker compose up -d
```

Verify the container restarted successfully:

```bash
docker compose logs --tail 20 dawu-manager
```

### From Source

```bash
# Pull the latest code
git pull

# Install updated dependencies
pnpm install

# Apply database migrations
pnpm exec prisma migrate deploy

# Rebuild the production bundle
pnpm build

# Restart the service (if running via systemd or PM2)
sudo systemctl restart dawu-manager
# or: pm2 restart dawu-manager
```

---

## Verify After Upgrade

After every upgrade, verify that dawu-manager is running correctly:

| Check | How | Expected |
|-------|-----|----------|
| Server responding | Open `http://localhost:3789` in browser | Login page or dashboard loads |
| Auth working | Log in with your existing credentials | Dashboard renders with node list |
| Node connectivity | Click a node → check health | Node shows "online" status |
| Database intact | Check node list, user list, audit log | All previously registered data present |
| New features | Navigate to newly added pages | Pages load without errors |

### Quick Verification Commands

```bash
# Health endpoint (no auth required)
curl -sf http://localhost:3789/api/auth/csrf

# Check logs for errors (Docker)
docker compose logs --tail 50 dawu-manager | grep -i error

# Check logs for errors (systemd)
sudo journalctl -u dawu-manager --since '5 minutes ago' -p err
```

---

## Rollback

If the new version introduces problems, restore from your backup.

### npx

```bash
# Restore the database backup
cp ~/.dawu-manager/data.db.bak ~/.dawu-manager/data.db

# Run the previous version
npx dawu-manager@0.1.0
```

### Docker

```bash
# Stop the current container
docker compose down

# Restore the database
docker cp ./dawu-backup-YYYYMMDD.db dawu-manager:/data/dawu.db

# Pin the previous version in docker-compose.yml
# image: ghcr.io/cepat-kilat-teknologi/dawu-manager:0.1.0

# Restart
docker compose up -d
```

### From Source

```bash
# Restore the database
cp prisma/dev.db.bak prisma/dev.db

# Checkout the previous version
git checkout v0.1.0

# Reinstall and rebuild
pnpm install
pnpm build
```

---

## Database Migrations

dawu-manager uses Prisma 7 with SQLite. Migrations are applied automatically in most scenarios:

| Method | Migration Timing |
|--------|-----------------|
| npx | Automatic on startup (via `bin/cli.mjs`) |
| Docker | Automatic on startup (via `entrypoint.sh`) |
| From source | Manual: `pnpm exec prisma migrate deploy` |

### What Migrations Do

Migrations modify the database schema to match the new version. Common operations include:

- Adding new tables (e.g., `AlertRule`, `AlertEvent` were added in v0.1.0).
- Adding columns to existing tables.
- Creating indexes for performance.

### Migration Failures

If a migration fails:

1. Check the error message in the logs.
2. Ensure the database file exists and is writable.
3. For Docker, verify the volume is correctly mounted.
4. For npx, ensure `~/.dawu-manager/` exists with write permissions.

```bash
# Manual migration (from source or debug)
pnpm exec prisma migrate deploy

# Reset database (WARNING: deletes all data)
pnpm exec prisma migrate reset
```

---

## Breaking Changes Checklist

When upgrading across major or minor versions, check for these potential breaking changes:

### Environment Variables

New versions may introduce new environment variables. Check the [Configuration Reference](configuration.md) for the complete list. dawu-manager logs warnings at startup for recommended settings that are not configured.

### dawos-agent Compatibility

dawu-manager proxies requests to dawos-agent instances running on BNG nodes. When upgrading dawu-manager, ensure your dawos-agent versions are compatible:

| dawu-manager | Minimum dawos-agent | Notes |
|:------------:|:-------------------:|-------|
| 0.1.0 | 0.3.0+ | Base compatibility for 145 endpoints |
| 0.1.x (unreleased) | 0.4.0+ | Session history, RADIUS diagnostics, PPPoE runtime require v0.4.0 endpoints |

!!! warning "Upgrade dawos-agent first"
    If the new dawu-manager version uses endpoints introduced in a newer dawos-agent version, upgrade your BNG nodes first. dawu-manager gracefully handles missing endpoints (shows "feature not available"), but new features will not work until the agent is updated.

### Upgrading dawos-agent on BNG Nodes

Upgrade dawos-agent on each BNG node independently. PPPoE sessions are **not affected** by an agent restart — only the management API has a brief interruption (under 5 seconds).

```bash
# SSH into the BNG node
ssh user@bng-node

# Standard upgrade
sudo /opt/dawos-agent/venv/bin/pip install --upgrade dawos-agent
sudo systemctl restart dawos-agent

# Verify
curl -sf http://localhost:8470/health | python3 -m json.tool
```

For complete dawos-agent upgrade instructions, see the [dawos-agent Upgrade Guide](https://cepat-kilat-teknologi.github.io/dawos-agent/guides/upgrade/).

---

## Version-Specific Notes

### Upgrading to v0.1.x (Unreleased)

New features added since v0.1.0:

| Feature | Page | dawos-agent Requirement |
|---------|------|------------------------|
| Session history | `/nodes/[nodeId]/history` | v0.4.0+ (`/api/v1/sessions/history`) |
| RADIUS diagnostics | `/nodes/[nodeId]/radius` | v0.4.0+ (`/api/v1/radius/*`) |
| PPPoE runtime config | `/nodes/[nodeId]/pppoe` | v0.4.0+ (`/api/v1/pppoe/runtime`) |
| IP pool detail | `/nodes/[nodeId]/ip-pool` | v0.4.0+ (`/api/v1/ip-pool/detail`) |
| Session history CSV export | `/nodes/[nodeId]/history` | v0.4.0+ (`/api/v1/sessions/history/export`) |

**No database migrations required** — these features use existing proxy infrastructure.

**No environment variable changes** — all new features work with existing configuration.

**dawos-agent v0.4.0 upgrade note:** If upgrading dawos-agent from v0.3.x to v0.4.0, the agent now stores session history in a SQLite database at `/var/lib/dawos-agent/history.db`. This requires creating the directory and adding it to the systemd `ReadWritePaths`. See the [dawos-agent v0.4.0 upgrade section](https://cepat-kilat-teknologi.github.io/dawos-agent/guides/upgrade/#upgrading-to-v040) for details.

---

## Multi-Instance Upgrade Strategy

When running multiple dawu-manager instances (e.g., staging + production), follow this upgrade order:

1. **Back up both databases** before starting.
2. **Upgrade staging first** — verify all features work correctly.
3. **Test for at least 30 minutes** — check node connectivity, fleet operations, audit logging.
4. **Upgrade production** — only after staging is confirmed stable.

---

## Post-Upgrade Checklist

After every upgrade, verify these items:

- [ ] dawu-manager is running and accessible in browser
- [ ] Login works with existing credentials
- [ ] All registered nodes appear in the node list
- [ ] Node health checks return correct status
- [ ] At least one node detail page loads all feature tabs
- [ ] Audit trail shows recent entries (including the upgrade restart)
- [ ] Alert rules are still configured and active
- [ ] Fleet operations page is accessible (operator/admin only)
- [ ] No errors in server logs
