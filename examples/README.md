# Deployment Examples

Ready-to-use deployment configurations for dawu-manager.

## Quick Start

| Method | Best For | Setup Time |
|--------|----------|:----------:|
| [Docker Compose](docker-compose/) | Production servers | ~2 min |
| [Docker Standalone](docker-standalone/) | Single container | ~1 min |
| [Systemd](systemd/) | Bare metal / VPS | ~5 min |
| [Nginx Reverse Proxy](nginx/) | HTTPS termination | ~5 min |

---

## Docker Compose (Recommended)

The simplest production deployment — pre-built image from GitHub Container Registry.

```bash
cd examples/docker-compose
cp .env.example .env
# Edit .env with your secret

docker compose up -d
# Open http://localhost:3789
```

See [docker-compose/README.md](docker-compose/README.md) for details.

---

## Docker Standalone

Single `docker run` command — no compose file needed.

```bash
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e DATABASE_URL=file:/data/dawu.db \
  --restart unless-stopped \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
```

See [docker-standalone/README.md](docker-standalone/README.md) for details.

---

## Systemd Service

Run dawu-manager natively on a Linux server using systemd.

```bash
cd examples/systemd
sudo ./install.sh
# Open http://localhost:3789
```

See [systemd/README.md](systemd/README.md) for details.

---

## Nginx Reverse Proxy

Put dawu-manager behind nginx with HTTPS (Let's Encrypt / custom certificate).

```bash
cd examples/nginx
# Edit dawu-manager.conf with your domain
sudo cp dawu-manager.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/dawu-manager.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

See [nginx/README.md](nginx/README.md) for details.

---

## Architecture

```
                          ┌──────────────────┐
                          │   Nginx (HTTPS)  │  ← optional
                          │   :443 → :3789   │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  dawu-manager     │
                          │  :3789            │
                          │  (Next.js + API)  │
                          │  SQLite: /data/   │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼──────┐   ┌────────▼──────┐   ┌────────▼──────┐
     │  dawos-agent   │   │  dawos-agent   │   │  dawos-agent   │
     │  BNG-1 :8470   │   │  BNG-2 :8470   │   │  BNG-N :8470   │
     └───────────────┘   └───────────────┘   └───────────────┘
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `NEXTAUTH_SECRET` | **Yes** | — | JWT signing + API key encryption secret |
| `DATABASE_URL` | No | `file:/data/dawu.db` | SQLite database path |
| `NEXTAUTH_URL` | No | `http://localhost:3789` | Canonical URL |
| `PORT` | No | `3789` | Server listen port |
| `AUTH_TRUST_HOST` | No | `true` (Docker) | Trust reverse proxy headers |

> **Generate a secret:** `openssl rand -base64 32`
