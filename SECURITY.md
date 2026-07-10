# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

Only the latest minor release receives security updates. We recommend always running the most recent version.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities by emailing:

**security@cepat-kilat.com**

Include the following in your report:

1. **Description** of the vulnerability
2. **Steps to reproduce** (or a proof of concept)
3. **Impact assessment** (what an attacker could achieve)
4. **Suggested fix** (optional, but appreciated)

### Response Timeline

| Stage          | Target       |
|----------------|--------------|
| Acknowledgment | 48 hours     |
| Initial triage | 5 business days |
| Fix release    | 30 days (critical), 90 days (other) |

We will credit reporters in the release notes (unless you prefer to remain anonymous).

---

## Security Architecture

### Authentication

- **NextAuth.js v5** with credentials provider
- **JWT session strategy** — tokens signed with `NEXTAUTH_SECRET`
- **bcrypt** password hashing (via bcryptjs)
- **24-hour session expiry** — tokens auto-expire after 24 hours
- **First-run setup** — admin account created only when no users exist; `/setup` endpoint is disabled after first user creation

### API Key Encryption

dawos-agent API keys are encrypted at rest in the SQLite database:

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** scrypt with 32-byte random salt
- **IV:** 16-byte random initialization vector per encryption
- **Authentication tag:** 16-byte GCM tag prevents tampering
- **Key source:** Derived from `NEXTAUTH_SECRET` environment variable

API keys are **only decrypted server-side** when proxying requests to dawos-agent instances. They are never sent to the browser.

### Role-Based Access Control (RBAC)

Three roles with escalating permissions:

| Role       | Read | Write | Admin |
|------------|:----:|:-----:|:-----:|
| `viewer`   | :white_check_mark: | :x: | :x: |
| `operator` | :white_check_mark: | :white_check_mark: | :x: |
| `admin`    | :white_check_mark: | :white_check_mark: | :white_check_mark: |

- Role enforcement is applied at the API route level
- Navigation items are filtered by role in the sidebar
- Mutation endpoints (POST, PUT, DELETE) require `operator` or `admin` role

### Proxy Isolation

The proxy architecture provides a critical security boundary:

```
Browser  ──(JWT)──>  Next.js API  ──(API Key)──>  dawos-agent
                     Routes
                     (decrypt key
                      server-side)
```

- BNG node API keys **never leave the server**
- The browser only holds a JWT token for dawu-manager authentication
- All dawos-agent communication is server-to-server

### Audit Logging

All node operations are logged to the `AuditLog` table:

- User identity (who performed the action)
- Node identity (which BNG node was affected)
- Action type (e.g., `node.create`, `session.terminate`, `config.apply`)
- Timestamp and detail context

---

## Deployment Best Practices

### 1. Set a strong `NEXTAUTH_SECRET`

```bash
# Generate a cryptographically secure secret
openssl rand -base64 32
```

Set this as the `NEXTAUTH_SECRET` environment variable. This secret is used for:
- JWT token signing
- API key encryption key derivation

**Never use the auto-generated development secret in production.**

### 2. Change default credentials

After first-time setup, immediately change the default admin password:
- Default email: `admin@dawu.local`
- Default password: `dawu`

### 3. Use HTTPS in production

Set `NEXTAUTH_URL` to your HTTPS URL:

```bash
NEXTAUTH_URL=https://dawu.example.com
```

Use a reverse proxy (nginx, Caddy, Traefik) to terminate TLS.

### 4. Restrict network access

dawu-manager should be accessible only from trusted networks:

```bash
# Example: bind to internal network only
PORT=3000
# Use firewall rules to restrict access
```

### 5. Secure the database file

The SQLite database contains encrypted API keys and password hashes:

```bash
# Docker: data is in a named volume
docker volume inspect dawu-data

# npx: data is at ~/.dawu-manager/data.db
chmod 600 ~/.dawu-manager/data.db
```

### 6. Keep dependencies updated

```bash
pnpm update
pnpm audit
```

### 7. Docker-specific hardening

The production Docker image:
- Runs as non-root user (`nextjs:nodejs`, UID 1001)
- Uses multi-stage build (no dev dependencies in production)
- Based on `node:20-alpine` (minimal attack surface)
- Disables Next.js telemetry (`NEXT_TELEMETRY_DISABLED=1`)

---

## Known Limitations

1. **Single-factor authentication** — Only username/password is supported. MFA (TOTP/WebAuthn) is planned for a future release.
2. **No rate limiting** — API endpoints do not enforce rate limits. Use a reverse proxy (nginx, Traefik) for rate limiting in production.
3. **SQLite single-writer** — SQLite allows only one writer at a time. This is adequate for the management dashboard use case but not for high-concurrency scenarios.
