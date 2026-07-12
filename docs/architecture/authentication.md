# Authentication and Authorization

dawu-manager uses NextAuth.js v5 with a JWT session strategy and credentials provider. This page describes the authentication flow, session management, role-based access control, and security properties.

---

## Authentication Flow

### Login

```
Browser                          dawu-manager Server
+--------+                      +------------------------+
|        | 1. GET /api/auth/csrf |                        |
| Login  | --------------------> | Return CSRF token      |
| Page   |                      |                        |
|        | 2. POST /api/auth/    |                        |
|        |    callback/          | 3. Lookup user by email|
|        |    credentials        | 4. Verify bcrypt hash  |
|        |    {email, password,  | 5. Generate JWT        |
|        |     csrfToken}        | 6. Set HttpOnly cookie |
|        | --------------------> |                        |
|        |                      |                        |
|        | <-- Set-Cookie ------  |                        |
|        |    (JWT token)        |                        |
|        |                      |                        |
|        | 7. Redirect to /      |                        |
+--------+                      +------------------------+
```

### Step-by-Step

1. The login page requests a CSRF token from `/api/auth/csrf`.
2. The user submits their email and password.
3. The login page sends a POST request to `/api/auth/callback/credentials` with the email, password, and CSRF token.
4. The server looks up the user by email in the database.
5. The server compares the submitted password against the stored bcrypt hash.
6. If the credentials are valid, a JWT is generated containing the user's ID, email, name, and role.
7. The JWT is stored in an HttpOnly cookie and the browser is redirected to the dashboard.

!!! note "Direct fetch instead of signIn()"
    dawu-manager uses direct `fetch()` calls to the NextAuth callback endpoint instead of the `signIn()` function from `next-auth/react`. This works around a known issue in NextAuth v5 beta.31 where `signIn()` with `redirect: false` silently fails for the credentials provider.

### Logout

Logging out clears the JWT cookie. No server-side session state needs to be invalidated because sessions are stateless JWTs.

---

## JWT Structure

The JWT token contains:

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | String | User ID (CUID) |
| `email` | String | User email address |
| `name` | String | User display name |
| `role` | String | User role (`admin`, `operator`, `viewer`) |
| `iat` | Number | Issued-at timestamp |
| `exp` | Number | Expiration timestamp |

The token is signed using HMAC-SHA256 with the `NEXTAUTH_SECRET` environment variable.

---

## Cookie Configuration

| Property | Value |
|----------|-------|
| Name | `authjs.session-token` (HTTP) or `__Secure-authjs.session-token` (HTTPS) |
| HttpOnly | Yes (not accessible via JavaScript) |
| SameSite | Lax |
| Secure | Yes (when using HTTPS) |
| Path | `/` |

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

dawu-manager uses a three-tier role hierarchy:

```
admin (level 2)
  |
  +-- operator (level 1)
        |
        +-- viewer (level 0)
```

Higher roles inherit all permissions of lower roles. An admin can do everything an operator can do, and an operator can do everything a viewer can do.

### Permission Enforcement

Role checks are enforced by the `requireAuth()` function in `src/lib/auth-guard.ts`:

```typescript
// Require at least operator role
const user = await requireAuth("operator");

// Require admin role
const user = await requireAuth("admin");

// Require any authenticated user (viewer+)
const user = await requireAuth();
```

If the check fails, `requireAuth()` throws:

- HTTP 401 if the user is not authenticated.
- HTTP 403 if the user's role is below the required minimum.

### Role Permissions

| Resource | Viewer | Operator | Admin |
|----------|:------:|:--------:|:-----:|
| Dashboard (read) | Yes | Yes | Yes |
| Node list (read) | Yes | Yes | Yes |
| Node detail (read) | Yes | Yes | Yes |
| Health checks | Yes | Yes | Yes |
| Alert rules (read) | Yes | Yes | Yes |
| Node CRUD (write) | -- | Yes | Yes |
| Session management | -- | Yes | Yes |
| Service control | -- | Yes | Yes |
| Configuration changes | -- | Yes | Yes |
| Firewall management | -- | Yes | Yes |
| Fleet operations | -- | Yes | Yes |
| Alert rules (write) | -- | Yes | Yes |
| Audit log | -- | -- | Yes |
| User management | -- | -- | Yes |
| System settings | -- | -- | Yes |

---

## First-Run Setup

When the database has no users, dawu-manager enters setup mode:

1. All requests redirect to `/setup`.
2. The setup page presents a form to create the first admin account.
3. After submission, the user is created with the `admin` role.
4. The setup endpoint is permanently disabled (returns HTTP 400 if users already exist).

There are no default credentials. The administrator chooses their own email and password during setup.

---

## Password Security

| Property | Value |
|----------|-------|
| Hashing algorithm | bcrypt |
| Cost factor | 12 rounds |
| Minimum length | 4 characters |
| Storage | Only the hash is stored |

The bcrypt cost factor of 12 provides approximately 250ms of computation per hash on modern hardware, making brute-force attacks impractical.

---

## Server-Side Auth Guard

Every protected page and API route uses the auth guard:

### API Routes

```typescript
export async function GET(request: Request) {
  const user = await requireAuth();
  // user is authenticated, proceed...
}

export async function POST(request: Request) {
  const user = await requireAuth("operator");
  // user is authenticated and has operator+ role, proceed...
}
```

### Server Components (Pages)

```typescript
export default async function DashboardPage() {
  const user = await requireAuth();
  // render page for authenticated user...
}
```

### Client Components

Client components access the session via the `useSession()` hook from NextAuth:

```typescript
const { data: session } = useSession();
const userRole = session?.user?.role;
```

Client-side role checks are for UI rendering only (hiding buttons, disabling inputs). All security enforcement happens server-side.

---

## Security Properties

| Property | Implementation |
|----------|----------------|
| Credential storage | bcrypt hashed passwords (cost 12) |
| Session tokens | Signed JWTs (HMAC-SHA256) |
| Token storage | HttpOnly cookies (not accessible via JS) |
| CSRF protection | Built-in NextAuth CSRF token validation |
| Brute-force protection | bcrypt computational cost; Nginx rate limiting (optional) |
| Session invalidation | Change NEXTAUTH_SECRET to invalidate all sessions |
| Role enforcement | Server-side check on every API route and page |
| No default credentials | Administrator creates credentials during setup |
