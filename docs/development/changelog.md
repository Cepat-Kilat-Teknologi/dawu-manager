# Changelog

All notable changes to dawu-manager are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Session history page** (`/nodes/[nodeId]/history`) -- Session history table with stats grid, snapshot creation, CSV export, and purge with confirmation dialog.
- **RADIUS diagnostics page** (`/nodes/[nodeId]/radius`) -- RADIUS config and status display, interactive health check with latency reporting and toast feedback.
- **PPPoE runtime config** -- Live PPPoE runtime configuration display (service name, AC name, session limits) on the PPPoE page.
- **IP pool detail** -- Per-pool allocation detail with expandable accordion showing IP, username, and session ID for each allocation.
- **Session history CSV export** -- Export session history entries to CSV file via browser download.

### Fixed

- **History page data extraction** -- Fixed `extract: "sessions"` → `extract: "records"` to match dawos-agent response shape; history table now loads correctly (`fc75f26`).

### Changed

- Updated documentation -- README, CHANGELOG, testing guide, node features guide, upgrade guide to reflect current project state (1176 tests, 42 routes, 90 test files, 28 pages, 17 node feature pages).
- **Integration tested all 17 node feature pages** against live dawos-dev BNG node -- all passing (Sessions, Service, Config, Firewall, Network, Traffic, PPPoE, Routing, IP Pool, Monitoring, Logs, System, DHCP, Diagnostics, Events, History, RADIUS).

---

## [0.1.0] - 2026-07-12

The initial public release of dawu-manager. Published to npm and ghcr.io.

### Added -- Phase 4: Multi-Node Features

- **Fleet operations** (`/operations`) -- Cross-node concurrent fan-out: health check, restart, bulk terminate across selected nodes with per-node result reporting.
- **Audit trail** (`/audit`) -- Filterable by user, node, action, and date range with CSV export. CSV formula injection neutralization for safe spreadsheet import.
- **Fleet overview** (`/`) -- Live aggregate stats: total subscribers, online/offline/degraded counts, top nodes by load with graceful per-node degradation.

### Added -- Phase 3: Write Endpoint Surface (~50 endpoints)

- **Bulk operations** -- Bulk terminate, rate limit, shaper-restore for mass subscriber actions.
- **DNS forwarding** -- Configuration update and cache flush.
- **Advanced firewall** -- NAT egress/masquerade/public-IP CRUD, firewall groups CRUD, sysctl set, conntrack settings.
- **Scheduler** -- Job CRUD (create, delete, run).
- **Zone firewall, VRRP, limits, event hooks** -- Zone create/delete, VRRP failover/restart, limits config, event hooks CRUD.

### Added -- Phase 2: Real-time and Alerting

- **Live activity feed** (`/audit`) -- Cross-node activity polling from AuditLog.
- **Alert system** (`/alerts`) -- Threshold rules CRUD, in-page evaluator, event history, webhook notifications.

### Added -- Phase 1: Foundation

- **Multi-node management** -- Add, monitor, and control multiple dawos-agent BNG nodes from a single dashboard.
- **28 pages** -- Dashboard overview, node list, add node, and 17 per-node category pages (sessions, service, config, firewall, network, traffic, pppoe, routing, ip-pool, monitoring, logs, system, dhcp, diagnostics, events, history, radius) plus audit, alerts, operations, users, settings.
- **14 API routes** -- Auth, setup, node CRUD, health check, universal proxy, SSE streaming, activity/export, alert rules/events, fleet operations/overview.
- **Role-based access control** -- Admin, operator, viewer roles with route-level enforcement.
- **API key encryption** -- AES-256-GCM with scrypt-derived keys; API keys encrypted at rest.
- **Secure proxy architecture** -- All dawos-agent communication through Next.js API routes; BNG credentials never reach the browser.
- **Audit logging** -- Central audit trail for all node operations.
- **Responsive UI** -- Mobile-first design with sidebar, mobile nav, skeleton loading, toast notifications.
- **Dark mode** -- CSS variable-based theming with Tailwind dark variant support.
- **Embedded database** -- SQLite via Prisma 7 with driver adapter pattern.
- **One-command install** -- `npx dawu-manager` for immediate launch.
- **Docker image** -- Multi-platform image (amd64 + arm64) published to ghcr.io.
- **1176 tests** across 90 test files with comprehensive code coverage.

### Fixed

- **Prefix-aware query invalidation** -- Mutations now correctly refresh all related queries using first-segment matching.
- **Impact-explicit confirmations** -- Destructive BNG actions (config apply, firewall save, service restart) require confirmation dialogs that name the consequence.
- **Node feature pages** -- Correct data mapping to match real dawos-agent production response shapes.
- **Graceful 404/405 handling** -- Node pages show "feature not available" instead of error cards for unsupported endpoints.
- **Bulk ratelimit contract** -- Fixed request body to `items[{username, rate}]` matching dawos-agent API.

### Security

- JWT session strategy with 24-hour expiry.
- bcrypt password hashing (cost factor 12).
- CSRF protection via NextAuth token validation.
- Non-root Docker image (UID 1001).
- CSV export formula injection neutralization.
- RBAC enforcement on audit log endpoints.

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-07-12 | Initial release: multi-node management, 28 pages, 14 API routes, fleet operations, audit trail, alerts |

---

[Unreleased]: https://github.com/Cepat-Kilat-Teknologi/dawu-manager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Cepat-Kilat-Teknologi/dawu-manager/releases/tag/v0.1.0
