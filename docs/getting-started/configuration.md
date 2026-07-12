# Configuration

dawu-manager is configured through environment variables. No configuration file is required for basic operation.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | No | `file:~/.dawu-manager/data.db` (npx) | Path to the SQLite database file. Docker images default to `file:/data/dawu.db`. |
| `NEXTAUTH_SECRET` | Yes | Auto-generated (dev only) | Secret used for JWT token signing and API key encryption key derivation. Must be set for production. |
| `NEXTAUTH_URL` | No | `http://localhost:3789` | Canonical URL for NextAuth.js authentication callbacks. Set to your public URL in production. |
| `PORT` | No | `3789` | TCP port the server listens on. |
| `ENCRYPTION_KEY` | No | Falls back to `NEXTAUTH_SECRET` | Dedicated secret for API key encryption. When set, decouples encryption from session signing. |
| `NODE_ENV` | No | `development` | Set to `production` for production builds. |
| `NEXT_TELEMETRY_DISABLED` | No | `1` (Docker) | Disables Next.js anonymous telemetry collection. |

---

## Variable Details

### NEXTAUTH_SECRET

This is the most important configuration variable. It serves two purposes:

1. **JWT signing** -- All user session tokens are signed with this secret. Changing it invalidates all active sessions.
2. **API key encryption** -- Unless `ENCRYPTION_KEY` is set, this secret is used to derive the AES-256-GCM encryption key for stored dawos-agent API keys.

Generate a cryptographically secure value:

```bash
openssl rand -base64 32
```

!!! danger "Production requirement"
    Without a fixed `NEXTAUTH_SECRET`, the server generates a random secret on each startup. This means all users are logged out and, critically, all stored API keys become undecryptable after a restart. Always set this variable in production.

### ENCRYPTION_KEY

An optional dedicated secret for API key encryption. When set, dawu-manager uses this value instead of `NEXTAUTH_SECRET` for the scrypt key derivation used in AES-256-GCM encryption.

This separation is useful when you need to rotate the session signing secret (`NEXTAUTH_SECRET`) without re-encrypting all stored API keys.

```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

!!! tip "When to use ENCRYPTION_KEY"
    For most deployments, relying on `NEXTAUTH_SECRET` alone is sufficient. Set `ENCRYPTION_KEY` separately only if your security policy requires independent rotation of session and encryption keys.

### DATABASE_URL

The SQLite database file path. The format is `file:<path>`.

| Deployment | Default Path | Example |
|------------|-------------|---------|
| npx | `~/.dawu-manager/data.db` | `file:/home/user/.dawu-manager/data.db` |
| Docker | `/data/dawu.db` | `file:/data/dawu.db` |
| Development | `./dev.db` | `file:./dev.db` |

The directory must exist and be writable by the process owner.

### NEXTAUTH_URL

The public-facing URL of your dawu-manager instance. This value is used by NextAuth.js for constructing authentication callback URLs.

```bash
# Internal network
NEXTAUTH_URL=http://192.168.1.100:3789

# Behind a reverse proxy with HTTPS
NEXTAUTH_URL=https://dawu.example.com
```

!!! note "Reverse proxy deployments"
    When running behind nginx or another reverse proxy, set this to the external URL that users access in their browsers, not the internal address.

---

## CLI Options

When using `npx dawu-manager`, the following command-line flags are available:

| Flag | Description | Example |
|------|-------------|---------|
| `--port <number>` | Override the listen port | `npx dawu-manager --port 4000` |
| `--help` | Display usage information | `npx dawu-manager --help` |
| `--version` | Display the installed version | `npx dawu-manager --version` |

---

## Database Location by Deployment Method

| Method | Database Path | Persistence |
|--------|--------------|-------------|
| `npx dawu-manager` | `~/.dawu-manager/data.db` | Persists across restarts and upgrades |
| Docker Compose | `/data/dawu.db` (named volume) | Persists in Docker volume `dawu-data` |
| Docker run | `/data/dawu.db` (named volume) | Persists in Docker volume |
| Development (`pnpm dev`) | `./dev.db` | Local file in project directory |

---

## Production Configuration Example

### npx deployment

```bash
export NEXTAUTH_SECRET="your-64-char-random-secret-here"
export NEXTAUTH_URL="https://dawu.example.com"
export PORT=3789
npx dawu-manager
```

### Docker Compose

```yaml
services:
  dawu-manager:
    image: ghcr.io/cepat-kilat-teknologi/dawu-manager:latest
    ports:
      - "3789:3789"
    volumes:
      - dawu-data:/data
    environment:
      DATABASE_URL: file:/data/dawu.db
      NEXTAUTH_SECRET: your-64-char-random-secret-here
      NEXTAUTH_URL: https://dawu.example.com
      ENCRYPTION_KEY: optional-separate-encryption-key
    restart: unless-stopped

volumes:
  dawu-data:
```

### Systemd environment file

```bash
# /etc/dawu-manager/dawu.env
DATABASE_URL=file:/var/lib/dawu-manager/data.db
NEXTAUTH_SECRET=your-64-char-random-secret-here
NEXTAUTH_URL=https://dawu.example.com
PORT=3789
NODE_ENV=production
```
