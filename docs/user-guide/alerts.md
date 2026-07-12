# Alerts

dawu-manager includes a threshold-based alert system that monitors BNG node metrics and triggers notifications when configured thresholds are exceeded.

---

## Alert Rules

An alert rule defines a condition that is evaluated against node metrics. When the condition is met, the alert fires and an event is recorded.

### Creating an Alert Rule

Navigate to **Alerts** in the sidebar, then click **Create Rule**.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Name | Text | Human-readable identifier for the rule | `High session count` |
| Metric | Select | The metric to monitor | `sessions.active` |
| Operator | Select | Comparison operator | `>`, `>=`, `<`, `<=`, `==`, `!=` |
| Threshold | Number | The value to compare against | `500` |
| Node | Select | Target node (or all nodes) | `bng-jakarta-dc1-01` |
| Enabled | Toggle | Whether the rule is active | On/Off |

### Available Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| `sessions.active` | Number of active PPPoE sessions | Count |
| `system.cpu` | CPU utilization | Percentage (0-100) |
| `system.memory` | Memory utilization | Percentage (0-100) |
| `system.disk` | Disk utilization | Percentage (0-100) |
| `node.status` | Node health status | Enum (online, offline, degraded) |

### Comparison Operators

| Operator | Meaning |
|----------|---------|
| `>` | Greater than |
| `>=` | Greater than or equal to |
| `<` | Less than |
| `<=` | Less than or equal to |
| `==` | Equal to |
| `!=` | Not equal to |

---

## Alert Events

When an alert rule condition is satisfied, an alert event is created and stored in the database. Each event records:

| Field | Description |
|-------|-------------|
| Rule name | Which rule triggered the event |
| Node | The node that exceeded the threshold |
| Metric value | The actual value at the time of the alert |
| Threshold | The configured threshold value |
| Timestamp | When the alert was triggered |

---

## Managing Alert Rules

### Viewing Rules

The alerts page displays all configured rules in a table:

| Column | Description |
|--------|-------------|
| Name | Rule identifier |
| Metric | The monitored metric |
| Condition | The operator and threshold (e.g., `> 500`) |
| Node | Target node or "All nodes" |
| Enabled | Whether the rule is currently active |
| Actions | Edit and delete buttons |

### Editing Rules

Click **Edit** on any rule to modify its parameters. Changes take effect on the next evaluation cycle.

### Deleting Rules

Click **Delete** on a rule and confirm the deletion. Deleting a rule does not remove its historical alert events.

### Enabling and Disabling Rules

Toggle the **Enabled** switch to activate or deactivate a rule without deleting it. Disabled rules are not evaluated and do not generate events.

---

## Alert Event History

Below the rules table, the alerts page shows a chronological list of alert events. Each entry shows:

- The rule that triggered the alert.
- The affected node.
- The metric value that exceeded the threshold.
- The timestamp.

Events are displayed in reverse chronological order (most recent first).

---

## Example Configurations

### High Session Count Warning

Detect when a BNG node is approaching capacity:

| Field | Value |
|-------|-------|
| Name | `High session count` |
| Metric | `sessions.active` |
| Operator | `>` |
| Threshold | `800` |
| Node | All nodes |

### Node Offline Detection

Detect when a specific node goes offline:

| Field | Value |
|-------|-------|
| Name | `Jakarta DC1 offline` |
| Metric | `node.status` |
| Operator | `==` |
| Threshold | `offline` |
| Node | `bng-jakarta-dc1-01` |

### High CPU Utilization

Detect CPU pressure on production nodes:

| Field | Value |
|-------|-------|
| Name | `CPU critical` |
| Metric | `system.cpu` |
| Operator | `>` |
| Threshold | `90` |
| Node | All nodes |

---

## Permissions

| Action | Required Role |
|--------|---------------|
| View alert rules | Viewer, Operator, Admin |
| View alert events | Viewer, Operator, Admin |
| Create alert rules | Operator, Admin |
| Edit alert rules | Operator, Admin |
| Delete alert rules | Operator, Admin |
