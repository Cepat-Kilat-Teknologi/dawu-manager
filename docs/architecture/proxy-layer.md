# Proxy Layer

The proxy layer is the central architectural pattern in dawu-manager. It sits between the operator's browser and the dawos-agent instances running on BNG nodes, providing authentication, authorization, credential injection, and audit logging for every request.

---

## Purpose

The proxy layer exists to solve three problems:

1. **Credential isolation** -- BNG node API keys must never be exposed to the browser.
2. **Centralized access control** -- A single authentication and authorization point for all node operations.
3. **Audit trail** -- Every mutation is logged with the user's identity.

Without the proxy, each operator would need direct network access to every BNG node and would need to manage API keys individually.

---

## Architecture

```
Browser                    dawu-manager                    BNG Node
+--------+                 +-------------------+           +-----------+
|        | POST            | API Route         | POST      | dawos-    |
| React  | /api/nodes/     | (proxy handler)   | /api/v1/  | agent     |
| App    | {nodeId}/proxy/  |                   | sessions  | :8470     |
|        | api/v1/sessions  | 1. Validate JWT   |           |           |
|        | ----------------->  2. Check role     |           |           |
|        |                 |  3. Load node      |           |           |
|        |                 |  4. Decrypt key    |           |           |
|        |                 |  5. Forward -------->          |           |
|        |                 |  6. Audit log      |           |           |
|        | <-----------------  7. Return <--------          |           |
+--------+                 +-------------------+           +-----------+
```

---

## Proxy Route

The universal proxy route is defined at:

```
src/app/api/nodes/[nodeId]/proxy/[...path]/route.ts
```

This single route handler handles all HTTP methods (GET, POST, PUT, PATCH, DELETE) and forwards them to the corresponding dawos-agent endpoint.

### URL Mapping

The proxy maps dawu-manager URLs to dawos-agent URLs:

| dawu-manager Request | dawos-agent Request |
|---------------------|---------------------|
| `GET /api/nodes/{id}/proxy/api/v1/sessions` | `GET http://{node-url}/api/v1/sessions` |
| `POST /api/nodes/{id}/proxy/api/v1/sessions/terminate` | `POST http://{node-url}/api/v1/sessions/terminate` |
| `GET /api/nodes/{id}/proxy/health` | `GET http://{node-url}/health` |

The `[...path]` catch-all parameter captures everything after `/proxy/` and appends it to the node's base URL.

### Request Processing Steps

1. **Parse the route parameters**: Extract `nodeId` and the target `path` from the URL.

2. **Authenticate the user**: Validate the JWT session cookie. Return HTTP 401 if the cookie is missing, expired, or invalid.

3. **Authorize the user**: For mutation operations (POST, PUT, PATCH, DELETE), verify the user has at least the `operator` role. Return HTTP 403 if the role is insufficient. GET requests are allowed for all authenticated users.

4. **Load the node record**: Query the database for the node with the given ID. Return HTTP 404 if the node does not exist.

5. **Decrypt the API key**: Use the AES-256-GCM decryption function to recover the plaintext API key from the encrypted value stored in the database.

6. **Forward the request**: Construct the target URL by combining the node's base URL with the captured path. Forward the request with:
   - The original HTTP method.
   - The original request body (if present).
   - The `X-API-Key` header set to the decrypted API key.
   - The `Content-Type` header from the original request.

7. **Return the response**: Pass the dawos-agent response back to the browser with the same status code and body.

8. **Create an audit log entry** (mutations only): For POST, PUT, PATCH, and DELETE requests, write an audit log entry recording the user, node, action, and request details.

---

## HTTP Client

The proxy uses the `dawosRequest` function defined in `src/lib/dawos-client.ts`. This function:

- Constructs the full URL from the node's base URL and the target path.
- Sets the `X-API-Key` header with the decrypted API key.
- Forwards the request body and content type.
- Handles timeouts (15 seconds per request).
- Returns the response status code and body.

```typescript
// Simplified signature
async function dawosRequest(
  node: { url: string; apiKey: string },
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response>
```

---

## Dedicated Routes

Some operations have dedicated API routes instead of using the universal proxy. These routes add application-specific logic beyond simple forwarding:

| Route | Purpose | Additional Logic |
|-------|---------|-----------------|
| `/api/nodes/[nodeId]/health` | Health check | Updates `status` and `lastSeen` in the database |
| `/api/fleet/operations` | Fleet operations | Fans out to multiple nodes concurrently |
| `/api/nodes` | Node CRUD | Encrypts API keys, manages node records |

---

## Error Handling

The proxy handles errors at multiple levels:

### Network Errors

If the dawos-agent instance is unreachable (connection refused, DNS failure, timeout), the proxy returns:

```json
{
  "error": "Failed to connect to node",
  "detail": "Connection refused"
}
```

HTTP status: 502 (Bad Gateway).

### Authentication Errors

If the dawos-agent returns HTTP 401 (invalid API key), the proxy returns the error to the browser. This indicates that the stored API key no longer matches the key configured on the BNG node.

### Timeout Errors

Each proxy request has a 15-second timeout. If the dawos-agent does not respond within this window, the proxy returns:

```json
{
  "error": "Request timeout",
  "detail": "Node did not respond within 15 seconds"
}
```

HTTP status: 504 (Gateway Timeout).

---

## Query String Forwarding

Query parameters from the original request are forwarded to the dawos-agent. For example:

```
GET /api/nodes/{id}/proxy/api/v1/sessions?username=user@isp.com
```

Becomes:

```
GET http://{node-url}/api/v1/sessions?username=user@isp.com
```

---

## Streaming Support

For endpoints that return Server-Sent Events (SSE), such as log streaming, the proxy forwards the response as a stream. The `Content-Type: text/event-stream` header is preserved, and the response body is piped directly from the dawos-agent to the browser without buffering.

When using Nginx as a reverse proxy in front of dawu-manager, ensure that buffering is disabled for API routes. See [Nginx Reverse Proxy](../deployment/nginx.md) for configuration details.

---

## Security Properties

| Property | Implementation |
|----------|----------------|
| Credential isolation | API keys are decrypted server-side only; never sent to the browser |
| Authentication | JWT validation on every proxy request |
| Authorization | Role check for mutation operations |
| Audit trail | Mutation operations are logged with user identity |
| Transport security | HTTPS between browser and dawu-manager (when configured) |
| Request integrity | Request body is forwarded without modification |
