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
