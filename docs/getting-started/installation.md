# Installation

dawu-manager can be installed through three methods, depending on your environment and use case.

| Method | Best For | Prerequisites |
|--------|----------|---------------|
| npx | Quick evaluation, small deployments | Node.js 20+ |
| Docker | Production deployments | Docker 24+ |
| From source | Development and contribution | Node.js 20+, pnpm 9+ |

---

## Prerequisites

| Requirement | Minimum Version | Verification |
|-------------|:---------------:|--------------|
| Node.js | 20.0 | `node --version` |
| pnpm | 9.0 (source only) | `pnpm --version` |
| Docker | 24.0 (Docker only) | `docker --version` |
| Docker Compose | 2.20 (Docker only) | `docker compose version` |

---

## Method 1: npx (Recommended for Quick Start)

Run a single command to download, install, and start dawu-manager:

```bash
npx dawu-manager
```

This command performs the following steps automatically:

1. Downloads the `dawu-manager` package from npm.
2. Creates the SQLite database at `~/.dawu-manager/data.db`.
3. Applies all database migrations.
4. Starts the server on port 3789.

Open [http://localhost:3789](http://localhost:3789) to access the dashboard.

### Custom Port

```bash
npx dawu-manager --port 4000
```

### Persistent Session Secret

Without `NEXTAUTH_SECRET`, an auto-generated secret is used and user sessions will not persist across server restarts.

```bash
NEXTAUTH_SECRET="$(openssl rand -base64 32)" npx dawu-manager
```

!!! warning "Production deployments"
    Always set `NEXTAUTH_SECRET` to a fixed value in production. Without it, all users are logged out every time the server restarts. See the [Configuration](configuration.md) page for details.

### Upgrading

```bash
npx dawu-manager@latest
```

Database migrations run automatically on startup.

---

## Method 2: Docker (Recommended for Production)

### Using Docker Compose

Create a `docker-compose.yml` file:

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
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3789/api/auth/csrf"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  dawu-data:
```

Start the service:

```bash
docker compose up -d
```

Verify the container is running:

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

### Building from Source

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
docker compose up -d --build
```

### Multi-Platform Support

The Docker image is built for both `linux/amd64` and `linux/arm64` architectures.

### Upgrading

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically via the container entrypoint.

---

## Method 3: From Source (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Initialize the Database

```bash
pnpm exec prisma migrate dev
```

This creates a local `dev.db` SQLite database in the project root with all required tables.

### 4. Configure Environment (Optional)

Create a `.env.local` file for persistent configuration:

```bash
NEXTAUTH_SECRET=your-development-secret
NEXTAUTH_URL=http://localhost:3789
DATABASE_URL=file:./dev.db
```

### 5. Start the Development Server

```bash
pnpm dev
```

The server starts on [http://localhost:3789](http://localhost:3789) with Turbopack hot-reload enabled.

### 6. Run Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode for development
pnpm test:coverage     # Generate coverage report
```

### Upgrading

```bash
git pull
pnpm install
pnpm exec prisma migrate deploy
pnpm build
```

---

## Verification

After installation, verify that dawu-manager is running correctly:

```bash
# Check the health endpoint
curl -sf http://localhost:3789/api/auth/csrf

# Verify the response contains a CSRF token
# Expected: {"csrfToken":"..."}
```

Open the browser at [http://localhost:3789](http://localhost:3789). On first launch, you will be redirected to the setup page to create your admin account. See [First-Run Setup](first-run.md) for a walkthrough.

---

## Troubleshooting

### NEXTAUTH_SECRET Not Set Warning

```
NEXTAUTH_SECRET not set -- using auto-generated secret
```

Set the environment variable before starting:

```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
npx dawu-manager
```

### Migration Failed

```
Migration failed -- database may need manual setup.
```

Ensure the database directory exists and is writable:

```bash
# npx
mkdir -p ~/.dawu-manager
chmod 755 ~/.dawu-manager

# Docker
docker volume create dawu-data
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3789
```

Use a different port:

```bash
npx dawu-manager --port 4000
```

### Cannot Connect to dawos-agent Node

1. Verify dawos-agent is running on the target BNG node:
   ```bash
   curl -sf http://<node-ip>:8470/health
   ```

2. Check network connectivity from the dawu-manager host to the BNG node on port 8470.

3. Verify the API key matches the value in `/etc/dawos-agent/agent.env` on the BNG node.

4. Confirm that firewall rules allow traffic on port 8470 between dawu-manager and the BNG node.

### Docker Container Fails to Start

Check the container logs:

```bash
docker compose logs dawu-manager
```

Common causes:

- **Volume permissions**: Ensure `/data` is writable by UID 1001 (the non-root user in the container).
- **Missing NEXTAUTH_SECRET**: The variable must be set in the compose file or environment.
- **Port conflict**: Another service may already be using port 3789.

### Prisma Client Error After Upgrade

If you encounter Prisma-related errors after upgrading:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```
