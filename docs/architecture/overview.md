# Architecture Overview

dawu-manager is a web-based management dashboard that provides centralized control over multiple dawos-agent BNG (Broadband Network Gateway) nodes. This page describes the system architecture, component interactions, and key design decisions.

---

## System Topology

```
                    Management Network
                    ==================

  Operator Browser              dawu-manager Server
  +-------------------+         +-----------------------------------+
  |                   |         |  Next.js 16 (App Router)          |
  |  React 19 SPA     | HTTPS   |    +-- Auth (NextAuth v5 JWT)    |
  |  TanStack Query   | ------> |    +-- API Routes                |
  |  shadcn/ui v5     |  JWT    |    |    +-- /api/nodes (CRUD)    |
  |                   |  cookie |    |    +-- /api/fleet (ops)     |
  +-------------------+         |    |    +-- /api/nodes/proxy     |
                                |    +-- SQLite (Prisma 7)         |
                                |         +-- Users (bcrypt)       |
                                |         +-- Nodes (AES-256-GCM)  |
                                |         +-- AuditLog             |
                                |         +-- AlertRules           |
                                +-----------------------------------+
                                         |
                                HTTP + X-API-Key (decrypted server-side)
                                         |
              +------+------+------+------+------+
              |      |      |      |      |      |
            BNG-1  BNG-2  BNG-3  BNG-4  BNG-5  BNG-N
            :8470  :8470  :8470  :8470  :8470  :8470
            (dawos-agent instances)
```

---

## Component Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19 + shadcn/ui v5 + TanStack Query v5 | User interface, data fetching, caching |
| Backend | Next.js 16 App Router (API Routes) | Authentication, authorization, proxy, CRUD |
| Database | SQLite via Prisma 7 + libsql adapter | User accounts, node registry, audit log, settings |
| Auth | NextAuth.js v5 (JWT strategy) | Authentication, session management, RBAC |
| BNG nodes | dawos-agent (FastAPI, Python) | 153 REST API endpoints for BNG management |

---

## Request Flow

Every interaction between the operator's browser and a BNG node follows the same path:

```
1. Browser sends request to dawu-manager API route
   POST /api/nodes/abc123/proxy/api/v1/sessions

2. API route validates JWT session cookie
   -> 401 if not authenticated

3. API route checks user role against required minimum
   -> 403 if insufficient permissions

4. API route looks up node "abc123" in the database
   -> 404 if node not found

5. API route decrypts the stored API key (AES-256-GCM)

6. API route forwards the request to the dawos-agent URL
   POST http://192.168.1.100:8470/api/v1/sessions
   Header: X-API-Key: <decrypted-key>

7. dawos-agent processes the request and returns a response

8. API route returns the response to the browser

9. If the operation is a mutation, an audit log entry is created
```

This architecture ensures that:

- BNG node credentials never reach the browser.
- All access is authenticated and authorized.
- All mutations are audited.
- The browser only needs to know the dawu-manager URL, not individual BNG node addresses.

---

## Design Principles

### Proxy-First Architecture

The browser never communicates directly with BNG nodes. All requests are proxied through dawu-manager's server-side API routes. This provides a single point of authentication, authorization, auditing, and credential management.

### Server-Side Rendering with Client Hydration

Pages are rendered on the server for fast initial loads, then hydrated on the client for interactivity. TanStack Query manages client-side data fetching, caching, and polling after the initial render.

### Data-Driven UI

Navigation items, node feature pages, and fleet operations are defined as data structures rather than hardcoded UI. This makes adding new features a matter of adding entries to configuration objects rather than creating new components.

### Embedded Database

SQLite was chosen as the database to enable zero-configuration deployment. There is no separate database server to install, configure, or maintain. The database file lives alongside the application and is backed up by copying a single file.

### Defense in Depth

Security is enforced at multiple layers:

| Layer | Mechanism |
|-------|-----------|
| Network | TLS termination at reverse proxy |
| Authentication | JWT session validation on every request |
| Authorization | Role-based access control (viewer, operator, admin) |
| Data at rest | API keys encrypted with AES-256-GCM |
| Audit | All mutations logged with user identity and timestamp |
| Transport | Credentials never sent to the browser |

---

## Technology Choices

### Why Next.js 16

Next.js provides both the frontend framework (React, App Router) and the backend (API Routes) in a single deployment unit. This eliminates the need for a separate backend service and simplifies deployment to a single process.

The App Router enables server components, streaming, and layouts that share authentication state across pages without redundant checks.

### Why SQLite

dawu-manager is designed for deployment on small to mid-sized ISP infrastructure. The typical deployment manages 5-50 BNG nodes. SQLite handles this workload without the operational overhead of PostgreSQL or MySQL.

Benefits:

- No database server process to manage.
- No network connection to configure.
- Single-file backup and restore.
- Works with npx, Docker, and systemd deployment methods.

### Why shadcn/ui v5

shadcn/ui provides accessible, composable UI components built on @base-ui/react. Components are copied into the project (not installed as a dependency), allowing full customization. The base-nova style provides a professional appearance suitable for infrastructure management tools.

### Why TanStack Query

TanStack Query handles data fetching, caching, background polling, and mutation state. For a dashboard that monitors multiple BNG nodes, automatic polling and cache invalidation are essential for keeping the UI current without manual refresh.

---

## Module Boundaries

```
src/
  app/
    (auth)/           # Public pages (login, setup) -- no auth required
    (dashboard)/      # Protected pages -- auth guard in layout
    api/              # Server-side API routes -- auth + RBAC per route
  components/
    ui/               # shadcn/ui primitives -- no business logic
    layout/           # Layout components (sidebar, header, mobile nav)
    dashboard/        # Dashboard-specific components (stat card, node card)
    fleet/            # Fleet operation components
    shared/           # Cross-cutting components (status badge, confirm dialog)
  lib/                # Core libraries (auth, crypto, database, HTTP client)
  config/             # Data-driven configuration (navigation items)
  hooks/              # React hooks (TanStack Query wrappers)
  types/              # TypeScript type definitions
```

### Dependency Rules

- `components/ui/` has no imports from `lib/` or `app/`.
- `lib/` has no imports from `components/` or `app/`.
- `config/` has no imports from `lib/` or `app/`.
- `app/api/` routes import from `lib/` but not from `components/`.
- `components/` import from `lib/` and `config/` but not from `app/api/`.

These boundaries prevent circular dependencies and keep the codebase maintainable.
