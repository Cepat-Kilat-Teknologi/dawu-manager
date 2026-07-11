# dawos-agent API Gaps

Gaps discovered while building dawu-manager features. Each entry records what
dawu-manager needs, what dawos-agent provides (or doesn't), and how dawu-manager
copes meanwhile. Maintained per the format in `PROMPT_P3_P4.md` section 4.

---

## 1. No aggregate network throughput endpoint

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET` — no path exists |
| **Feature** | P4c dashboard overview: "Aggregate throughput (sum of rx/tx)" |
| **What is wrong** | Missing. dawos-agent exposes no per-node or aggregate network throughput (rx/tx bytes or bps) endpoint. `system/metrics` returns CPU/memory/disk only. `sessions/stats` returns session counts and CPU string. `monitoring/metrics` proxies node_exporter (404 when inactive) and is Prometheus-format, not JSON — unsuitable for quick aggregation. |
| **Expected contract** | `GET system/metrics` or a new `GET traffic/stats` returning `{ rx_bytes: number, tx_bytes: number, rx_bps: number, tx_bps: number }` (or per-interface breakdown). |
| **Severity** | Degrades feature — throughput tile omitted from fleet overview. |
| **Coping strategy** | Fleet overview omits throughput entirely. The stat card row shows active subscribers, online/offline/degraded counts instead. When dawos-agent adds a throughput endpoint, dawu-manager can add a fifth stat card with no structural changes. |

## 2. `sessions/stats` returns string fields

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET sessions/stats` |
| **Feature** | P4c dashboard overview: active subscriber count |
| **What is wrong** | Shape mismatch (cosmetic). `active`, `cpu_percent`, `pool_used`, `pool_total` are returned as strings, not numbers. dawu-manager must `Number()` coerce. |
| **Expected contract** | Numeric fields should be `number`, not `string`. |
| **Severity** | Cosmetic — dawu-manager copes with `Number(value) \|\| 0`. |
| **Coping strategy** | `Number()` coercion with `\|\| 0` fallback in the fleet overview aggregation. |

## 3. Bulk endpoint request body schemas undocumented

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST bulk/terminate`, `POST bulk/ratelimit`, `POST bulk/shaper-restore` |
| **Feature** | P3 Group 1: mass subscriber operations (sessions page) |
| **What is wrong** | Undocumented. `docs/API_COVERAGE.md` lists the three endpoints but does not document their request body schemas (required fields, types, constraints). dawu-manager assumes `{ usernames: string[] }` for terminate and shaper-restore, and `{ usernames: string[], rate: string }` for ratelimit, inferred from the single-session equivalents (`sessions/terminate` takes `{ username }`, `traffic/ratelimit/{user}` takes `{ rate }`). |
| **Expected contract** | Explicit request body documentation: `{ usernames: string[] }` for terminate/shaper-restore, `{ usernames: string[], rate: string }` for ratelimit — or whatever the agent actually accepts. |
| **Severity** | Degrades feature — the bulk forms may send a wrong shape if the agent expects different field names or additional fields. |
| **Coping strategy** | dawu-manager sends the inferred shapes. If the agent rejects them, the proxy surfaces the error as a toast. The forms are functional but unvalidated against real agent behavior until P1b live testing. |

## 4. Zone API path mismatch

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/v1/zones`, `POST /api/v1/zones`, `DELETE /api/v1/zones/{name}` |
| **Feature** | P3 Group 5: zone firewall management (diagnostics page) |
| **What is wrong** | Path mismatch. dawu-manager's diagnostics page originally read zones via `firewall/zones`, but dawos-agent serves zones at `/api/v1/zones` (not under `firewall/`). The zone CRUD endpoints (create, delete) also live at `/api/v1/zones`. |
| **Expected contract** | Zones at `/api/v1/zones` — confirmed by integration test report. |
| **Severity** | Cosmetic — fixed in dawu-manager by changing proxy path from `firewall/zones` to `zones`. |
| **Coping strategy** | dawu-manager now uses `zones` as the proxy path for all zone operations (read, create, delete). No dawos-agent change needed. |

## 5. No `conntrack/flush` endpoint

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST conntrack/flush` — does not exist |
| **Feature** | P3 Group 7: conntrack tuning (diagnostics page) |
| **What is wrong** | Missing. dawos-agent exposes `GET conntrack/entries` and `PUT conntrack/settings` but has no endpoint to flush/clear the conntrack table. |
| **Expected contract** | `POST conntrack/flush` returning `{ message: "Conntrack table flushed" }` or similar. |
| **Severity** | Degrades feature — conntrack flush button cannot be implemented. |
| **Coping strategy** | dawu-manager omits the flush action. The diagnostics page shows conntrack entries (read-only) and allows updating conntrack settings via `PUT conntrack/settings`. Flush can be added when dawos-agent implements the endpoint. |
