# Docker Standalone

Run dawu-manager with a single `docker run` command — no compose file needed.

## Quick Start

```bash
# Start dawu-manager
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e DATABASE_URL=file:/data/dawu.db \
  -e AUTH_TRUST_HOST=true \
  --restart unless-stopped \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:latest

# Open http://localhost:3789
```

## Operations

```bash
# View logs
docker logs -f dawu-manager

# Restart
docker restart dawu-manager

# Stop
docker stop dawu-manager

# Remove container (data persists in volume)
docker rm dawu-manager

# Upgrade
docker pull ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
docker stop dawu-manager && docker rm dawu-manager
# Re-run the docker run command above

# Backup database
docker cp dawu-manager:/data/dawu.db ./backup-$(date +%Y%m%d).db

# Delete everything (including data)
docker stop dawu-manager && docker rm dawu-manager
docker volume rm dawu-data
```

## Custom Port

```bash
docker run -d \
  --name dawu-manager \
  -p 8080:3789 \
  ...
```

## Persistent Secret

Save your secret so sessions persist across container restarts:

```bash
# Generate once
openssl rand -base64 32 > ~/.dawu-secret

# Use in docker run
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e NEXTAUTH_SECRET=$(cat ~/.dawu-secret) \
  -e DATABASE_URL=file:/data/dawu.db \
  --restart unless-stopped \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
```
