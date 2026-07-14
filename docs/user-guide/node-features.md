# Node Feature Pages

Each registered node has 17 category pages accessible from the node detail sidebar. These pages provide read and write access to the dawos-agent API endpoints on that specific BNG node.

All operations on these pages are proxied through dawu-manager's server-side API routes. The browser never contacts the BNG node directly.

---

## Sessions

**Path:** `/nodes/[nodeId]/sessions`

Displays active PPPoE sessions on the BNG node.

| Feature | Description |
|---------|-------------|
| Session list | Table of active sessions with username, IP, MAC, interface, uptime, and rates |
| Search | Filter sessions by username or IP address |
| Terminate | Disconnect individual sessions (operator+ role required) |
| Bulk terminate | Disconnect multiple sessions at once |
| CSV export | Export current session list to CSV file |

---

## Service

**Path:** `/nodes/[nodeId]/service`

Controls the accel-ppp service on the BNG node.

| Feature | Description |
|---------|-------------|
| Service status | Current state of the accel-ppp service (active, inactive, failed) |
| Start | Start the accel-ppp service |
| Stop | Stop the accel-ppp service (terminates all active sessions) |
| Restart | Restart the accel-ppp service |
| Version | Display the installed accel-ppp version |

!!! danger "Destructive action"
    Stopping or restarting the accel-ppp service disconnects all active PPPoE sessions on the node. A confirmation dialog is shown before execution.

---

## Config

**Path:** `/nodes/[nodeId]/config`

Manages the accel-ppp configuration file (`/etc/accel-ppp.conf`).

| Feature | Description |
|---------|-------------|
| Config viewer | Display the current configuration |
| Config editor | Edit the configuration text |
| Apply with guard timer | Apply changes with a configurable rollback timer (in minutes) |
| Diff | Compare the running configuration against a saved backup |
| Backup list | View and restore previous configuration backups |
| Backup/restore | Create manual backups and restore from any saved backup |

!!! warning "Guard timer"
    When applying a configuration change, specify a `confirm_minutes` value. If not confirmed within that window, the configuration automatically rolls back to the previous version. This prevents lockout from misconfiguration.

---

## Firewall

**Path:** `/nodes/[nodeId]/firewall`

Manages nftables firewall rules, NAT, and related settings.

| Feature | Description |
|---------|-------------|
| Firewall rules | View active nftables rules |
| Validate | Validate pending ruleset before applying |
| Save | Persist current rules to disk |
| NAT egress | Manage egress NAT rules for subscriber traffic |
| NAT masquerade | Configure masquerade rules for outbound traffic |
| Groups | Create and manage address/port groups |
| Sysctl | View and modify kernel network parameters |
| Conntrack | Configure connection tracking settings, profiles, and timeouts |

---

## Network

**Path:** `/nodes/[nodeId]/network`

Manages network interfaces, routes, VLANs, and DNS.

| Feature | Description |
|---------|-------------|
| Interfaces | List all network interfaces with state, addresses, and flags |
| Routes | View, add, and delete static routes (destination, gateway, device, metric) |
| VLANs | Create, edit, and delete VLAN interfaces (parent, VLAN ID, address) |
| DNS | View and update DNS resolver configuration |

---

## Traffic

**Path:** `/nodes/[nodeId]/traffic`

Monitors and shapes subscriber traffic.

| Feature | Description |
|---------|-------------|
| Traffic overview | Current traffic statistics and shaping status |
| Per-user rate limit | Apply or remove rate limits for individual subscribers (format: `5M/20M`) |
| Shaper restore | Bulk restore shaper settings for subscribers |

---

## PPPoE

**Path:** `/nodes/[nodeId]/pppoe`

Manages PPPoE-specific settings.

| Feature | Description |
|---------|-------------|
| PPPoE interfaces | List, add, and remove PPPoE listener interfaces |
| MAC filters | Add and remove MAC address filters |
| PADO delay | Configure PPPoE Active Discovery Offer delay |
| Runtime config | Display live PPPoE runtime configuration (service name, AC name, session limits) |

---

## Routing

**Path:** `/nodes/[nodeId]/routing`

Manages dynamic routing protocols via FRRouting (FRR).

| Feature | Description |
|---------|-------------|
| BGP | View BGP neighbor status, routes, and summaries |
| OSPF | View OSPF neighbor status and database |
| RIP | View RIP routes and status |
| BFD | View Bidirectional Forwarding Detection peer status |

!!! note "FRR dependency"
    Dynamic routing features require FRRouting (FRR) to be installed on the BNG node. If FRR is not installed, these pages display a "feature not available" message.

---

## IP Pool

**Path:** `/nodes/[nodeId]/ip-pool`

Manages IP address pools for subscriber assignment.

