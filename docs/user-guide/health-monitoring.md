# Health Monitoring

dawu-manager monitors the health of registered BNG nodes by querying the dawos-agent `/health` endpoint. Health check results determine the node's status indicator displayed throughout the dashboard.

---

## How Health Checks Work

When a health check is triggered, dawu-manager:

1. Decrypts the stored API key for the target node.
2. Sends an HTTP GET request to `<node-url>/health`.
3. Evaluates the response status and body.
4. Updates the node's `status` and `lastSeen` fields in the database.

The health endpoint on dawos-agent returns:

```json
{
  "status": "ok",
  "version": "0.3.3",
  "node_name": "bng-jakarta-dc1-01",
  "uptime": "5d 12h 34m"
}
```

---

## Status Indicators

| Status | Color | Condition |
|--------|-------|-----------|
| Online | Green | Node responded with HTTP 200 and `status: "ok"` |
| Offline | Red | Node is unreachable, timed out, or returned an HTTP error |
| Degraded | Yellow | Node responded but reported partial functionality issues |
| Unknown | Gray | Node has never been health-checked since registration |

---

## Manual Health Check

Click the **Check Health** button on any node card (dashboard) or node detail page to trigger an immediate health check. The status indicator updates in real time based on the response.

---

## Health Check Data Flow

```
dawu-manager                              BNG Node
+-------------------+                     +-----------------+
| API Route         |  GET /health        | dawos-agent     |
| /api/nodes/[id]/  | -----------------> | :8470           |
|   health          |                     |                 |
|                   | <-- 200 OK -------- | {"status":"ok"} |
| Update DB:        |                     +-----------------+
|   status="online" |
|   lastSeen=now()  |
+-------------------+
```

---

## Troubleshooting Unhealthy Nodes

When a node shows as **Offline**, investigate the following in order:

### 1. Verify dawos-agent Is Running

SSH into the BNG node and check the service status:

```bash
sudo systemctl status dawos-agent
```

If the service is stopped, start it:

```bash
sudo systemctl start dawos-agent
```

### 2. Test the Health Endpoint Locally

On the BNG node itself:

```bash
curl -sf http://localhost:8470/health
```

If this fails, the issue is with dawos-agent or its configuration, not with network connectivity.

### 3. Check Network Connectivity

From the dawu-manager host, test connectivity to the BNG node:

```bash
curl -sf http://<node-ip>:8470/health
```

If this times out, check:

- Firewall rules on both the dawu-manager host and the BNG node (port 8470 must be open).
- Network routing between the two hosts.
- Any VPN or tunnel configurations that may affect connectivity.

### 4. Verify the API Key

Test authentication from the dawu-manager host:

```bash
curl -sf -H 'X-API-Key: <api-key>' http://<node-ip>:8470/api/v1/sessions
```

If this returns HTTP 401, the API key stored in dawu-manager does not match the key configured on the BNG node. Edit the node in dawu-manager and update the API key.

### 5. Check dawos-agent Logs

On the BNG node:

```bash
sudo journalctl -u dawos-agent --since '10 minutes ago' --no-pager
```

Look for startup errors, binding failures, or authentication rejection messages.

---

## Health Check Timeout

Each health check request has a timeout of 10 seconds. If the dawos-agent instance does not respond within this window, the node is marked as **Offline**.

Common causes of timeouts:

- High CPU load on the BNG node causing slow response.
- Network congestion or packet loss between dawu-manager and the BNG node.
- dawos-agent process is running but unresponsive (hung state).

---

## Permissions

All authenticated users (viewer, operator, and admin) can view node health status and trigger manual health checks. No elevated role is required for read-only health monitoring.
