# dawu-manager

**Web management dashboard for dawos-agent BNG nodes.**

Manage multiple [dawos-agent](https://github.com/Cepat-Kilat-Teknologi/dawos-agent) instances from a single, responsive web UI. Think Portainer or Teleport — but purpose-built for PPPoE/BNG infrastructure powered by accel-ppp.

<!-- ![Dashboard Screenshot](docs/screenshots/dashboard.png) -->
<!-- ![Node Detail Screenshot](docs/screenshots/node-detail.png) -->

---

## Features

- **Multi-node management** — Add, monitor, and control multiple BNG nodes from one dashboard
- **Real-time health monitoring** — Live status checks with online/offline/degraded indicators
- **Role-based access control (RBAC)** — Admin, operator, and viewer roles with route-level enforcement
- **Secure API proxy** — All dawos-agent communication goes through Next.js API routes; BNG credentials never reach the browser
- **API key encryption** — AES-256-GCM with scrypt-derived keys; API keys are encrypted at rest
- **Audit logging** — Central audit trail for all node operations
- **Responsive design** — Mobile-first UI with sidebar, mobile nav, skeleton loading, and toast notifications
- **Dark mode ready** — CSS variable-based theming with Tailwind dark variant support
- **Zero-config database** — Embedded SQLite via Prisma; no external database server required
- **One-command install** — `npx dawu-manager` gets you running in seconds

---

## Quick Start

### Option 1: npx (recommended)

```bash
npx dawu-manager
```

Open http://localhost:3789 and complete the first-time setup.

### Option 2: Docker

```bash
curl -O https://raw.githubusercontent.com/Cepat-Kilat-Teknologi/dawu-manager/main/docker-compose.yml
docker compose up -d
```

### Option 3: Development

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
pnpm install
pnpm exec prisma migrate dev
pnpm dev
```

### First-Time Setup

On first launch, you'll be redirected to `/setup` to create your admin account.
Enter your name, email, and a strong password — there are no hardcoded defaults.

> **Tip:** The first account created is always assigned the `admin` role.

---

## Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Framework   | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| UI          | [shadcn/ui v5](https://ui.shadcn.com/) (@base-ui/react) + [Tailwind CSS v4](https://tailwindcss.com/) |
| Database    | SQLite via [Prisma 7](https://www.prisma.io/) + @prisma/adapter-libsql |
| Auth        | [NextAuth.js v5](https://authjs.dev/) (beta.31), JWT + credentials |
| Charts      | [Recharts 3](https://recharts.org/)           |
| Forms       | [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/) |
| State       | [TanStack Query 5](https://tanstack.com/query) |
| Testing     | [Vitest 4](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) + happy-dom |
| Package mgr | [pnpm](https://pnpm.io/)                     |

---

## Architecture

```
Operator Workstation                    dawu-manager Server
+-------------------+                  +-------------------------------+
|                   |                  |  Next.js 16 (App Router)      |
|  Browser          | --- HTTPS --->   |    |                          |
|  (React 19 SPA)   |   JWT auth       |    +-- Auth (NextAuth v5)     |
|                   |                  |    +-- API Routes             |
+-------------------+                  |    |    +-- /api/nodes CRUD   |
                                       |    |    +-- /api/nodes/proxy  |
                                       |    +-- SQLite (Prisma 7)      |
                                       |         +-- Users             |
                                       |         +-- Nodes (encrypted) |
                                       |         +-- AuditLog          |
                                       +-------------------------------+
                                                   |
                                          HTTP + X-API-Key
                                                   |
                          +------------------------+------------------------+
                          |                        |                        |
                   +------+------+          +------+------+          +------+------+
                   | dawos-agent |          | dawos-agent |          | dawos-agent |
                   | BNG Node 1  |          | BNG Node 2  |          | BNG Node N  |
                   | :8470       |          | :8470       |          | :8470       |
                   +-------------+          +-------------+          +-------------+
```

### Data Flow

1. **Browser** authenticates with dawu-manager via NextAuth.js (JWT)
2. **API routes** decrypt the stored API key for the target node
3. **Proxy** forwards the request to the dawos-agent instance with `X-API-Key` header
4. **Response** flows back through the proxy to the browser

BNG node credentials (API keys) are **never exposed** to the browser.

---

## Routes

dawu-manager exposes 42 routes (28 pages + 14 API endpoints):

### Pages (28)

| Route | Auth | Purpose |
|-------|:----:|---------|
| `/login` | No | Login page |
| `/setup` | No | First-run admin setup |
| `/` | Yes | Dashboard overview (fleet stats) |
| `/nodes` | Yes | Node list |
| `/nodes/new` | Yes | Add node form |
| `/nodes/[nodeId]` | Yes | Node detail + health |
| `/nodes/[nodeId]/sessions` | Yes | PPPoE session management |
| `/nodes/[nodeId]/service` | Yes | accel-ppp service control |
| `/nodes/[nodeId]/config` | Yes | Configuration editor |
| `/nodes/[nodeId]/firewall` | Yes | Firewall rules + NAT + groups |
| `/nodes/[nodeId]/network` | Yes | Interfaces, routes, VLANs |
| `/nodes/[nodeId]/traffic` | Yes | Traffic monitoring + shaping |
| `/nodes/[nodeId]/pppoe` | Yes | PPPoE interfaces + MAC filters |
| `/nodes/[nodeId]/routing` | Yes | BGP, OSPF, RIP, BFD |
| `/nodes/[nodeId]/ip-pool` | Yes | IP address pool management |
| `/nodes/[nodeId]/monitoring` | Yes | Monitoring exporters + metrics |
| `/nodes/[nodeId]/logs` | Yes | Log viewer + streaming |
| `/nodes/[nodeId]/system` | Yes | System info + metrics |
| `/nodes/[nodeId]/dhcp` | Yes | DHCP server + relay |
| `/nodes/[nodeId]/diagnostics` | Yes | Diagnostics + zones + conntrack |
| `/nodes/[nodeId]/events` | Yes | Event hooks + webhooks |
| `/nodes/[nodeId]/history` | Yes | Session history + snapshots + CSV export |
| `/nodes/[nodeId]/radius` | Yes | RADIUS diagnostics + health check |
| `/audit` | Yes | Central audit trail (filters + CSV export) |
| `/alerts` | Yes | Alert rules + history |
| `/operations` | Yes | Cross-node fleet operations |
| `/users` | Yes | User management (admin) |
| `/settings` | Yes | Global settings (admin) |

### API Endpoints (14)

| Route | Method(s) | Auth | Purpose |
|-------|-----------|:----:|---------|
| `/api/auth/[...nextauth]` | GET, POST | — | NextAuth handler |
| `/api/setup` | POST | No | First-run admin creation |
| `/api/nodes` | GET, POST | Yes | Node list + create |
| `/api/nodes/[nodeId]` | GET, PUT, DELETE | Yes | Node CRUD |
| `/api/nodes/[nodeId]/health` | GET | Yes | Health check + status update |
| `/api/nodes/[nodeId]/proxy/[...path]` | ANY | Yes | Universal dawos-agent proxy |
| `/api/nodes/[nodeId]/stream/[...path]` | GET | Yes | SSE streaming proxy |
| `/api/activity` | GET | Yes | Audit log entries |
| `/api/activity/export` | GET | Yes | Audit log CSV export |
| `/api/alerts/rules` | GET, POST | Yes | Alert rules CRUD |
| `/api/alerts/rules/[id]` | GET, PUT, DELETE | Yes | Alert rule by ID |
| `/api/alerts/events` | GET | Yes | Alert event history |
| `/api/fleet/operations` | POST | Yes | Cross-node fan-out operations |
| `/api/fleet/overview` | GET | Yes | Fleet aggregate stats |

---

## Configuration

### Environment Variables

| Variable           | Required | Default                    | Description                              |
|--------------------|:--------:|----------------------------|------------------------------------------|
| `DATABASE_URL`     | No       | `file:~/.dawu-manager/data.db` | SQLite database path                 |
| `NEXTAUTH_SECRET`  | **Yes**  | Auto-generated (dev only)  | Secret for JWT signing + API key encryption |
| `NEXTAUTH_URL`     | No       | `http://localhost:3789`    | Canonical URL for auth callbacks         |
| `PORT`             | No       | `3789`                     | Server listen port                       |

### CLI Options

```bash
npx dawu-manager --port 4000    # Custom port
```

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Commands

| Command             | Description                              |
|---------------------|------------------------------------------|
| `pnpm dev`          | Start dev server (port 3789, Turbopack)  |
| `pnpm build`        | Production build (standalone output)     |
| `pnpm start`        | Start production server                  |
| `pnpm lint`         | Run ESLint                               |
| `pnpm test`         | Run all tests                            |
| `pnpm test:watch`   | Run tests in watch mode                  |
| `pnpm test:coverage`| Run tests with coverage report           |

### Project Structure

```
src/
├── app/
│   ├── (auth)/             # Login + setup pages (centered layout)
│   ├── (dashboard)/        # Protected pages (sidebar + header layout)
│   │   ├── alerts/         # Alert rules + history
│   │   ├── audit/          # Audit trail (filters + CSV export)
│   │   ├── nodes/          # Node list, add, detail
│   │   │   └── [nodeId]/   # 17 category pages (sessions, firewall, config, history, radius, etc.)
│   │   ├── operations/     # Cross-node fleet operations
│   │   ├── settings/       # Global settings
│   │   ├── users/          # User management
│   │   └── page.tsx        # Dashboard overview (fleet stats)
│   └── api/
│       ├── activity/       # Audit log API + CSV export
│       ├── alerts/         # Alert rules + events API
│       ├── auth/           # NextAuth handler
│       ├── fleet/          # Fleet operations + overview API
│       ├── nodes/          # CRUD + health + proxy + SSE stream
│       └── setup/          # First-run admin creation
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Sidebar, header, mobile-nav
│   ├── dashboard/          # Stat card, node card
│   └── shared/             # Status badge, loading skeleton, confirm dialog
├── hooks/                  # TanStack Query hooks (node proxy, mutations)
├── lib/                    # Auth, DB, crypto, dawos-client, utils
├── config/                 # Navigation data
├── types/                  # NextAuth type augmentation
└── __tests__/              # 90 test files (mirrors src/ structure)
```

---

## Testing

- **1176 tests** across 90 test files
- Framework: Vitest 4 + React Testing Library + happy-dom

```bash
pnpm test              # Run all tests
pnpm test:coverage     # Run with coverage report
```

---

## Database Schema

dawu-manager uses an embedded SQLite database with seven models:

| Model        | Purpose                                            |
|--------------|----------------------------------------------------|
| `User`       | Dashboard users with roles (admin/operator/viewer) |
| `Session`    | Browser sessions (JWT-backed)                      |
| `Node`       | Managed dawos-agent instances                      |
| `AuditLog`   | Central audit trail for all operations             |
| `Setting`    | Key-value configuration store                      |
| `AlertRule`  | Threshold-based alert rule definitions             |
| `AlertEvent` | Alert event history (triggered alerts)             |

---

## User Roles

| Role       | Permissions                                      |
|------------|--------------------------------------------------|
| `admin`    | Full access: manage nodes, users, settings, view audit log |
| `operator` | Manage nodes: add, edit, delete, proxy operations |
| `viewer`   | Read-only: view dashboard, node list, node detail |

---

## Distribution

| Method  | Command / File            | Use Case                |
|---------|---------------------------|-------------------------|
| **npx** | `npx dawu-manager`       | Quick trial, small deployments |
| **Docker** | `docker compose up -d` | Production deployments  |
| **Dev** | `pnpm dev`               | Development             |

---

## Related Projects

| Project                                                                                     | Description                         |
|---------------------------------------------------------------------------------------------|-------------------------------------|
| [dawos-agent](https://github.com/Cepat-Kilat-Teknologi/dawos-agent)                        | REST API daemon for BNG nodes       |
| [dawos-cli](https://github.com/Cepat-Kilat-Teknologi/dawos-cli)                            | Remote CLI client for dawos-agent   |

---

## Documentation

Full documentation is available at **[cepat-kilat-teknologi.github.io/dawu-manager](https://cepat-kilat-teknologi.github.io/dawu-manager/)**.

Covers installation, configuration, user guide, deployment (Docker, systemd, Nginx), architecture deep dives, API reference, and development guides.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, test patterns, and pull request guidelines.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community guidelines.

---

## Security

See [SECURITY.md](SECURITY.md) for our security policy and reporting instructions.

---

## License

[MIT](LICENSE) &copy; 2026 [Cepat Kilat Teknologi](https://github.com/Cepat-Kilat-Teknologi)
