# How to Use dawu-manager

A practical guide to managing your BNG nodes with dawu-manager.

---

## Table of Contents

- [First-Time Setup](#first-time-setup)
- [Dashboard Overview](#dashboard-overview)
- [Managing Nodes](#managing-nodes)
- [Node Health Monitoring](#node-health-monitoring)
- [Node Detail View](#node-detail-view)
- [API Proxy](#api-proxy)
- [User Roles](#user-roles)
- [CLI Usage](#cli-usage)

---

## First-Time Setup

### 1. Start dawu-manager

```bash
# Quick start
npx dawu-manager

# Or with Docker
docker compose up -d
```

### 2. Create the admin account

Open http://localhost:3789 in your browser. On first launch, you'll be redirected to the setup page.

Fill in your admin account details:

- **Name** — your display name
- **Email** — used for login
- **Password** — choose a strong password (minimum 4 characters)

> **Note:** The first account is always assigned the `admin` role. You can create additional users with different roles after login.

---

## Dashboard Overview

The dashboard provides an at-a-glance view of your BNG infrastructure:

### Stats Cards

- **Total Nodes** — Number of registered dawos-agent instances
- **Online** — Nodes currently responding to health checks
- **Offline** — Nodes that failed their last health check
- **Degraded** — Nodes with partial functionality

### Node Cards

Each registered node appears as a card showing:
- Node name and location
- Current status (online / offline / degraded / unknown)
- Last seen timestamp
- Quick actions (view detail, health check)

---

## Managing Nodes

### Adding a Node

1. Navigate to **Nodes** > **Add Node** (or click the **+** button)
2. Fill in the form:

| Field    | Required | Description                            | Example                     |
|----------|:--------:|----------------------------------------|-----------------------------|
| Name     | Yes      | Unique human-readable identifier       | `bng-jakarta-01`            |
| URL      | Yes      | dawos-agent base URL (with port)       | `http://192.168.1.100:8470` |
| API Key  | Yes      | API key from the node's `agent.env`    | `sk-abc123...`              |
| Location | No       | Physical location or description       | `Jakarta DC-1, Rack A3`     |

3. Click **Add Node**
4. dawu-manager encrypts the API key and stores it securely

### Finding the API Key

The dawos-agent API key is stored on the BNG node at:

```bash
# SSH into the BNG node
cat /etc/dawos-agent/agent.env | grep API_KEY
```

### Editing a Node

1. Go to the node's detail page
2. Click **Edit**
3. Update the fields (API key can be changed if rotated)
4. Click **Save**

### Deleting a Node

1. Go to the node's detail page
2. Click **Delete**
3. Confirm the deletion in the dialog

> **Note:** Deleting a node removes it from dawu-manager only. The dawos-agent instance on the BNG node is unaffected.

---

## Node Health Monitoring

### Automatic Health Checks

dawu-manager checks node health by calling the dawos-agent `/health` endpoint. The status is updated and stored in the database.

### Status Indicators

| Status      | Badge Color | Meaning                                    |
|-------------|:-----------:|--------------------------------------------|
| **Online**  | Green       | Node is healthy and responding normally    |
| **Offline** | Red         | Node is unreachable or returning errors    |
| **Degraded**| Yellow      | Node is responding but with issues         |
| **Unknown** | Gray        | Node has never been health-checked         |

### Manual Health Check

Click the **Check Health** button on any node card or detail page to trigger an immediate health check.

---

## Node Detail View

The node detail page provides deep access to each BNG node's functionality through the dawos-agent proxy:

### Available Sections

| Section         | Description                                           |
|-----------------|-------------------------------------------------------|
| **Overview**    | Node info, health status, dawos-agent version         |
| **Sessions**    | Active PPPoE sessions — view, search, terminate       |
| **Service**     | accel-ppp service management — start, stop, restart   |
| **Config**      | accel-ppp configuration editor with guard-timer       |
| **Firewall**    | nftables rules, NAT, groups, sysctl, conntrack        |
| **Network**     | Network interfaces, routes, VLAN management           |
| **Traffic**     | Traffic shaping, rate limiting, live charts            |
| **PPPoE**       | PPPoE interfaces, MAC filters, PADO delay             |
| **Routing**     | Dynamic routing (BGP, OSPF, RIP, BFD)                 |
| **IP Pool**     | IP address pool management                            |
| **Monitoring**  | Monitoring exporters and metrics                      |
| **Logs**        | Log viewer and real-time streaming                    |
| **System**      | System information, health, metrics                   |
| **DHCP**        | DHCP server and relay management                      |
| **Diagnostics** | Zones, conntrack entries, limits, event hooks          |
| **Events**      | Event hooks and webhook management                    |

### Proxy Access

All operations in the detail view are proxied through dawu-manager's API routes. The browser never directly contacts the BNG node — all communication is server-to-server with the decrypted API key.

---

## API Proxy

dawu-manager includes a universal proxy for any dawos-agent endpoint:

### How It Works

```
Browser Request:
  GET /api/nodes/{nodeId}/proxy/api/v1/sessions

Proxied To:
  GET http://{node-url}/api/v1/sessions
  Header: X-API-Key: {decrypted-api-key}
```

### Supported Methods

The proxy forwards **all HTTP methods**: GET, POST, PUT, DELETE, PATCH.

### Using the Proxy Programmatically

If you need to access dawos-agent endpoints beyond the built-in UI:

```javascript
// From the browser (authenticated with dawu-manager session)
const response = await fetch('/api/nodes/NODE_ID/proxy/api/v1/sessions');
const sessions = await response.json();
```

### Proxy Security

- **Authentication:** Every proxy request requires a valid dawu-manager JWT session
- **Authorization:** Role-based access control is enforced (operators and admins only for mutations)
- **Isolation:** API keys are decrypted server-side and never exposed to the browser
- **Audit:** All proxy operations are logged to the audit trail

---

## User Roles

dawu-manager implements three user roles:

### Role Permissions Matrix

| Capability               | Viewer | Operator | Admin |
|--------------------------|:------:|:--------:|:-----:|
| View dashboard           | Yes | Yes | Yes |
| View node list           | Yes | Yes | Yes |
| View node detail         | Yes | Yes | Yes |
| Check node health        | Yes | Yes | Yes |
| Add/edit/delete nodes    | No  | Yes | Yes |
| Proxy operations (write) | No  | Yes | Yes |
| Manage users             | No  | No  | Yes |
| View audit log           | No  | No  | Yes |
| Change settings          | No  | No  | Yes |

### Role Descriptions

- **Viewer** — Read-only access. Can view the dashboard, node list, and node details. Cannot make any changes.
- **Operator** — Day-to-day operations. Can add, edit, and delete nodes. Can perform write operations through the proxy (e.g., terminate sessions, apply config).
- **Admin** — Full access. Can manage users, view audit logs, and change system settings. The first user created during setup is always an admin.

---

## CLI Usage

### Basic usage

```bash
npx dawu-manager
```

Starts the server on the default port (3789).

### Custom port

```bash
npx dawu-manager --port 4000
```

### With environment variables

```bash
NEXTAUTH_SECRET="my-secret" \
NEXTAUTH_URL="https://dawu.example.com" \
npx dawu-manager --port 8080
```

### Data location

When using `npx`, the database is stored at:

```
~/.dawu-manager/data.db
```

This persists across restarts and upgrades.

### Docker usage

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Reset (delete all data)
docker compose down -v
```

---

## Tips and Best Practices

### 1. Use meaningful node names

Use a naming convention that includes location and role:
- `bng-jakarta-dc1-01`
- `bng-surabaya-pop-02`
- `bng-dev-lab-01`

### 2. Set up multiple operator accounts

Create individual accounts for each team member instead of sharing the admin account. This provides better audit trail visibility.

### 3. Monitor the audit log

Regularly review the audit log (Admin > Audit Log) to track who made what changes and when.

### 4. Use location tags

Add location information to your nodes for easier identification in the dashboard, especially as you scale to more BNG nodes.

### 5. Keep dawos-agent API keys rotated

Periodically rotate API keys on your BNG nodes and update them in dawu-manager:

1. Generate a new API key on the BNG node
2. Edit the node in dawu-manager with the new key
3. dawu-manager re-encrypts and stores the new key

### 6. Back up your database

For Docker deployments:

```bash
docker cp dawu-manager:/data/dawu.db ./dawu-backup-$(date +%Y%m%d).db
```

For npx deployments:

```bash
cp ~/.dawu-manager/data.db ./dawu-backup-$(date +%Y%m%d).db
```
