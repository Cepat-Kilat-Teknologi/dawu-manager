# Node Management

Nodes represent individual dawos-agent instances running on BNG (Broadband Network Gateway) servers. dawu-manager supports registering, editing, and removing nodes from its management plane.

---

## Adding a Node

Navigate to **Nodes** in the sidebar, then click **Add Node**.

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Name | Text | Unique human-readable identifier | `bng-jakarta-dc1-01` |
| URL | URL | dawos-agent base URL with port | `http://192.168.1.100:8470` |
| API Key | Text | Authentication key from dawos-agent | Value from `agent.env` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Location | Text | Physical location or description | `Jakarta DC-1, Rack A3` |

### Process

1. Fill in all required fields.
2. Click **Add Node**.
3. dawu-manager encrypts the API key using AES-256-GCM before storing it in the database.
4. The node appears in the node list with an initial status of **Unknown**.
5. Run a manual health check to verify connectivity and update the status.

### Finding the API Key

The dawos-agent API key is configured on each BNG node in the environment file:

```bash
ssh user@<bng-node-ip>
grep API_KEY /etc/dawos-agent/agent.env
```

Output:

```
DAWOS_API_KEY=TFYaNsVgkUooIHNX35wnvQrpM2rp4IzHBGel9JTH5JU
```

Copy the value after `=` and paste it into the API Key field.

### URL Format

The URL must include the protocol and port:

```
http://<ip-address>:8470
```

Do not include a trailing slash or path. dawu-manager appends API paths automatically when proxying requests.

!!! warning "HTTPS between dawu-manager and BNG nodes"
    By default, dawos-agent listens on HTTP port 8470. If your network requires encrypted transport between dawu-manager and the BNG nodes, configure dawos-agent with TLS and use `https://` in the URL.

---

## Editing a Node

1. Navigate to the node's detail page by clicking its name in the node list.
2. Click **Edit**.
3. Modify the desired fields. The API key field can be updated if the key has been rotated on the BNG node.
4. Click **Save**.

If the API key is changed, dawu-manager re-encrypts the new value before storing it.

---

## Deleting a Node

1. Navigate to the node's detail page.
2. Click **Delete**.
3. Confirm the deletion in the confirmation dialog.

!!! note "BNG node is unaffected"
    Deleting a node from dawu-manager only removes it from the management dashboard. The dawos-agent instance on the BNG node continues running normally. No commands are sent to the BNG node during deletion.

---

## Node List

The **Nodes** page displays all registered nodes in a table view with the following columns:

| Column | Description |
|--------|-------------|
| Name | Node identifier (clickable link to detail page) |
| URL | dawos-agent base URL |
| Location | Physical location (if set) |
| Status | Current health status badge |
| Last Seen | Timestamp of the last successful health check |

---

## Node Naming Conventions

Consistent naming improves operational clarity, especially as the number of managed nodes grows.

Recommended format:

```
bng-<city>-<facility>-<number>
```

Examples:

| Name | Location |
|------|----------|
| `bng-jakarta-dc1-01` | Jakarta, Data Center 1, Node 1 |
| `bng-surabaya-pop-02` | Surabaya, POP, Node 2 |
| `bng-bandung-colo-01` | Bandung, Colocation, Node 1 |
| `bng-dev-lab-01` | Development lab node |

---

## API Key Security

dawu-manager encrypts all stored API keys using the following scheme:

| Component | Value |
|-----------|-------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key derivation | scrypt with 32-byte random salt |
| IV | 12-byte random initialization vector per encryption |
| Auth tag | 16-byte GCM authentication tag |
| Key source | Derived from `ENCRYPTION_KEY` or `NEXTAUTH_SECRET` |

API keys are decrypted only on the server side when proxying requests to dawos-agent instances. The decrypted key is injected as the `X-API-Key` HTTP header. At no point does the decrypted key leave the server or reach the browser.

---

## Permissions

| Action | Required Role |
|--------|---------------|
| View node list | Viewer, Operator, Admin |
| View node detail | Viewer, Operator, Admin |
| Add node | Operator, Admin |
| Edit node | Operator, Admin |
| Delete node | Operator, Admin |
