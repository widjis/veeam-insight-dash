# Port Configuration Guide

This guide explains how to easily change ports for the Veeam Insight Dashboard in production.

## Current Port Setup

### Internal Application Ports (Inside Docker)
- **Backend API**: Port 3001 (Node.js server)
- **WebSocket**: Port 3002 (Real-time updates)

### External Access Ports (Host Machine)
- **HTTP Access**: Port 9007 (default)
- **HTTPS Access**: Port 9008 (default)
- **Direct Backend**: Port 3001 (exposed for development)
- **Direct WebSocket**: Port 3002 (exposed for development)

## How to Change Ports

### Option 1: Change External Access Ports Only (Recommended)

Edit `.env.production` file:

```bash
# Change these values to your desired ports
HTTP_PORT=8080        # Change from 9007 to 8080
HTTPS_PORT=8443       # Change from 9008 to 8443
```

**Access URLs after change:**
- HTTP: `http://your-server:8080`
- HTTPS: `https://your-server:8443`

### Option 2: Change Internal Application Ports

If port 3001 is not available on your production server:

1. **Update `.env` file:**
```bash
PORT=4001             # Change from 3001 to 4001
WS_PORT=4002          # Change from 3002 to 4002
```

2. **Update `server/.env.production` (if using for reference):**
```bash
PORT=4001             # Change from 3001 to 4001
```

**Note:** No need to manually update `docker-compose.yml` - it now uses environment variables automatically!

4. **Update nginx configurations:**

   **In `nginx-http.conf`:**
   ```nginx
   upstream backend {
       server veeam-insight:4001 max_fails=3 fail_timeout=30s;  # Change from 3001
       keepalive 32;
   }
   
   upstream websocket {
       server veeam-insight:4002 max_fails=3 fail_timeout=30s;  # Change from 3002
       keepalive 32;
   }
   ```

   **In `nginx.conf`:**
   ```nginx
   upstream backend {
       server veeam-insight:4001 max_fails=3 fail_timeout=30s;  # Change from 3001
       keepalive 32;
   }
   
   upstream websocket {
       server veeam-insight:4002 max_fails=3 fail_timeout=30s;  # Change from 3002
       keepalive 32;
   }
   ```

## Quick Port Change Commands

### For External Ports Only (Easiest)
```bash
# Edit the main environment file
nano .env.production

# Change these lines:
# HTTP_PORT=9007  →  HTTP_PORT=8080
# HTTPS_PORT=9008  →  HTTPS_PORT=8443

# Restart services
docker-compose down
docker-compose up -d
```

### For Internal Ports (If 3001/3002 are occupied)
```bash
# Edit .env file
cp .env.production .env
nano .env  # Change PORT and WS_PORT

# Restart containers
docker-compose down
docker-compose up -d
```

## Port Conflict Resolution

If you get "port already in use" errors:

1. **Check what's using the port:**
```bash
lsof -i :3001
netstat -tulpn | grep 3001
```

2. **Stop the conflicting service:**
```bash
sudo systemctl stop service-name
# or
sudo kill -9 PID
```

3. **Use different ports** (follow Option 2 above)

## Verification

After changing ports, verify the setup:

```bash
# Check if containers are running
docker-compose ps

# Check nginx configuration
docker-compose exec nginx nginx -t

# Check application logs
docker-compose logs veeam-insight
docker-compose logs nginx

# Test connectivity
curl http://localhost:YOUR_HTTP_PORT/health
```

## Common Port Configurations

| Environment | HTTP Port | HTTPS Port | Internal API | Internal WS |
|-------------|-----------|------------|--------------|-------------|
| Development| 9007      | 9008       | 3001         | 3002        |
| Staging     | 8080      | 8443       | 3001         | 3002        |
| Production  | 80        | 443        | 3001         | 3002        |
| Alt Prod    | 8080      | 8443       | 4001         | 4002        |

## Notes

- **External ports** (HTTP_PORT, HTTPS_PORT) are what users access
- **Internal ports** (3001, 3002) are used inside Docker containers
- Changing external ports is easier and usually sufficient
- Only change internal ports if they conflict with existing services
- Always update CORS_ORIGIN in environment files when changing external ports
- Remember to update firewall rules for new ports