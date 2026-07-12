# Installation Guide

## Prerequisites

| Requirement  | Minimum Version | Check Command           |
|--------------|:---------------:|-------------------------|
| Node.js      | 20.0+           | `node --version`        |
| pnpm         | 9.0+ (dev only) | `pnpm --version`        |
| Docker       | 24.0+ (optional)| `docker --version`      |

---

## Quick Install (npx)

The fastest way to get dawu-manager running:

```bash
npx dawu-manager
```

This will:
1. Download and install dawu-manager
2. Create the database at `~/.dawu-manager/data.db`
3. Run Prisma migrations automatically
4. Start the server on http://localhost:3789

### Custom port

```bash
npx dawu-manager --port 4000
```

### With persistent secret

```bash
NEXTAUTH_SECRET="your-secret-here" npx dawu-manager
```

> **Note:** Without `NEXTAUTH_SECRET`, an auto-generated secret is used and sessions will not persist across restarts.

---

## Docker Install (recommended for production)

### Using docker compose

1. Create a `docker-compose.yml`:

```yaml
services:
  dawu-manager:
    image: ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
    container_name: dawu-manager
    ports:
      - "3789:3789"
    volumes:
      - dawu-data:/data
    environment:
      - DATABASE_URL=file:/data/dawu.db
      - NEXTAUTH_SECRET=change-me-to-a-random-string
      - NEXTAUTH_URL=http://localhost:3789
    restart: unless-stopped

volumes:
  dawu-data:
```

2. Start the service:

```bash
docker compose up -d
```

3. Check logs:

```bash
docker compose logs -f dawu-manager
```

### Using docker run

```bash
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e DATABASE_URL=file:/data/dawu.db \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXTAUTH_URL=http://localhost:3789 \
  --restart unless-stopped \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
```

### Building from source

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
docker compose up -d --build
```

---

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up the database

```bash
pnpm exec prisma migrate dev
```

This creates a local `dev.db` SQLite database with all tables.

### 4. Configure environment (optional)

Create a `.env.local` file:

```bash
# Required for persistent sessions
NEXTAUTH_SECRET=your-development-secret

# Auth callback URL
NEXTAUTH_URL=http://localhost:3789

# Database (default: file:./dev.db)
DATABASE_URL=file:./dev.db
```

### 5. Start the development server

```bash
pnpm dev
```

The dev server starts on http://localhost:3789 with Turbopack hot-reload.

### 6. Run tests

```bash
pnpm test              # Run all 1115 tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With 100% coverage enforcement
```

---

## First-Time Setup

When dawu-manager starts with an empty database, you'll be redirected to the setup page:

### 1. Open the setup page

Navigate to http://localhost:3789 — you'll be redirected to `/setup` automatically.

### 2. Create the admin account
Fill in your admin account details — choose a name, email, and strong password.
There are no hardcoded defaults; you set your own credentials.

> **Tip:** The first account created is always assigned the `admin` role.

---

## Environment Variables Reference

| Variable           | Required | Default                          | Description                              |
|--------------------|:--------:|----------------------------------|------------------------------------------|
| `DATABASE_URL`     | No       | `file:~/.dawu-manager/data.db` (npx) / `file:/data/dawu.db` (Docker) | SQLite database file path |
| `NEXTAUTH_SECRET`  | **Yes*** | Auto-generated (dev only)        | Secret for JWT signing and API key encryption. Must be set for production. |
| `NEXTAUTH_URL`     | No       | `http://localhost:${PORT}`       | Canonical URL for NextAuth callbacks     |
| `PORT`             | No       | `3789`                           | Server listen port                       |
| `NODE_ENV`         | No       | `development`                    | Set to `production` for production builds |
| `NEXT_TELEMETRY_DISABLED` | No | `1` (Docker)                  | Disable Next.js anonymous telemetry      |

\* Auto-generated if not set, but sessions won't persist across restarts. **Always set in production.**

---

## Troubleshooting

### "NEXTAUTH_SECRET not set" warning

```
⚠  NEXTAUTH_SECRET not set — using auto-generated secret (sessions will not persist across restarts)
```

**Fix:** Set the `NEXTAUTH_SECRET` environment variable:

```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
npx dawu-manager
```

### Migration failed

```
⚠  Migration failed — database may need manual setup.
```

**Fix:** Ensure the database directory exists and is writable:

```bash
# npx install
mkdir -p ~/.dawu-manager
chmod 755 ~/.dawu-manager

# Docker
docker volume create dawu-data
```

### Port already in use

```
Error: listen EADDRINUSE :::3789
```

**Fix:** Use a different port:

```bash
npx dawu-manager --port 4000
```

### Cannot connect to dawos-agent node

1. Verify the dawos-agent is running on the target BNG node:
   ```bash
   curl -sf http://<node-ip>:8470/health
   ```

2. Check network connectivity from the dawu-manager host:
   ```bash
   curl -sf http://<node-ip>:8470/health
   ```

3. Verify the API key is correct:
   ```bash
   curl -sf -H 'X-API-Key: <api-key>' http://<node-ip>:8470/api/v1/sessions
   ```

4. Check firewall rules — port 8470 must be accessible from the dawu-manager host.

### Prisma client error

If you see Prisma-related errors after upgrading:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

### Docker container won't start

Check logs for errors:

```bash
docker compose logs dawu-manager
```

Common issues:
- Volume permissions: ensure `/data` is writable by UID 1001
- Missing `NEXTAUTH_SECRET`: set it in the compose file or environment

---

## Upgrading

### npx

```bash
npx dawu-manager@latest
```

Migrations run automatically on startup.

### Docker

```bash
docker compose pull
docker compose up -d
```

### From source

```bash
git pull
pnpm install
pnpm exec prisma migrate deploy
pnpm build
```
