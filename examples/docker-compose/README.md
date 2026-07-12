# Docker Compose Deployment

Production-ready deployment using a pre-built image from GitHub Container Registry.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit with your secret
nano .env   # Set NEXTAUTH_SECRET

# 3. Start
docker compose up -d

# 4. Check logs
docker compose logs -f

# 5. Open browser
# http://localhost:3789 → setup admin account
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definition |
| `.env.example` | Environment template |

## Operations

```bash
# View logs
docker compose logs -f dawu-manager

# Restart
docker compose restart

# Stop
docker compose down

# Upgrade to latest version
docker compose pull
docker compose up -d

# Backup database
docker cp dawu-manager:/data/dawu.db ./backup-$(date +%Y%m%d).db

# Reset (delete all data)
docker compose down -v
```

## Custom Port

Edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3789"   # host:container
```

## Custom Domain

Set `NEXTAUTH_URL` in `.env`:

```bash
NEXTAUTH_URL=https://dawu.example.com
```
