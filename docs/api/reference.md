# API Reference

dawu-manager exposes a set of internal API routes that serve the dashboard frontend. These routes handle authentication, node management, fleet operations, and proxying requests to dawos-agent instances.

All API routes are prefixed with `/api/` and return JSON responses.

---

## Authentication

### CSRF Token

```
GET /api/auth/csrf
```

Returns a CSRF token required for the login request.

**Response:**

```json
{
  "csrfToken": "abc123..."
}
```

### Login

```
POST /api/auth/callback/credentials
```

Authenticates a user with email and password.

**Headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |
| `X-Auth-Return-Redirect` | `1` |

**Body (form-encoded):**

| Field | Type | Description |
|-------|------|-------------|
| `email` | String | User email address |
| `password` | String | User password |
| `csrfToken` | String | Token from `/api/auth/csrf` |

**Response:**

```json
{
  "url": "http://localhost:3789/"
}
```

On failure, the URL contains an error query parameter.

### Session

```
GET /api/auth/session
```

Returns the current user session.

**Response (authenticated):**

```json
{
  "user": {
    "id": "clx...",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "expires": "2026-08-06T00:00:00.000Z"
}
```

### Logout

```
POST /api/auth/signout
```

Clears the session cookie.

---

## Setup

### Create Initial Admin

```
POST /api/setup
```

Creates the first user account. Only works when no users exist in the database.

**Request body:**

