# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.1.1] - 2026-07-15

### Added

- **Session history page** (`/nodes/[nodeId]/history`) — session history table with stats grid, snapshot creation, CSV export, and purge with confirmation dialog
- **RADIUS diagnostics page** (`/nodes/[nodeId]/radius`) — RADIUS config and status display, interactive health check with latency reporting and toast feedback
- **PPPoE runtime config** — live PPPoE runtime configuration display (service name, AC name, session limits) on the PPPoE page
- **IP pool detail** — per-pool allocation detail with expandable accordion showing IP, username, and session ID for each allocation
- **Session history CSV export** — export session history entries to CSV file via browser download

### Fixed

- **History page data extraction** — fixed `extract: "sessions"` → `extract: "records"` to match dawos-agent response shape; history table now loads correctly (`fc75f26`)

### Changed

- Updated documentation — README, CHANGELOG, testing guide, node features guide, upgrade guide to reflect current project state (1176 tests, 42 routes, 90 test files, 28 pages, 17 node feature pages)
- **Integration tested all 17 node feature pages** against live dawos-dev BNG node — all passing (Sessions, Service, Config, Firewall, Network, Traffic, PPPoE, Routing, IP Pool, Monitoring, Logs, System, DHCP, Diagnostics, Events, History, RADIUS)

---

## [0.1.0] - 2026-07-12

### Added — Phase 4: Multi-Node Features

- **Fleet operations** (`/operations`) — cross-node concurrent fan-out: health check, restart, bulk terminate across selected nodes with per-node result reporting (`e8693a3`)
- **Audit trail** (`/audit`) — filterable by user, node, action, date range with CSV export (`00a4517`)
- **Fleet overview** (`/`) — live aggregate stats: total subscribers, online/offline/degraded counts, top nodes by load with graceful per-node degradation (`fc05852`)

### Added — Phase 3: Write Endpoint Surface (~50 endpoints)

- **Bulk operations** — bulk terminate, ratelimit, shaper-restore for mass subscriber actions (`06455e1`)
- **DNS forwarding** — config update + cache flush (`c89cac1`)
- **Advanced firewall** — NAT egress/masquerade/public-IP CRUD, firewall groups CRUD, sysctl set, conntrack settings (`e0221f6`)
- **Scheduler** — job CRUD (create, delete, run) (`f7a5db7`)
- **Zone firewall, VRRP, limits, event hooks** — zone create/delete, VRRP failover/restart, limits config, event hooks CRUD (`28e2b5f`)

### Added — Phase 2: Real-time & Alerting

- **Live activity feed** (`/audit`) — cross-node activity polling from AuditLog (`d53134e`)
- **Alert system** (`/alerts`) — threshold rules CRUD, in-page evaluator, event history, webhook notifications (`d71c320`)

### Added — Phase 1: Foundation

- **Multi-node management** — add, monitor, and control multiple dawos-agent BNG nodes from a single dashboard
- **28 pages** — dashboard overview, node list, add node, and 17 per-node category pages (sessions, service, config, firewall, network, traffic, pppoe, routing, ip-pool, monitoring, logs, system, dhcp, diagnostics, events, history, radius) plus audit, alerts, operations, users, settings
- **14 API routes** — auth, setup, node CRUD, health check, universal proxy, SSE streaming, activity/export, alert rules/events, fleet operations/overview
- **Role-based access control** — admin, operator, viewer roles with route-level enforcement
- **API key encryption** — AES-256-GCM with scrypt-derived keys; API keys encrypted at rest
- **Secure proxy architecture** — all dawos-agent communication through Next.js API routes; BNG credentials never reach the browser
- **Audit logging** — central audit trail for all node operations
- **Responsive UI** — mobile-first design with sidebar, mobile nav, skeleton loading, toast notifications
- **Dark mode** — CSS variable-based theming with Tailwind dark variant support
- **Embedded database** — SQLite via Prisma 7 with driver adapter pattern
- **One-command install** — `npx dawu-manager` for immediate launch

### Fixed

- **Prefix-aware query invalidation** — mutations now correctly refresh all related queries using first-segment matching (`b60ed4d`)
- **Impact-explicit confirmations** — destructive BNG actions (config apply, firewall save, service restart) require confirmation dialogs that name the consequence (`6e0bdfe`)
- **Node feature pages** — correct data mapping to match real dawos-agent production response shapes (`e82f9db`)
- **Graceful 404/405 handling** — node pages show "feature not available" instead of error cards for unsupported endpoints (`2a20fd6`)
- **Bulk ratelimit contract** — fixed request body to `items[{username, rate}]` matching dawos-agent API (`1a2f116`)

### Security

- JWT session strategy with 24-hour expiry
- bcrypt password hashing (cost factor 12)
- CSRF protection via NextAuth token validation
- Non-root Docker image (UID 1001)

---

[Unreleased]: https://github.com/Cepat-Kilat-Teknologi/dawu-manager/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Cepat-Kilat-Teknologi/dawu-manager/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Cepat-Kilat-Teknologi/dawu-manager/releases/tag/v0.1.0
