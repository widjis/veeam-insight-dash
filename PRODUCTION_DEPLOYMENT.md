# 🚀 Veeam Insight Dashboard - Production Deployment Guide

## 📋 Overview

This guide provides comprehensive instructions for deploying the Veeam Insight Dashboard in a production Docker environment with SSL, reverse proxy, and monitoring.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Internet    │───▶│   Nginx Proxy   │───▶│  Veeam Insight  │
│                 │    │   (SSL/HTTPS)   │    │   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       ▼
                                │               ┌─────────────────┐
                                │               │     Redis       │
                                │               │     Cache       │
                                │               └─────────────────┘
                                ▼
                        ┌─────────────────┐
                        │   SSL Certs     │
                        │   & Logs        │
                        └─────────────────┘
```

## 🔧 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **CPU**: 2+ cores
- **Storage**: 20GB+ available space
- **Network**: Ports 80, 443, 3001, 3002, 6379 available

### Software Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL (for SSL certificates)

### Installation Commands
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

## 📦 Deployment Steps

### Step 1: Clone Repository
```bash
git clone <your-repository-url>
cd veeam-insight-dash
```

### Step 2: Environment Configuration
```bash
# Copy production environment template
cp .env.production .env

# Edit environment variables
nano .env
```

**Required Configuration:**
```bash
# Veeam Server Details
VEEAM_SERVER=your-veeam-server.domain.com
VEEAM_USERNAME=your-veeam-username
VEEAM_PASSWORD=your-secure-password

# Security (Generate strong secrets)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Optional: WhatsApp Integration
WHATSAPP_API_URL=your-whatsapp-api-url
WHATSAPP_API_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER=your-phone-number
```

### Step 3: SSL Certificate Setup

#### Option A: Self-Signed Certificate (Development/Testing)
```bash
# Create SSL directory
mkdir -p ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

#### Option B: Let's Encrypt Certificate (Production)
```bash
# Install Certbot
sudo apt install certbot

# Generate certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem
```

### Step 4: Create Required Directories
```bash
# Create logs directory
mkdir -p logs

# Set proper permissions
chmod 755 logs
chmod 644 ssl/*.pem
```

### Step 5: Build and Deploy
```bash
# Build and start services
docker-compose up -d --build

# Verify deployment
docker-compose ps
docker-compose logs -f
```

### Step 6: Verify Deployment
```bash
# Check service health
curl -k https://localhost/health
curl -k https://localhost/api/health

# Check logs
docker-compose logs veeam-insight
docker-compose logs nginx
docker-compose logs redis
```

## 🔒 Security Configuration

### Firewall Setup
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### SSL Security Headers
The nginx configuration includes security headers:
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- Content Security Policy
- XSS Protection

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Application health
curl -k https://your-domain.com/api/health

# Service status
docker-compose ps

# Resource usage
docker stats
```

### Log Management
```bash
# View application logs
docker-compose logs -f veeam-insight

# View nginx logs
docker-compose logs -f nginx

# View Redis logs
docker-compose logs -f redis

# Application logs location
tail -f logs/app.log
```

### Backup Procedures
```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE

# Backup application logs
tar -czf backup-$(date +%Y%m%d).tar.gz logs/ ssl/ .env

# Backup configuration
cp docker-compose.yml docker-compose.yml.backup
cp nginx.conf nginx.conf.backup
```

## 🔄 Management Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart veeam-insight

# Update and restart
docker-compose down
git pull
docker-compose up -d --build
```

### Scaling
```bash
# Scale application instances
docker-compose up -d --scale veeam-insight=3
```

### Database Operations
```bash
# Redis CLI access
docker-compose exec redis redis-cli

# Clear cache
docker-compose exec redis redis-cli FLUSHALL

# Monitor Redis
docker-compose exec redis redis-cli MONITOR
```

## 🚨 Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:443
```

#### 2. Connection Issues
```bash
# Check port availability
netstat -tlnp | grep :443
netstat -tlnp | grep :80

# Test internal connectivity
docker-compose exec veeam-insight curl http://localhost:3001/api/health
```

#### 3. Performance Issues
```bash
# Monitor resource usage
docker stats

# Check application metrics
curl -k https://localhost/api/metrics

# Analyze logs for errors
docker-compose logs veeam-insight | grep ERROR
```

#### 4. Redis Connection Issues
```bash
# Test Redis connectivity
docker-compose exec veeam-insight redis-cli -h redis ping

# Check Redis logs
docker-compose logs redis
```

### Log Analysis
```bash
# Application errors
grep -i error logs/app.log

# Nginx access patterns
tail -f /var/log/nginx/access.log

# Failed authentication attempts
grep "401\|403" /var/log/nginx/access.log
```

## 🔧 Advanced Configuration

### External Redis
To use external Redis, modify `.env`:
```bash
# Comment out Redis service in docker-compose.yml
# Update environment variables
REDIS_HOST=your-redis-server.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

### Load Balancing
For multiple instances, update nginx upstream:
```nginx
upstream backend {
    server veeam-insight-1:3001;
    server veeam-insight-2:3001;
    server veeam-insight-3:3001;
}
```

### Custom Domain
1. Update DNS records to point to your server
2. Update nginx server_name
3. Generate SSL certificate for your domain
4. Update environment variables

## 📞 Support

### Health Endpoints
- **Application**: `https://your-domain.com/api/health`
- **Nginx**: `https://your-domain.com/health`
- **WebSocket**: Check browser console for WS connection

### Monitoring URLs
- **Dashboard**: `https://your-domain.com`
- **API Documentation**: `https://your-domain.com/api/docs`
- **Metrics**: `https://your-domain.com/api/metrics`

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Commit**: $(git rev-parse --short HEAD)