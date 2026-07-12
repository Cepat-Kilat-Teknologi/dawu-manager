# Audit Trail

The audit trail records all management actions performed through dawu-manager. Every write operation -- node creation, session termination, configuration change, user modification -- is logged with the acting user, target node, action type, and timestamp.

---

## Viewing the Audit Log

Navigate to **Audit Log** in the sidebar. The audit log page displays a paginated table of all recorded actions, ordered from most recent to oldest.

### Table Columns

| Column | Description |
|--------|-------------|
| Timestamp | Date and time the action was performed (server time) |
| User | Name and email of the user who performed the action |
| Action | The operation that was executed (e.g., `node.create`, `session.terminate`) |
| Node | The target BNG node (if applicable) |
| Detail | Additional context about the action (JSON format) |

---

## Action Types

Audit log entries use a dot-notation naming convention for action types:

### Node Actions

| Action | Description |
|--------|-------------|
| `node.create` | A new BNG node was registered |
| `node.update` | Node details were modified (name, URL, location, API key) |
| `node.delete` | A node was removed from dawu-manager |
| `node.health_check` | A manual health check was triggered |

### Session Actions

| Action | Description |
|--------|-------------|
| `session.terminate` | A single PPPoE session was disconnected |
| `session.bulk_terminate` | Multiple sessions were terminated in a single operation |

### Service Actions

| Action | Description |
|--------|-------------|
| `service.restart` | The accel-ppp service was restarted on a node |
| `service.start` | The accel-ppp service was started on a node |
| `service.stop` | The accel-ppp service was stopped on a node |

### Configuration Actions

| Action | Description |
|--------|-------------|
| `config.apply` | A configuration change was applied to a node |
| `config.backup` | A configuration backup was created |
| `config.restore` | A configuration was restored from a backup |

### User Management Actions

| Action | Description |
|--------|-------------|
| `user.create` | A new user account was created |
| `user.update` | User details or role were modified |
| `user.delete` | A user account was deleted |

### Fleet Actions

| Action | Description |
|--------|-------------|
| `fleet.health_check` | A fleet-wide health check was executed |
| `fleet.restart` | A fleet-wide service restart was executed |
| `fleet.bulk_terminate` | A fleet-wide bulk session termination was executed |

### Firewall Actions

| Action | Description |
|--------|-------------|
| `firewall.save` | Firewall rules were persisted to disk |
| `firewall.validate` | Firewall ruleset was validated |
| `firewall.nat_update` | NAT or masquerade rules were modified |
| `firewall.group_create` | A firewall address/port group was created |
| `firewall.group_delete` | A firewall group was deleted |

---

## Detail Field

The detail column contains JSON-formatted context specific to each action type. Examples:

**Node creation:**
```json
{
  "name": "bng-jakarta-dc1-01",
  "url": "http://192.168.1.100:8470"
}
```

**Session termination:**
```json
{
  "username": "user@isp.com",
  "sessionId": "abc123"
}
```

**Configuration apply:**
```json
{
  "confirm_minutes": 5,
  "backup_created": true
}
```

---

## Filtering and Search

The audit log supports filtering by:

| Filter | Description |
|--------|-------------|
| Date range | Show entries within a specific time period |
| User | Filter by the user who performed the action |
| Action type | Filter by action category (node, session, service, config, user) |
| Node | Filter by the target BNG node |

---

## Data Retention

Audit log entries are stored in the SQLite database and persist indefinitely. There is no automatic purging. For long-running deployments, the database file size grows proportionally to the volume of management actions.

If the audit log becomes excessively large, administrators can:

1. Export the data for archival.
2. Manually prune old entries from the database.
3. Back up and recreate the database (all nodes and users would need to be re-registered).

---

## Security Considerations

- Audit log entries are **append-only** from the application perspective. There is no UI to delete individual entries.
- The audit log records the authenticated user's identity, ensuring non-repudiation for management actions.
- All destructive operations (terminate, restart, delete) generate audit log entries before the action is executed.
- Failed operations are also logged, with the error details captured in the detail field.

---

## Permissions

| Action | Required Role |
|--------|---------------|
| View audit log | Admin |
| Export audit log | Admin |

Only administrators can access the audit log. Operators and viewers do not have access to the audit trail.

---

## CSV Export

The audit log can be exported as a CSV file for offline analysis or compliance reporting. Click the **Export CSV** button at the top of the audit log page. The export includes all entries matching the current filter criteria.

The exported CSV includes the following columns:

```
Timestamp,User,Email,Action,Node,Detail
```

All field values are sanitized to prevent CSV formula injection. Fields that begin with characters commonly used in spreadsheet formulas (`=`, `+`, `-`, `@`, `\t`, `\r`) are prefixed with a single quote to neutralize any formula interpretation by spreadsheet applications.
