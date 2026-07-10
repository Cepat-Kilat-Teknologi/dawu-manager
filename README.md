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

| Field    | Default Value      |
|----------|--------------------|
| Name     | admin              |
| Email    | admin@dawu.local   |
| Password | dawu               |

> **Important:** Change the default password immediately after first login.

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

## API Routes

dawu-manager exposes 13 routes:

| Route                                  | Method(s)        | Auth | Purpose                          |
|----------------------------------------|------------------|:----:|----------------------------------|
| `/`                                    | GET              | Yes  | Dashboard overview               |
| `/login`                               | GET              | No   | Login page                       |
| `/setup`                               | GET              | No   | First-run admin setup            |
| `/nodes`                               | GET              | Yes  | Node list                        |
| `/nodes/new`                           | GET              | Yes  | Add node form                    |
| `/nodes/[nodeId]`                      | GET              | Yes  | Node detail + health             |
| `/api/auth/[...nextauth]`              | GET, POST        | —    | NextAuth endpoints               |
| `/api/setup`                           | POST             | No   | Admin creation (first-run only)  |
| `/api/nodes`                           | GET, POST        | Yes  | Node CRUD (list, create)         |
| `/api/nodes/[nodeId]`                  | GET, PUT, DELETE  | Yes  | Node CRUD (read, update, delete) |
| `/api/nodes/[nodeId]/health`           | GET              | Yes  | Health check + status update     |
| `/api/nodes/[nodeId]/proxy/[...path]`  | ANY              | Yes  | Universal dawos-agent proxy      |

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
│   │   ├── nodes/          # Node list, add, detail (with loading skeletons)
│   │   └── page.tsx        # Dashboard overview
│   └── api/
│       ├── auth/           # NextAuth handler
│       ├── nodes/          # CRUD + health + proxy
│       └── setup/          # First-run admin creation
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Sidebar, header, mobile-nav
│   ├── dashboard/          # Stat card, node card
│   └── shared/             # Status badge, loading skeleton, confirm dialog
├── lib/                    # Auth, DB, crypto, dawos-client, utils
├── config/                 # Navigation data
├── types/                  # NextAuth type augmentation
└── __tests__/              # All test files (mirrors src/ structure)
    ├── api/                # API route tests
    ├── components/         # Component tests
    ├── lib/                # Library tests
    └── pages/              # Page tests
```

---

## Testing

- **259 tests** across 29 test files
- **100% coverage** (statements, branches, functions, lines)
- Framework: Vitest 4 + React Testing Library + happy-dom

```bash
pnpm test              # Run all tests
pnpm test:coverage     # Run with coverage thresholds enforced
```

### Coverage Thresholds

```
Statements: 100%
Branches:   100%
Functions:  100%
Lines:      100%
```

---

## Database Schema

dawu-manager uses an embedded SQLite database with four models:

| Model      | Purpose                                   |
|------------|-------------------------------------------|
| `User`     | Dashboard users with roles (admin/operator/viewer) |
| `Session`  | Browser sessions (JWT-backed)             |
| `Node`     | Managed dawos-agent instances             |
| `AuditLog` | Central audit trail for all operations    |
| `Setting`  | Key-value configuration store             |

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

## Contributing

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes with tests
4. Ensure all quality gates pass:
   ```bash
   pnpm lint
   pnpm test:coverage
   pnpm build
   ```
5. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. Open a Pull Request

---

## Security

See [SECURITY.md](SECURITY.md) for our security policy and reporting instructions.

---

## License

[MIT](LICENSE) &copy; 2026 [Cepat Kilat Teknologi](https://github.com/Cepat-Kilat-Teknologi)
