# Fleet Operations

Fleet operations allow you to execute actions across multiple BNG nodes simultaneously. This is useful for fleet-wide health checks, service restarts, bulk session termination, and rate limit enforcement.

---

## Accessing Fleet Operations

Navigate to **Operations** in the sidebar under the Management section.

---

## Operation Types

| Operation | Method | Description | Destructive |
|-----------|--------|-------------|:-----------:|
| Health Check | GET | Query the `/health` endpoint on each selected node | No |
| Restart Service | POST | Restart the accel-ppp service on each selected node | Yes |
| Bulk Terminate | POST | Disconnect specified PPPoE sessions across selected nodes | Yes |
| Bulk Rate Limit | POST | Apply traffic rate limits to specified subscribers across selected nodes | No |

---

## Using Fleet Operations

### Step 1: Select Nodes

The operations page displays all registered nodes with checkboxes. Select the nodes you want to target.

- Use **Select All** to target every registered node.
- Deselect nodes that should be excluded from the operation.
- The run button is disabled until at least one node is selected.

### Step 2: Choose an Operation

Select the operation type from the dropdown. Destructive operations (restart, bulk terminate) display a red **Destructive** badge next to their name.

### Step 3: Provide Parameters (If Required)

Some operations require additional input:

| Operation | Required Parameters |
|-----------|--------------------|
| Health Check | None |
| Restart Service | None |
| Bulk Terminate | Comma-separated list of usernames to disconnect |
| Bulk Rate Limit | List of items, each with a username and rate value (e.g., `5M/20M`) |

### Step 4: Confirm and Execute

For non-destructive operations (health check), clicking **Run** executes immediately.

For destructive operations, a confirmation dialog appears showing:

- The operation name.
- The number of targeted nodes.
- The number of affected sessions or usernames (if applicable).
- A warning about the consequences.

Click **Confirm** to proceed or **Cancel** to abort.

---

## Execution Model

Fleet operations use a concurrent fan-out pattern:

```
dawu-manager
    |
    +-- POST /api/fleet/operations
    |       |
    |       +-- Node 1: POST /service/action  (concurrent)
    |       +-- Node 2: POST /service/action  (concurrent)
    |       +-- Node 3: POST /service/action  (concurrent)
    |       |
    |       +-- Collect results (wait for all)
    |
    +-- Return aggregated results
```

Key characteristics:

- **Concurrent execution** -- All targeted nodes receive the request simultaneously using `Promise.all`.
- **Independent failure handling** -- Each node request is wrapped in a try/catch. If one node fails (unreachable, timeout, error), the results from other nodes are still returned.
- **Per-node timeout** -- Each individual node request has a 15-second timeout. A single slow node does not block the entire operation.
- **Partial results** -- The response includes both successful and failed results, allowing operators to identify which nodes had issues.

---

## Response Format

After execution, the results panel displays a per-node breakdown:

| Column | Description |
|--------|-------------|
| Node | Node name |
| Status | Success or failure indicator |
| Response | Response body or error message from the node |
| Duration | Time taken for that specific node's request |

Failed nodes show the error reason (timeout, connection refused, authentication failure, HTTP error code).

---

## Permissions

| Action | Required Role |
|--------|---------------|
| View operations page | Operator, Admin |
| Execute health check | Operator, Admin |
| Execute destructive operations | Operator, Admin |

Viewers cannot access the fleet operations page.

---

## Operational Considerations

### Network Partitions

If a network partition isolates some nodes, the operation completes for reachable nodes and reports failures for unreachable ones. No retry is attempted automatically.

### Service Restart Impact

Restarting the accel-ppp service on a node disconnects all active PPPoE subscribers on that node. Subscribers reconnect automatically via their CPE equipment, but there is a brief service interruption. Plan restart operations during maintenance windows when possible.

### Bulk Terminate Scope

Bulk terminate sends the provided usernames to each selected node. A node that does not have an active session for a given username simply ignores that username -- no error is raised. This allows you to broadcast a termination request across all nodes without needing to know which node hosts a particular session.

### Rate Limit Format

Rate limit values use the format `<download>/<upload>` where each value can use suffixes:

| Suffix | Meaning |
|--------|---------|
| `K` | Kilobits per second |
| `M` | Megabits per second |
| `G` | Gigabits per second |

Examples: `5M/2M` (5 Mbps down, 2 Mbps up), `100M/50M`, `1G/500M`.
