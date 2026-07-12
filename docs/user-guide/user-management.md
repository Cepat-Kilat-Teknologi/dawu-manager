# User Management

dawu-manager supports multiple user accounts with role-based access control (RBAC). Administrators can create, edit, and delete user accounts, and assign one of three roles to each user.

---

## Roles

| Role | Description | Typical Use |
|------|-------------|-------------|
| Admin | Full access to all features including user management, audit log, and system settings | NOC manager, system administrator |
| Operator | Can view and modify node configurations, terminate sessions, execute fleet operations | Network engineer, NOC operator |
| Viewer | Read-only access to dashboards, node status, and metrics | Helpdesk staff, monitoring personnel |

---

## Permission Matrix

| Feature | Viewer | Operator | Admin |
|---------|:------:|:--------:|:-----:|
| View dashboard | Yes | Yes | Yes |
| View node list | Yes | Yes | Yes |
| View node detail pages | Yes | Yes | Yes |
| View health status | Yes | Yes | Yes |
| Trigger health check | Yes | Yes | Yes |
| Add/edit/delete nodes | No | Yes | Yes |
| Terminate sessions | No | Yes | Yes |
| Restart services | No | Yes | Yes |
| Modify configuration | No | Yes | Yes |
| Manage firewall rules | No | Yes | Yes |
| Execute fleet operations | No | Yes | Yes |
| Manage IP pools | No | Yes | Yes |
| Manage PPPoE settings | No | Yes | Yes |
| Manage event hooks | No | Yes | Yes |
| View alert rules/events | Yes | Yes | Yes |
| Create/edit/delete alert rules | No | Yes | Yes |
| View audit log | No | No | Yes |
| Export audit log | No | No | Yes |
| Manage users | No | No | Yes |
| Change system settings | No | No | Yes |

---

## Managing Users

### Accessing User Management

Navigate to **Users** in the sidebar. This page is only visible to administrators.

### Creating a User

Click **Add User** and fill in the required fields:

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| Name | Text | Display name | Required, non-empty |
| Email | Email | Login identifier | Required, valid email, must be unique |
| Password | Password | Account password | Required, minimum 4 characters |
| Role | Select | Access level | Required, one of: admin, operator, viewer |

After submission, the password is hashed using bcrypt with a cost factor of 12 before storage. The plaintext password is never stored.

### Editing a User

Click **Edit** on any user row to modify their details:

- **Name** can be changed at any time.
- **Email** can be changed, but must remain unique across all users.
- **Role** can be changed. Role changes take effect on the user's next request (existing sessions are not invalidated).
- **Password** can be reset by entering a new password. Leave the password field empty to keep the current password.

### Deleting a User

Click **Delete** on a user row and confirm the deletion.

!!! warning "Self-deletion"
    Administrators cannot delete their own account. This prevents accidental lockout where no admin users remain in the system.

!!! note "Active sessions"
    Deleting a user invalidates their active sessions. The user is logged out on their next request.

---

## User List

The users page displays all accounts in a table:

| Column | Description |
|--------|-------------|
| Name | Display name |
| Email | Login email address |
| Role | Current role (admin, operator, viewer) |
| Created | Account creation timestamp |
| Actions | Edit and delete buttons |

---

## First User (Setup)

The first user account is created during the initial setup flow at `/setup`. This account is automatically assigned the **admin** role. There are no default credentials -- the administrator chooses their own email and password.

After the first user is created, the setup endpoint is permanently disabled. All subsequent user accounts must be created through the user management page by an administrator.

---

## Password Security

| Component | Implementation |
|-----------|----------------|
| Hashing algorithm | bcrypt |
| Cost factor | 12 rounds |
| Storage | Only the hash is stored; plaintext is never persisted |
| Minimum length | 4 characters |
| Transmission | Passwords are sent over HTTPS (or HTTP in development) and never logged |

---

## Session Management

User sessions are managed by NextAuth.js v5:

| Property | Value |
|----------|-------|
| Session strategy | JWT |
| Token contents | User ID, email, name, role |
| Token signing | HMAC-SHA256 using `NEXTAUTH_SECRET` |
| Cookie name | `authjs.session-token` (or `__Secure-authjs.session-token` with HTTPS) |
| Cookie flags | HttpOnly, SameSite=Lax, Secure (when using HTTPS) |

### Session Lifecycle

1. User submits email and password on the login page.
2. Server verifies the password against the stored bcrypt hash.
3. On success, a JWT is created containing the user's ID, email, name, and role.
4. The JWT is stored in an HttpOnly cookie.
5. Subsequent requests include the cookie automatically.
6. Server-side API routes and page components validate the JWT on each request.
7. On logout, the cookie is cleared.

---

## Role Enforcement

Role checks are enforced at two levels:

### Server-Side (API Routes)

Every API route that requires authentication calls `requireAuth()` which:

1. Validates the JWT from the request cookie.
2. Extracts the user's role from the token.
3. Compares the role against the required minimum role for the endpoint.
4. Returns HTTP 401 (unauthenticated) or HTTP 403 (insufficient role) if the check fails.

### Client-Side (UI)

Navigation items and action buttons are conditionally rendered based on the user's role. For example:

- The "Users" sidebar item only appears for admin users.
- "Delete" and "Terminate" buttons only appear for operator and admin users.
- The audit log page only appears for admin users.

Client-side checks are for UI convenience only. All security enforcement happens server-side.
