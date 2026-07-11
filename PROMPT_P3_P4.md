# Prompt — Execute P3 + P4 of the dawu-manager roadmap

> Hand this to a fresh coding-agent session opened **inside the dawu-manager
> repo**. It is self-contained; the agent should read the referenced files
> rather than trust this summary.

You are a senior full-stack engineer working in **dawu-manager**
(`~/Projects/ckt/accel-app/dawu-manager`) — a Next.js 16 NOC dashboard that
manages multiple **dawos-agent** BNG nodes over HTTP.

## 0. Read first (do not skip)
- `CLAUDE.md` — stack, patterns, gotchas, commands, RBAC, test rules. Authoritative.
- `AGENTS.md` — "this is NOT the Next.js you know"; read the relevant guide in
  `node_modules/next/dist/docs/` before writing Next code.
- `rekomendasi.md` — the roadmap. Your scope is **P3** and **P4** (§ "PRIORITAS 3 / 4").
  P1a/P1c/P2a/P2b are DONE; **P1b is user-blocked** (needs a dawos-dev API key);
  P5 is out of scope.
- `docs/API_COVERAGE.md` — the dawos-agent endpoint schema (request/response
  shapes). This is your contract for every write you wire.
- `docs/DESIGN.md`, `docs/NODE_PAGES_FIX.md` — design contract + per-page data truth.

## 1. Mission
Ship the P3 write-endpoint surface and the P4 multi-node features at the existing
quality bar: **100% test coverage, lint clean, build green.** Work in **vertical
slices** — one feature area fully implemented + tested + committed before the
next. Never open one giant change.

