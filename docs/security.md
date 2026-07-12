# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | Yes |

Only the latest minor release receives security updates. We recommend always running the most recent version.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by email to:

**security@cepat-kilat.com**

Include the following in your report:

1. **Description** of the vulnerability.
2. **Steps to reproduce** (or a proof of concept).
3. **Impact assessment** (what an attacker could achieve).
4. **Suggested fix** (optional, but appreciated).

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | 48 hours |
| Initial triage | 5 business days |
| Fix release | 30 days (critical), 90 days (other) |

We will credit reporters in the release notes unless you prefer to remain anonymous.

---

## Security Architecture

### Authentication

- **NextAuth.js v5** with credentials provider.
- **JWT session strategy** -- Tokens signed with HMAC-SHA256 using `NEXTAUTH_SECRET`.
- **bcrypt** password hashing with cost factor 12.
- **24-hour session expiry** -- Tokens auto-expire after 24 hours.
- **First-run setup** -- Admin account created only when no users exist. The `/setup` endpoint is permanently disabled after first user creation.
- **No default credentials** -- The administrator chooses their own email and password during setup.

### API Key Encryption

dawos-agent API keys are encrypted at rest in the SQLite database:

| Component | Value |
|-----------|-------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key derivation | scrypt with 32-byte random salt |
| IV | 12-byte random initialization vector per encryption |
| Authentication tag | 16-byte GCM tag prevents tampering |
| Key source | Derived from `ENCRYPTION_KEY` (preferred) or `NEXTAUTH_SECRET` |

API keys are decrypted only on the server side when proxying requests to dawos-agent instances. They are never sent to the browser.

### Role-Based Access Control (RBAC)

Three roles with escalating permissions:

| Role | Read | Write | Admin |
|------|:----:|:-----:|:-----:|
| Viewer | Yes | No | No |
| Operator | Yes | Yes | No |
| Admin | Yes | Yes | Yes |

- Role enforcement is applied at the API route level using `requireAuth()`.
- Navigation items are filtered by role in the sidebar.
- Mutation endpoints (POST, PUT, DELETE) require operator or admin role.

### Proxy Isolation

The proxy architecture provides a critical security boundary:

```
Browser  --(JWT)-->  Next.js API Routes  --(API Key)-->  dawos-agent
                     (decrypt key server-side)
```

- BNG node API keys never leave the server.
- The browser holds only a JWT token for dawu-manager authentication.
- All dawos-agent communication is server-to-server.

### Audit Logging

All node operations are logged to the AuditLog table:

- User identity (who performed the action).
- Node identity (which BNG node was affected).
- Action type (e.g., `node.create`, `session.terminate`, `config.apply`).
- Timestamp and detail context (JSON).

### CSV Export Security

Audit log CSV exports include formula injection neutralization. Fields beginning with characters commonly used in spreadsheet formulas (`=`, `+`, `-`, `@`, `\t`, `\r`) are prefixed with a single quote to prevent formula execution in spreadsheet applications.

---

## Deployment Best Practices

### 1. Set a Strong NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Set the result as the `NEXTAUTH_SECRET` environment variable. This secret is used for JWT token signing and (if `ENCRYPTION_KEY` is not set) API key encryption key derivation.

Never use the auto-generated development secret in production.

### 2. Set a Separate ENCRYPTION_KEY

For defense in depth, use a separate key for API key encryption:

```bash
openssl rand -base64 32
```

Set the result as the `ENCRYPTION_KEY` environment variable. This decouples session signing from data encryption, so rotating one does not affect the other.

### 3. Use HTTPS in Production

Set `NEXTAUTH_URL` to your HTTPS URL:

```bash
NEXTAUTH_URL=https://dawu.example.com
```

Use a reverse proxy (Nginx, Caddy, Traefik) to terminate TLS. See [Nginx Reverse Proxy](deployment/nginx.md) for configuration details.

### 4. Restrict Network Access

dawu-manager should be accessible only from trusted management networks. Use firewall rules to restrict access to the web interface. BNG nodes should be reachable from the dawu-manager server but not exposed to the internet.

### 5. Secure the Database File

The SQLite database contains encrypted API keys and password hashes:

```bash
# Docker: data is in a named volume
docker volume inspect dawu-data

# npx: data is at ~/.dawu-manager/data.db
chmod 600 ~/.dawu-manager/data.db

# systemd: data is at /var/lib/dawu-manager/data.db
chmod 600 /var/lib/dawu-manager/data.db
```

### 6. Keep Dependencies Updated

```bash
pnpm update
pnpm audit
```

### 7. Docker-Specific Hardening

The production Docker image:

- Runs as non-root user (UID 1001).
- Uses multi-stage build (no development dependencies in the production image).
- Based on `node:22-alpine` (minimal attack surface).
- Disables Next.js telemetry.

---

## Known Limitations

1. **Single-factor authentication** -- Only username/password is supported. Multi-factor authentication (TOTP/WebAuthn) is planned for a future release.
2. **No built-in rate limiting** -- API endpoints do not enforce rate limits. Use a reverse proxy (Nginx, Traefik) for rate limiting in production. See [Nginx Reverse Proxy](deployment/nginx.md) for an example configuration.
3. **SQLite single-writer** -- SQLite allows only one concurrent writer. This is adequate for the management dashboard workload but not designed for high-concurrency scenarios.
4. **No session revocation** -- Individual JWT sessions cannot be revoked without changing the `NEXTAUTH_SECRET` (which invalidates all sessions). Session revocation is planned for a future release.