```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Response (201):**

```json
{
  "id": "clx...",
  "name": "Admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

**Error (400):** Returns an error if users already exist.

---

## Nodes

### List Nodes

```
GET /api/nodes
```

Returns all registered nodes. Requires authentication (any role).

**Response:**

```json
[
  {
    "id": "clx...",
    "name": "bng-jakarta-dc1-01",
    "url": "http://192.168.1.100:8470",
    "location": "Jakarta DC-1",
    "status": "online",
    "lastSeen": "2026-07-06T10:30:00.000Z",
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-06T10:30:00.000Z"
  }
]
```

The `apiKey` field is never included in list or detail responses.

### Create Node

```
POST /api/nodes
```

Registers a new dawos-agent node. Requires `operator` role or higher.

**Request body:**

```json
{
  "name": "bng-jakarta-dc1-01",
  "url": "http://192.168.1.100:8470",
  "apiKey": "your-api-key",
  "location": "Jakarta DC-1"
}
```

| Field | Required | Description |
|-------|:--------:|-------------|
| `name` | Yes | Unique node identifier |
| `url` | Yes | dawos-agent base URL with port |
| `apiKey` | Yes | dawos-agent API key (encrypted before storage) |
| `location` | No | Physical location description |

**Response (201):** The created node object (without `apiKey`).

### Get Node

```
GET /api/nodes/[nodeId]
```

Returns a single node by ID. Requires authentication.

**Response:** Node object (without `apiKey`).

### Update Node

```
PUT /api/nodes/[nodeId]
```

Updates a node's details. Requires `operator` role or higher.

**Request body:** Same fields as create. All fields are optional; only provided fields are updated. If `apiKey` is provided, it is re-encrypted.

**Response:** Updated node object (without `apiKey`).

### Delete Node

```
DELETE /api/nodes/[nodeId]
```

Removes a node from the registry. Requires `operator` role or higher.

**Response (200):**

```json
{
  "message": "Node deleted"
}
```

---

## Health Check

### Check Node Health

```
GET /api/nodes/[nodeId]/health
```

Triggers a health check on the specified node. Queries the dawos-agent `/health` endpoint and updates the node's `status` and `lastSeen` fields.

Requires authentication (any role).

**Response (node online):**

```json
{
  "status": "online",
  "data": {
    "status": "ok",
    "version": "0.3.3"
  }
}
```

**Response (node offline):**

```json
{
  "status": "offline",
  "error": "Connection refused"
}
```

---

## Proxy

### Universal Proxy

```
ANY /api/nodes/[nodeId]/proxy/[...path]
```

Forwards any HTTP request to the corresponding dawos-agent endpoint. Supports GET, POST, PUT, PATCH, and DELETE methods.

- GET requests require authentication (any role).
- Mutation requests (POST, PUT, PATCH, DELETE) require `operator` role or higher.
- Mutation requests create an audit log entry.

**URL mapping:**

```
/api/nodes/{id}/proxy/api/v1/sessions
  -> GET http://{node-url}/api/v1/sessions

/api/nodes/{id}/proxy/api/v1/sessions/terminate
  -> POST http://{node-url}/api/v1/sessions/terminate
```

**Response:** The response body and status code from the dawos-agent, passed through without modification.

---

## Fleet Operations

### Execute Fleet Operation

```
POST /api/fleet/operations
```

Executes an operation across multiple nodes concurrently. Requires `operator` role or higher.

**Request body:**

```json
{
  "operation": "health-check",
  "nodeIds": ["clx...", "clx...", "clx..."],
  "params": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `operation` | String | Operation type: `health-check`, `restart`, `bulk-terminate`, `bulk-ratelimit` |
| `nodeIds` | String[] | Array of node IDs to target |
| `params` | Object | Operation-specific parameters (see below) |

**Operation parameters:**

| Operation | Parameters |
|-----------|-----------|
| `health-check` | None |
| `restart` | None |
| `bulk-terminate` | `{ "usernames": ["user1", "user2"] }` |
| `bulk-ratelimit` | `{ "items": [{"username": "user1", "rate": "5M/2M"}] }` |

**Response:**

```json
{
  "results": [
    {
      "nodeId": "clx...",
      "nodeName": "bng-jakarta-dc1-01",
      "success": true,
      "data": { ... },
      "duration": 245
    },
    {
      "nodeId": "clx...",
      "nodeName": "bng-surabaya-pop-01",
      "success": false,
      "error": "Connection refused",
      "duration": 5012
    }
  ]
}
```

---

## Users

### List Users

```
GET /api/users
```

Returns all user accounts. Requires `admin` role.

### Create User

```
POST /api/users
```

Creates a new user account. Requires `admin` role.

**Request body:**

```json
{
  "name": "Operator One",
  "email": "operator@example.com",
  "password": "password123",
  "role": "operator"
}
```

### Update User

```
PUT /api/users/[userId]
```

Updates a user's details. Requires `admin` role. Password field is optional; omit to keep the current password.

### Delete User

```
DELETE /api/users/[userId]
```

Deletes a user account. Requires `admin` role. Cannot delete your own account.

---

## Audit Log

### List Audit Entries

```
GET /api/audit
```

Returns paginated audit log entries. Requires `admin` role.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Entries per page (default: 50) |
| `userId` | String | Filter by user ID |
| `nodeId` | String | Filter by node ID |
| `action` | String | Filter by action type |

### Export Audit Log

```
GET /api/audit/export
```

Returns the audit log as a CSV file. Requires `admin` role. Supports the same query parameters as the list endpoint.

---

## Alerts

### List Alert Rules

```
GET /api/alerts/rules
```

Returns all configured alert rules. Requires authentication.

### Create Alert Rule

```
POST /api/alerts/rules
```

Creates a new alert rule. Requires `operator` role or higher.

### Update Alert Rule

```
PUT /api/alerts/rules/[ruleId]
```

Updates an alert rule. Requires `operator` role or higher.

### Delete Alert Rule

```
DELETE /api/alerts/rules/[ruleId]
```

Deletes an alert rule. Requires `operator` role or higher.

### List Alert Events

```
GET /api/alerts/events
```

Returns alert event history. Requires authentication.

---

## Error Responses

All API routes return errors in a consistent format:

```json
{
  "error": "Error description",
  "detail": "Additional context (optional)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error, missing fields) |
| 401 | Not authenticated |
| 403 | Insufficient permissions (role too low) |
| 404 | Resource not found |
| 500 | Internal server error |
| 502 | Bad gateway (dawos-agent unreachable) |
| 504 | Gateway timeout (dawos-agent did not respond) |