## 2. Non-negotiable rules
- **NEVER fire writes against accel-2 (192.168.212.226) — it is PRODUCTION.**
  Every write is unproven until run against **dawos-dev** with a dev key (that is
  P1b, the user's job). So implement UI + proxy client + tests against the
  **documented contract** (`docs/API_COVERAGE.md`). Where the contract is
  ambiguous, **do not guess** — record it in `docs/DAWOS_AGENT_GAPS.md` (§4).
- **Proxy architecture**: the browser never touches a BNG. All node I/O goes
  through `useNodeProxy` / `useNodeProxyMutation` → `/api/nodes/[nodeId]/proxy/[...path]`
  (the X-API-Key is injected server-side). Cross-node/fleet features fan out
  server-side too — never expose a node key to the browser.
- **Destructive actions** get an impact-explicit `ConfirmDialog` — follow the
  P1c pattern already in the service / firewall / config pages (name the
  consequence, e.g. "N active sessions will be disconnected").
- **Quality gate before EVERY commit**: `pnpm lint && pnpm test:coverage && pnpm build`
  all green; 100% coverage (statements/branches/functions/lines). Avoid
  unreachable defensive branches (`x?.y ?? z` on values that cannot be null) —
  they break branch coverage; extract a testable helper or drop the fallback.
- **Git**: conventional commits, English, **no Co-Authored-By and no mention of
  Claude/Anthropic**, one commit per slice. **Do NOT push / open PRs / merge** —
  commit locally only.
- **Dev server**: after adding any Prisma model, restart `pnpm dev` (port 3789)
  or routes touching the new model will 500 from a stale in-memory client.

## 3. Scope

### P3 — write-endpoint surface (~50 endpoints; order = ISP daily value)
For each: wire into the relevant node page as a form + Zod v4 schema +
`useNodeProxyMutation` + toast + `invalidates`, with a `ConfirmDialog` when
destructive. Add per-node nav in `src/config/navigation.ts` when a new page is warranted.
1. **Bulk ops** — `bulk/terminate`, `bulk/ratelimit`, `bulk/shaper-restore`
   (mass subscriber actions; destructive → confirm shows the affected count).
2. **DNS forwarding** — `PUT dns/forwarding/config`, `POST dns/forwarding/flush`.
3. **Advanced firewall** — NAT egress/masquerade/public-ip CRUD, groups CRUD,
   `PUT firewall/sysctl`, `PUT firewall/conntrack` (the firewall page already
   renders these as read-only tiles — make them editable).
4. **Scheduler** — jobs CRUD + run.
5. **Zone firewall** — zones POST/DELETE.
6. **VRRP** — failover/restart (HA pairs; destructive confirm).
7. **Conntrack tuning**, **limits** (`PUT limits`), **event hooks CRUD**.

### P4 — multi-node
- **4a. Cross-node operations** (large): select N nodes → apply config / bulk
  action / playbook, dispatched concurrently server-side with per-node result
  reporting. New `/api/fleet/...` routes fanning out over the per-node proxy; new
  top-level page. Partial failure must be first-class (per-node success/fail).
- **4b. Audit trail** (medium): `/audit` already renders a live feed (P2a) over
  `/api/activity` + the `AuditLog` model. Add **filters** (user, node, action,
  date range) and **CSV export**. Extend `/api/activity` with query params + an
  export route.
- **4c. Aggregate dashboard** (medium): make `/` show real cross-node stats —
  total active subscribers, aggregate throughput, nodes online/degraded/offline,
  top nodes by load. Fan out reads server-side; degrade gracefully per down node.

**Suggested order** (lowest risk / no dawos-agent dependency first):
**4b → 4c → P3 (in the order above) → 4a.**

## 4. CRITICAL deliverable — `docs/DAWOS_AGENT_GAPS.md`
P3 depends on **dawos-agent**, a SEPARATE FastAPI repo — **do not edit it**. As
you wire each write you WILL hit endpoints that are missing, buggy, or whose
shape disagrees with `docs/API_COVERAGE.md`. Maintain a structured report the
maintainer will review to drive dawos-agent work. Per gap, record:
- endpoint (method + path) and the dawu-manager feature that needs it;
- what is wrong (missing / shape mismatch / bug / undocumented);
- expected contract (fields + types) vs. what is documented/observed;
- severity (blocks the feature / degrades it / cosmetic);
- how dawu-manager copes meanwhile (feature disabled with note / optimistic / hidden).

**Never invent a contract to make a test pass — flag it here instead.** This file
is a primary output, as important as the code.

## 5. Per-slice workflow
1. Pick the next item; read its `docs/API_COVERAGE.md` entry + the target page.
2. Implement (shadcn v5 `render` prop — **not** `asChild`; Zod v4;
   `useNodeProxyMutation(nodeId, path, { invalidates })`; toast; ConfirmDialog for destructive).
3. Test to 100% — API routes via direct function call + mock `Request`; client
   components via RTL + `vi.hoisted()`; use the existing `src/__tests__/pages/nodes/*`
   files as templates.
4. `pnpm lint && pnpm test:coverage && pnpm build` — all green.
5. Commit (conventional; no Co-Authored-By). Update `docs/DAWOS_AGENT_GAPS.md`
   and the `rekomendasi.md` status table as items land.

## 6. dawu-manager gotchas (see CLAUDE.md for the full list)
- Next 16: route `params` are **Promises** — `await params`.
- Prisma 7: no `url` in the schema block; driver adapter in `src/lib/db.ts`; `prisma.config.ts`.
- shadcn/ui v5 (@base-ui): no `asChild` — use `render`.
- NextAuth v5: login uses direct `fetch`, not `signIn()`.
- TanStack Query v5 partial-match is **element-wise, not prefix** — invalidation
  is handled by the prefix-aware predicate in `src/hooks/use-node-proxy.ts` (P1a).
  Reuse it; do not reintroduce single-segment keys that never match multi-segment ones.
- Tests: `vi.hoisted()` for mock vars; mocked `redirect()/notFound()` must throw.
- RBAC viewer < operator < admin via `requireAuth()` / `hasRole()`; password min length 4.

## 7. Definition of done
- All P3 items + P4a/b/c implemented, each committed, tests at 100%, lint + build green.
- `docs/DAWOS_AGENT_GAPS.md` complete and specific.
- `rekomendasi.md` status table updated.
- **Zero writes ever sent to accel-2. No push / PR.**
