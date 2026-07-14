# dawu-manager

**Web management dashboard for dawos-agent BNG nodes.**

dawu-manager provides a centralized web interface for managing multiple [dawos-agent](https://github.com/Cepat-Kilat-Teknologi/dawos-agent) instances from a single dashboard. Purpose-built for ISP operations teams running PPPoE/BNG infrastructure powered by [accel-ppp](https://accel-ppp.org/), it replaces per-node SSH sessions with a unified, role-controlled management plane.

---

## Key Features

- **Multi-node management** -- Register, monitor, and operate multiple BNG nodes from one interface.
- **Real-time health monitoring** -- Continuous status tracking with online, offline, degraded, and unknown indicators.
- **Role-based access control** -- Three-tier permission model (admin, operator, viewer) enforced at the API route level.
- **Secure API proxy** -- All dawos-agent communication flows through server-side API routes. BNG node API keys are encrypted at rest and never exposed to the browser.
- **Fleet operations** -- Execute operations across multiple nodes concurrently with per-node result reporting.
- **Audit trail** -- Central log of all management actions, filterable by user, node, action, and date range, with CSV export.
- **Alert system** -- Configurable threshold rules with webhook notification support.
- **Responsive design** -- Mobile-first layout with sidebar navigation, skeleton loading states, and dark mode support.
- **Embedded database** -- SQLite via Prisma with zero external database dependencies.
- **Session history** -- View, export, and manage historical session data with CSV export and snapshot creation.
- **RADIUS diagnostics** -- RADIUS configuration display, status monitoring, and interactive health check with latency reporting.
- **One-command install** -- `npx dawu-manager` gets a production-ready instance running in seconds.

---

## Architecture

```
Operator Workstation                     dawu-manager Server
+--------------------+                  +-----------------------------------+
|                    |                  |  Next.js 16 (App Router)          |
|  Browser           |  --- HTTPS --->  |    +-- Auth (NextAuth v5 JWT)     |
|  (React 19)        |    JWT auth      |    +-- API Routes                |
|                    |                  |    |    +-- /api/nodes CRUD       |
+--------------------+                  |    |    +-- /api/nodes/proxy      |
                                        |    |    +-- /api/fleet/operations |
                                        |    +-- SQLite (Prisma 7)          |
                                        |         +-- Users (hashed)        |
                                        |         +-- Nodes (encrypted)     |
                                        |         +-- AuditLog              |
                                        +-----------------------------------+
                                                    |
                                           HTTP + X-API-Key
                                           (decrypted server-side)
                                                    |
                           +------------------------+------------------------+
                           |                        |                        |
                    +------+------+          +------+------+          +------+------+
                    | dawos-agent |          | dawos-agent |          | dawos-agent |
                    | BNG Node 1  |          | BNG Node 2  |          | BNG Node N  |
                    | :8470       |          | :8470       |          | :8470       |
                    +-------------+          +-------------+          +-------------+
```

The browser authenticates with dawu-manager using JWT credentials. When an operator interacts with a BNG node, the request is routed through the dawu-manager proxy, which decrypts the stored API key and forwards the request to the target dawos-agent instance. Node credentials never leave the server.

---

## Quick Start

### npx (recommended)

```bash
npx dawu-manager
```

Open [http://localhost:3789](http://localhost:3789) and complete the first-time setup to create your admin account.

### Docker

```bash
docker run -d \
  --name dawu-manager \
  -p 3789:3789 \
  -v dawu-data:/data \
  -e DATABASE_URL=file:/data/dawu.db \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
```

### From Source

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
pnpm install
pnpm exec prisma migrate dev
pnpm dev
```

See the [Installation Guide](getting-started/installation.md) for complete instructions, including production deployment options.

---

## Tech Stack

| Layer       | Technology                                             |
|-------------|--------------------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)                     |
| Runtime     | React 19                                               |
| UI          | shadcn/ui v5 + Tailwind CSS v4                         |
| Database    | SQLite via Prisma 7 + @prisma/adapter-libsql           |
| Auth        | NextAuth.js v5 (JWT + credentials provider)            |
| Validation  | Zod 4                                                  |
| State       | TanStack Query 5                                       |
| Testing     | Vitest 4 + React Testing Library + happy-dom           |
| Package mgr | pnpm                                                   |

---

## Documentation Sections

| Section | Description |
|---------|-------------|
| [Getting Started](getting-started/installation.md) | Installation, configuration, first-run setup, and upgrade guide |
| [User Guide](user-guide/dashboard.md) | Dashboard, node management, health monitoring, and 17 feature pages |
| [Deployment](deployment/docker.md) | Docker, systemd, nginx, and production hardening |
| [Architecture](architecture/overview.md) | System design, proxy layer, database schema, and auth |
| [API Reference](api/reference.md) | Complete endpoint documentation |
| [Development](development/contributing.md) | Contributing guide, testing, and changelog |
| [Security](security.md) | Security policy, architecture, and best practices |

---

## Related Projects

| Project | Description |
|---------|-------------|
| [dawos-agent](https://github.com/Cepat-Kilat-Teknologi/dawos-agent) | REST API daemon for accel-ppp BNG nodes (runs on each BNG) |
| [dawos-cli](https://github.com/Cepat-Kilat-Teknologi/dawos-cli) | Command-line client for dawos-agent (remote management via terminal) |

---

## License

[MIT](https://github.com/Cepat-Kilat-Teknologi/dawu-manager/blob/main/LICENSE) -- Cepat Kilat Teknologi
