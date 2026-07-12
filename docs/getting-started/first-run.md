# First-Run Setup

When dawu-manager starts with an empty database, it redirects all requests to the setup page at `/setup`. This page is available only once -- after the first user is created, the setup endpoint is permanently disabled.

---

## Step 1: Open the Setup Page

Start dawu-manager using any installation method:

```bash
npx dawu-manager
```

Open [http://localhost:3789](http://localhost:3789) in your browser. You will be automatically redirected to `/setup`.

---

## Step 2: Create the Admin Account

The setup form requires three fields:

| Field | Description | Constraints |
|-------|-------------|-------------|
| Name | Display name shown in the dashboard header and audit log | Required, non-empty |
| Email | Used as the login identifier | Required, valid email format, must be unique |
| Password | Account password | Required, minimum 4 characters |

!!! note "No default credentials"
    There are no hardcoded default usernames or passwords. You choose your own credentials during setup.

!!! tip "First account role"
    The first account created is always assigned the **admin** role. This grants full access to all dashboard features, including user management, audit log, and system settings.

After filling in the form, click the submit button. The system creates the user account, hashes the password with bcrypt (cost factor 12), and redirects to the login page.

---

## Step 3: Log In

Enter the email and password you created in the previous step. After successful authentication, you are redirected to the main dashboard.

---

## Step 4: Add Your First BNG Node

Navigate to **Nodes** in the sidebar, then click **Add Node**.

Fill in the node registration form:

| Field | Required | Description | Example |
|-------|:--------:|-------------|---------|
| Name | Yes | A unique, human-readable identifier for this BNG node | `bng-jakarta-dc1-01` |
| URL | Yes | The dawos-agent base URL including port | `http://192.168.1.100:8470` |
| API Key | Yes | The API key configured in dawos-agent | (from `/etc/dawos-agent/agent.env`) |
| Location | No | Physical location or descriptive label | `Jakarta DC-1, Rack A3` |

### Finding the API Key

The dawos-agent API key is stored on each BNG node. To retrieve it:

```bash
ssh user@<bng-node-ip>
grep API_KEY /etc/dawos-agent/agent.env
```

The output will contain a line like:

```
DAWOS_API_KEY=TFYaNsVgkUooIHNX35wnvQrpM2rp4IzHBGel9JTH5JU
```

Copy the value after the `=` sign and paste it into the API Key field in dawu-manager.

!!! note "API key security"
    The API key is encrypted using AES-256-GCM before being stored in the database. It is decrypted only on the server side when proxying requests to the dawos-agent instance. The key is never sent to the browser.

### Node Naming Conventions

Use a consistent naming scheme that includes location and role information:

```
bng-<city>-<datacenter>-<number>
```

Examples:

- `bng-jakarta-dc1-01`
- `bng-surabaya-pop-02`
- `bng-bandung-colo-01`
- `bng-dev-lab-01`

---

## Step 5: Verify Connectivity

After adding a node, click the **Check Health** button on the node card. If the dawos-agent instance is reachable and the API key is correct, the status indicator changes to **Online** (green).

If the health check fails, verify the following:

1. The dawos-agent service is running on the BNG node:
   ```bash
   sudo systemctl status dawos-agent
   ```

2. The health endpoint responds locally on the BNG node:
   ```bash
   curl -sf http://localhost:8470/health
   ```

3. Network connectivity exists between the dawu-manager host and the BNG node on port 8470. Check firewall rules on both sides.

4. The API key in dawu-manager matches the key configured in `/etc/dawos-agent/agent.env`.

---

## Next Steps

After completing the initial setup:

- **Add more nodes** -- Register all your BNG nodes to get a fleet-wide view.
- **Create operator accounts** -- Set up individual accounts for team members with appropriate roles. See [User Management](../user-guide/user-management.md).
- **Explore node features** -- Click on a node to access its detail pages for sessions, configuration, firewall, and more. See [Node Feature Pages](../user-guide/node-features.md).
- **Set up alerts** -- Configure threshold-based alert rules to get notified when nodes go offline. See [Alerts](../user-guide/alerts.md).
