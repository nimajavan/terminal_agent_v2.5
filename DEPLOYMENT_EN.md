# Linux Terminal Agent (LTA Pro Studio) - Production Deployment Guide

A complete, battle-tested guide for deploying **Linux Terminal Agent Studio (LTA Pro)** on cloud virtual machines (VPS, Dedicated, AWS EC2, Google Cloud Compute Engine, DigitalOcean, Hetzner, Linode) running modern Linux distributions.

---

## Table of Contents
1. [Architecture & System Requirements](#1-architecture--system-requirements)
2. [Server Preparation & Tooling Installation](#2-server-preparation--tooling-installation)
3. [Cloning the Repository & Installing Dependencies](#3-cloning-the-repository--installing-dependencies)
4. [Configuring Environment Variables (`.env`)](#4-configuring-environment-variables-env)
5. [Method 1: Systemd Service Deployment (Recommended)](#5-method-1-systemd-service-deployment-recommended)
6. [Method 2: Docker & Docker Compose Containerized Setup](#6-method-2-docker--docker-compose-containerized-setup)
7. [Nginx Reverse Proxy Configuration](#7-nginx-reverse-proxy-configuration)
8. [Automated TLS / SSL with Let's Encrypt (Certbot)](#8-automated-tls--ssl-with-lets-encrypt-certbot)
9. [Firewall & Security Hardening (UFW)](#9-firewall--security-hardening-ufw)
10. [Health Checks, Logging & Maintenance](#10-health-checks-logging--maintenance)

---

## 1. Architecture & System Requirements

LTA Pro Studio combines an Express backend with child process isolation, safety bounds, and an interactive React/Tailwind frontend.

### Hardware Specifications
* **Operating System:** Linux (Ubuntu 22.04/24.04 LTS, Debian 11/12, or AlmaLinux/Rocky Linux 9)
* **CPU:** 2 Cores minimum (4 Cores recommended for high-concurrency environments)
* **RAM:** 2 GB minimum (4 GB recommended)
* **Disk Space:** 10 GB+ SSD free space
* **Privileges:** User with `sudo` permissions or `root`

### Software Prerequisites
* Node.js version 20.x or 22.x LTS
* NPM version 10.x or higher
* Python 3.8+ (for parallel local LTA CLI execution)
* Git

---

## 2. Server Preparation & Tooling Installation

Update repository mirrors and install required build essentials:

```bash
# Update package repositories and existing packages
sudo apt update && sudo apt upgrade -y

# Install core development utilities
sudo apt install -y curl wget git build-essential ufw nginx python3 python3-pip python3-venv
```

### Install Node.js 22 LTS:
```bash
# Register official NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify versions
node -v   # Should output v20.x or v22.x
npm -v    # Should output 10.x+
```

---

## 3. Cloning the Repository & Installing Dependencies

Create an application directory under `/var/www/` or your preferred location:

```bash
# Create target application directory
sudo mkdir -p /var/www/terminal_agent
sudo chown -R $USER:$USER /var/www/terminal_agent

# Navigate to project root
cd /var/www/terminal_agent

# Clone the repository
git clone https://github.com/nimajavan/terminal_agent.git .

# Install all runtime and development packages
npm install
```

---

## 4. Configuring Environment Variables (`.env`)

Create the `.env` configuration file from the template:

```bash
cp .env.example .env
nano .env
```

Set the runtime variables:
```env
# Google Gemini API key (optional; offline rule-based & local Ollama work without keys)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Server listening port
PORT=3000

# Canonical public URL of your instance
APP_URL="https://terminal.yourdomain.com"

# Node environment flag
NODE_ENV="production"
```

Save and exit in nano (`Ctrl + O`, `Enter`, then `Ctrl + X`).

---

## 5. Method 1: Systemd Service Deployment (Recommended)

Running LTA Pro as a native Systemd daemon provides automatic restart on reboot or crash, journal log integration, and full native Linux command inspection capability.

### 5.1. Build the Production Bundle
```bash
cd /var/www/terminal_agent
npm run build
```

### 5.2. Create Systemd Service File
```bash
sudo nano /etc/systemd/system/lta.service
```

Paste the following systemd unit configuration:
```ini
[Unit]
Description=Linux Terminal Agent Studio (LTA Pro)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/terminal_agent
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=lta-agent
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/terminal_agent/.env

[Install]
WantedBy=multi-user.target
```

### 5.3. Enable and Start the Service
```bash
# Reload systemd manager configuration
sudo systemctl daemon-reload

# Enable automatic start on boot
sudo systemctl enable lta.service

# Start service immediately
sudo systemctl start lta.service

# Check active status
sudo systemctl status lta.service
```

You should see an active status (`active (running)`).

---

## 6. Method 2: Docker & Docker Compose Containerized Setup

If you prefer isolated container deployment:

### 6.1. Create `Dockerfile`:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache bash procps iproute2 curl util-linux
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

### 6.2. Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  lta-agent:
    build: .
    container_name: lta-studio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - lta-backups:/app/.lta_backups

volumes:
  lta-backups:
```

### 6.3. Launch Container:
```bash
docker compose up -d --build
docker compose ps
```

---

## 7. Nginx Reverse Proxy Configuration

Nginx acts as the TLS terminating front-facing web server, forwarding requests to the local Express backend on port `3000`.

Create an Nginx server block:
```bash
sudo nano /etc/nginx/sites-available/lta.conf
```

Configuration contents:
```nginx
server {
    listen 80;
    server_name terminal.yourdomain.com; # Replace with your domain or server IP

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket & EventStream headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Streaming timeouts for long-running commands
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the configuration:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/lta.conf /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 8. Automated TLS / SSL with Let's Encrypt (Certbot)

To issue a free, auto-renewing SSL certificate:

```bash
# Install Certbot and the Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain and configure certificate
sudo certbot --nginx -d terminal.yourdomain.com
```

Certbot will automatically modify your Nginx block to redirect all HTTP traffic to HTTPS on port `443`.

Test auto-renewal timer:
```bash
sudo certbot renew --dry-run
```

---

## 9. Firewall & Security Hardening (UFW)

Enforce strict ingress policies:

```bash
# Crucial: Allow SSH to prevent losing server access
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify active status
sudo ufw status verbose
```

---

## 10. Health Checks, Logging & Maintenance

### Real-time Logs:
```bash
# Follow live application log output
sudo journalctl -u lta.service -f -n 100
```

### Direct Health Check:
```bash
# Verify HTTP 200 response
curl -I http://127.0.0.1:3000

# Inspect telemetry JSON output
curl -s http://127.0.0.1:3000/api/system/status | head -c 200
```

### Zero-Downtime Update Procedure:
```bash
cd /var/www/terminal_agent
git pull origin main
npm install
npm run build
sudo systemctl restart lta.service
```

Your **Linux Terminal Agent Studio** is now fully operational, secure, and ready for production workloads.