| Feature | Description |
|---------|-------------|
| Pool list | View configured IP address pools with usage bars (green/amber/red thresholds) |
| Usage tiles | Aggregate usage statistics (used, total, available) with overall usage bar |
| Pool detail | Expandable accordion showing per-pool allocations (IP, username, session ID) |
| Add pool | Create a new pool with name and CIDR range (e.g., `10.0.0.0/24`) |
| Delete pool | Remove an existing pool |

---

## Monitoring

**Path:** `/nodes/[nodeId]/monitoring`

Displays monitoring exporter status and metrics.

| Feature | Description |
|---------|-------------|
| Exporter status | Show which monitoring exporters are active (node_exporter, etc.) |
| Metrics | Display available system metrics when exporters are running |

---

## Logs

**Path:** `/nodes/[nodeId]/logs`

Provides log viewing and live streaming.

| Feature | Description |
|---------|-------------|
| Log viewer | Display recent log entries from systemd journal |
| Live streaming | Real-time log tailing via Server-Sent Events (SSE) |
| Unit selector | Choose which systemd unit to view logs for |
| Line count | Configure the number of log lines to retrieve |

!!! note "Log source"
    accel-ppp writes logs to `/var/log/accel-ppp/accel-ppp.log`, not to the systemd journal. The log viewer shows journald entries, which may contain only service start/stop events. For full accel-ppp logs, check the log file directly on the BNG node.

---

## System

**Path:** `/nodes/[nodeId]/system`

Displays system-level information about the BNG node.

| Feature | Description |
|---------|-------------|
| System info | Hostname, OS, kernel version, uptime |
| Health | Overall system health status |
| Metrics | CPU, memory, disk, and network utilization displayed as stat cards |

---

## DHCP

**Path:** `/nodes/[nodeId]/dhcp`

Manages DHCP server and relay functionality.

| Feature | Description |
|---------|-------------|
| DHCP status | Current DHCP server/relay configuration and state |
| Restart | Restart the DHCP service or relay |

---

## Diagnostics

**Path:** `/nodes/[nodeId]/diagnostics`

Network diagnostics and connection tracking tools.

| Feature | Description |
|---------|-------------|
| Zones | View and manage firewall zones |
| Conntrack entries | List active connection tracking entries |
| Conntrack limits | View and configure connection tracking table limits |
| Conntrack flush | Clear the connection tracking table |

---

## Events

**Path:** `/nodes/[nodeId]/events`

Manages event hooks and webhooks on the BNG node.

| Feature | Description |
|---------|-------------|
| Hook list | View configured event hooks |
| Add hook | Create a new event hook with trigger conditions |
| Delete hook | Remove an existing event hook |
| Fire event | Manually trigger an event for testing |

---

## History

**Path:** `/nodes/[nodeId]/history`

Manages session history snapshots and historical data.

| Feature | Description |
|---------|-------------|
| History table | View historical session entries with username, IP, MAC, interface, start/end time, duration, and terminate cause |
| Statistics | Aggregate history stats grid (total sessions, average duration, peak concurrent) |
| Snapshot | Capture a point-in-time snapshot of current active sessions into history |
| CSV export | Export all session history entries to a CSV file via browser download |
| Purge | Permanently delete all session history entries (with confirmation dialog) |
| Refresh | Independently refresh the history table and statistics sections |

---

## RADIUS

**Path:** `/nodes/[nodeId]/radius`

RADIUS server diagnostics and health checking.

| Feature | Description |
|---------|-------------|
| Configuration | Read-only display of RADIUS configuration (auth/acct server, ports). Shared secrets are never exposed via the API |
| Status | Current RADIUS connection status and request/response counters |
| Health check | Interactive connectivity test to the configured RADIUS server with latency measurement and pass/fail reporting |
| Extra fields | Health check results display additional server metadata (server type, version) when available |

!!! note "Security"
    The RADIUS configuration page displays server addresses and ports only. Shared secrets are intentionally excluded from the API response and never appear in the dashboard.

---

## Feature Availability

Not all BNG nodes have every optional package installed. When a feature page accesses a dawos-agent endpoint that returns HTTP 404 or 405, the page displays a "Feature not available on this node" message instead of an error. This allows operators to work with heterogeneous node configurations without encountering errors.

| Optional Package | Features Enabled |
|-----------------|------------------|
| dnsmasq | DNS forwarding endpoints |
| keepalived | VRRP failover and restart |
| FRRouting (FRR) | BGP, OSPF, RIP, BFD routing |

---

## Permissions

| Action | Required Role |
|--------|---------------|
| View any feature page | Viewer, Operator, Admin |
| Execute write operations | Operator, Admin |
| Destructive operations (terminate, restart, delete) | Operator, Admin (with confirmation dialog) |
