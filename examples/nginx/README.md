# Nginx Reverse Proxy

Put dawu-manager behind nginx with HTTPS termination.

## Prerequisites

- nginx installed (`sudo apt install nginx`)
- dawu-manager running on port 3789 (Docker or systemd)
- A domain name pointing to this server (for HTTPS)

## Setup

### Option A: With Let's Encrypt (recommended)

```bash
# 1. Install certbot
sudo apt install certbot python3-certbot-nginx

# 2. Copy nginx config
sudo cp dawu-manager.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/dawu-manager.conf /etc/nginx/sites-enabled/

# 3. Edit domain name
sudo nano /etc/nginx/sites-available/dawu-manager.conf
# Replace dawu.example.com with your domain

# 4. Test config
sudo nginx -t

# 5. Reload nginx
sudo systemctl reload nginx

# 6. Get SSL certificate
sudo certbot --nginx -d dawu.example.com

# 7. Update NEXTAUTH_URL
# Set NEXTAUTH_URL=https://dawu.example.com in your env
```

### Option B: HTTP only (internal network)

```bash
# 1. Copy the HTTP-only config
sudo cp dawu-manager-http.conf /etc/nginx/sites-available/dawu-manager.conf
sudo ln -s /etc/nginx/sites-available/dawu-manager.conf /etc/nginx/sites-enabled/

# 2. Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## Verify

```bash
# Health check through nginx
curl -sf https://dawu.example.com/api/auth/csrf

# Check nginx status
sudo systemctl status nginx
```
