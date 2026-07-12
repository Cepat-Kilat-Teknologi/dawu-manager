# Nginx Reverse Proxy

In production deployments, placing dawu-manager behind an Nginx reverse proxy provides TLS termination, HTTP/2 support, request buffering, and the ability to serve multiple applications on standard ports (80/443).

---

## Prerequisites

- Nginx installed on the host (or a separate proxy server).
- dawu-manager running on its default port (3789) or any other configured port.
- A domain name pointed to the server's IP address (for TLS certificates).
- Certbot or another ACME client for Let's Encrypt certificates (optional but recommended).

---

## Basic Configuration (HTTP Only)

Create `/etc/nginx/sites-available/dawu-manager`:

```nginx
server {
    listen 80;
    server_name dawu.example.com;

    location / {
        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings for long-running proxy requests
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/dawu-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## TLS Configuration (HTTPS with Let's Encrypt)

### Step 1: Obtain a Certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dawu.example.com
```

Certbot automatically modifies the Nginx configuration to add TLS directives and sets up auto-renewal.

### Step 2: Verify the Configuration

After Certbot runs, the configuration should look like:

```nginx
server {
    listen 80;
    server_name dawu.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dawu.example.com;

    ssl_certificate /etc/letsencrypt/live/dawu.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dawu.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

### Step 3: Update dawu-manager Environment

When running behind a TLS-terminating proxy, update the `NEXTAUTH_URL` environment variable to use HTTPS:

```bash
NEXTAUTH_URL=https://dawu.example.com
```

Restart dawu-manager after changing the environment.

---

## Server-Sent Events (SSE) Support

dawu-manager uses Server-Sent Events for log streaming. Nginx must be configured to support SSE by disabling buffering for those endpoints:

```nginx
location /api/nodes/ {
    proxy_pass http://127.0.0.1:3789;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Required for SSE
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;

    # Extended timeout for long-lived SSE connections
    proxy_read_timeout 3600s;
}
```

Place this `location` block before the general `location /` block so it takes precedence for API routes.

---

## WebSocket Support

The `Upgrade` and `Connection` headers in the configuration enable WebSocket support. While dawu-manager primarily uses SSE rather than WebSockets, the headers are included for compatibility with Next.js hot module replacement during development.

---

## Security Headers

Add security headers to the Nginx configuration for defense-in-depth:

```nginx
server {
    # ... existing config ...

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # HSTS (only if using HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

---

## Rate Limiting

Protect the login endpoint from brute-force attacks:

```nginx
# Define rate limit zone (in http block or top of server block)
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

server {
    # ... existing config ...

    location /api/auth/callback/credentials {
        limit_req zone=login burst=3 nodelay;

        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This limits login attempts to 5 per minute per IP address, with a burst allowance of 3 additional requests.

---

## Access Logging

Configure a dedicated access log for dawu-manager:

```nginx
server {
    access_log /var/log/nginx/dawu-manager-access.log;
    error_log /var/log/nginx/dawu-manager-error.log;

    # ... rest of config ...
}
```

---

## Complete Production Configuration

A complete production-ready configuration combining all of the above:

```nginx
limit_req_zone $binary_remote_addr zone=dawu_login:10m rate=5r/m;

server {
    listen 80;
    server_name dawu.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dawu.example.com;

    ssl_certificate /etc/letsencrypt/live/dawu.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dawu.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/dawu-manager-access.log;
    error_log /var/log/nginx/dawu-manager-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Login rate limiting
    location /api/auth/callback/credentials {
        limit_req zone=dawu_login burst=3 nodelay;

        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API routes (SSE support)
    location /api/ {
        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # All other routes
    location / {
        proxy_pass http://127.0.0.1:3789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

---

## Testing the Configuration

After making changes:

```bash
# Validate syntax
sudo nginx -t

# Reload without downtime
sudo systemctl reload nginx

# Test HTTPS
curl -I https://dawu.example.com
```
