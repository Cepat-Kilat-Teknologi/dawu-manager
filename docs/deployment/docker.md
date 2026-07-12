# Docker Deployment

dawu-manager provides a multi-platform Docker image published to GitHub Container Registry (ghcr.io). The image supports both `linux/amd64` and `linux/arm64` architectures.

---

## Quick Start

```bash
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e NEXTAUTH_SECRET=your-secret-key-here \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:0.1.0
```

Open [http://localhost:3789](http://localhost:3789) to access the setup page.

---

## Docker Compose

For production deployments, use Docker Compose for declarative configuration:

```yaml
services:
  dawu-manager:
    image: ghcr.io/cepat-kilat-teknologi/dawu-manager:0.1.0
    container_name: dawu-manager
    restart: unless-stopped
    ports:
      - "3789:3789"
    volumes:
      - dawu-data:/data
    environment:
      - NEXTAUTH_SECRET=your-secret-key-here
      - NEXTAUTH_URL=http://your-server-ip:3789
      - DATABASE_URL=file:/data/dawu.db

volumes:
  dawu-data:
```

Start the service:

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f dawu-manager
```

Stop the service:

```bash
docker compose down
```

---

## Image Details

| Property | Value |
|----------|-------|
| Registry | `ghcr.io/cepat-kilat-teknologi/dawu-manager` |
| Base image | `node:22-alpine` |
| Build | Multi-stage (install, build, production) |
| Output mode | Next.js standalone |
| Final image size | Approximately 150-200 MB |
| Platforms | `linux/amd64`, `linux/arm64` |
| Process user | Non-root (UID 1001) |
| Exposed port | 3789 |
| Data directory | `/data` |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `NEXTAUTH_SECRET` | Yes | -- | JWT signing key. Generate with `openssl rand -base64 32` |
| `DATABASE_URL` | No | `file:/data/dawu.db` | SQLite database path |
| `NEXTAUTH_URL` | No | `http://localhost:3789` | Public URL for authentication callbacks |
| `PORT` | No | `3789` | Server listen port |
| `NODE_ENV` | No | `production` | Set automatically in the image |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Disables Next.js telemetry (set in image) |
| `ENCRYPTION_KEY` | No | Falls back to `NEXTAUTH_SECRET` | Dedicated key for API key encryption |

---

## Data Persistence

The SQLite database is stored at `/data/dawu.db` inside the container. Mount a Docker volume or bind mount to `/data` to persist data across container restarts and upgrades.

### Named Volume (Recommended)

```yaml
volumes:
  - dawu-data:/data
```

Docker manages the volume lifecycle. Data survives container removal.

### Bind Mount

```yaml
volumes:
  - /opt/dawu-manager/data:/data
```

The host directory must exist and be writable by UID 1001:

```bash
sudo mkdir -p /opt/dawu-manager/data
sudo chown 1001:1001 /opt/dawu-manager/data
```

---

## Entrypoint

The Docker image uses a custom entrypoint script (`entrypoint.sh`) that performs the following on every container start:

1. Runs `prisma migrate deploy` to apply any pending database migrations.
2. Starts the Next.js production server.

This ensures that upgrading to a new image version automatically applies schema changes to the existing database.

---

## Upgrading

To upgrade to a new version:

```bash
# Pull the new image
docker compose pull

# Restart with the new image
docker compose up -d
```

The entrypoint script automatically applies any new database migrations. No manual intervention is required.

---

## Building from Source

To build the Docker image locally:

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
docker build -t dawu-manager .
```

The Dockerfile uses a multi-stage build:

| Stage | Purpose |
|-------|---------|
| `base` | Install pnpm, set working directory |
| `deps` | Install production dependencies |
| `builder` | Build the Next.js application (standalone output) |
| `runner` | Final production image with minimal footprint |

---

## Security

The production container runs as a non-root user (UID 1001) with the following constraints:

- No shell access for the application user.
- Read-only filesystem except for the `/data` volume and Next.js cache directory.
- Only port 3789 is exposed.
- No unnecessary packages or build tools in the final image.

---

## Health Check

Add a health check to your Docker Compose configuration:

```yaml
services:
  dawu-manager:
    # ... other config ...
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3789/api/auth/csrf"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

---

## Resource Requirements

Minimum recommended resources for the container:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Memory | 128 MB | 256 MB |
| CPU | 0.25 cores | 0.5 cores |
| Disk | 50 MB (image) + database | 500 MB |

The SQLite database grows proportionally to the number of audit log entries. For deployments managing 10-50 BNG nodes with moderate activity, expect the database to remain under 100 MB for years of operation.

---

## Troubleshooting

### Container exits immediately

Check the logs:

```bash
docker logs dawu-manager
```

Common causes:

- Missing `NEXTAUTH_SECRET` environment variable.
- Port 3789 already in use on the host.
- Volume mount permissions (UID 1001 must be able to write to `/data`).

### Database migration errors

If the entrypoint fails during migration:

```bash
docker exec -it dawu-manager sh
ls -la /data/
```

Verify the `/data` directory is writable. If the database file is corrupted, restore from a backup or remove it to start fresh.

### Cannot connect from browser

Verify the port mapping:

```bash
docker port dawu-manager
```

Ensure the host firewall allows connections on port 3789.
