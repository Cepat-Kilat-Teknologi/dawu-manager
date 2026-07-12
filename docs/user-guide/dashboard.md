# Dashboard Overview

The dashboard is the landing page after login. It provides a fleet-wide summary of all registered BNG nodes, aggregating health status, subscriber counts, and operational metrics into a single view.

---

## Fleet Statistics

The top section displays four summary cards:

| Card | Description |
|------|-------------|
| Total Nodes | Number of dawos-agent instances registered in dawu-manager |
| Online | Nodes that responded successfully to the last health check |
| Offline | Nodes that failed their last health check or are unreachable |
| Degraded | Nodes that responded but reported partial functionality issues |

Below these summary cards, the dashboard shows aggregate fleet metrics when nodes are online:

- **Total active subscribers** -- Sum of active PPPoE sessions across all online nodes.
- **Top nodes by load** -- Ranked list of nodes by active session count, highlighting which BNG nodes carry the most traffic.
- **Online/offline ratio** -- Quick visual indicator of fleet health.

!!! note "Data freshness"
    Fleet statistics are fetched when the dashboard loads and refresh automatically via TanStack Query polling. Individual node health data updates based on the most recent health check.

---

## Node Cards

Each registered node appears as a card on the dashboard showing:

| Element | Description |
|---------|-------------|
| Node name | The human-readable identifier assigned during registration |
| Location | Physical location or descriptive label (if set) |
| Status indicator | Color-coded badge: green (online), red (offline), yellow (degraded), gray (unknown) |
| Last seen | Timestamp of the last successful health check |
| Quick actions | Links to the node detail page and manual health check |

### Status Indicator Colors

| Status | Color | Meaning |
|--------|-------|---------|
| Online | Green | Node is healthy and responding normally to health checks |
| Offline | Red | Node is unreachable or returned an error on the last health check |
| Degraded | Yellow | Node responded but indicated partial functionality issues |
| Unknown | Gray | Node has never been health-checked since registration |

---

## Dashboard Actions

From the dashboard, you can:

- **Click a node card** to navigate to its detail page with full management capabilities.
- **Trigger a health check** on any individual node using the health check button on its card.
- **Navigate to Fleet Operations** to run cross-node operations (health check, restart, bulk terminate).
- **Access the Audit Trail** from the sidebar to review recent management actions.
- **Check Alerts** from the sidebar to view active alert rules and event history.

---

## Graceful Degradation

If one or more nodes are unreachable during the fleet overview data fetch, the dashboard continues to display data from the nodes that responded. Failed nodes show their last known status rather than causing the entire dashboard to error.

This design ensures that a single unresponsive BNG node does not prevent operators from managing the rest of the fleet.
