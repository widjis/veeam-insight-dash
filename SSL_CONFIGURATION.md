# SSL/HTTPS Configuration Guide

This guide explains how to configure the Veeam Insight Dashboard to use either HTTP or HTTPS.

## Default Configuration (HTTP Only)

By default, the application is configured to run on HTTP only for easier development and testing.

### Current Settings:
- **Protocol**: HTTP
- **Port**: 9007
- **URL**: http://localhost:9007
- **Nginx Config**: `nginx-http.conf`

## Switching to HTTPS

To enable HTTPS, follow these steps:

### 1. Update Environment Variables

Edit `.env.production` and set:
```bash
ENABLE_SSL=true
HTTP_PORT=9007
HTTPS_PORT=9008
```

### 2. Update Docker Compose

Edit `docker-compose.yml` and change the nginx volumes section:
```yaml
volumes:
  # Change this line for HTTPS:
  - ./nginx.conf:/etc/nginx/nginx.conf:ro
  - ./ssl:/etc/nginx/ssl:ro
```

### 3. SSL Certificates

The application includes self-signed certificates in the `ssl/` directory for development.

**For Production**: Replace the certificates with proper SSL certificates:
```bash
# Replace with your actual certificates
cp your-cert.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem
```

### 4. Restart Services

```bash
docker-compose down
docker-compose up -d
```

### 5. Access URLs

- **HTTP**: http://localhost:9007
- **HTTPS**: https://localhost:9008

## Configuration Files

| File | Purpose |
|------|----------|
| `nginx-http.conf` | HTTP-only configuration (default) |
| `nginx.conf` | Full HTTP + HTTPS configuration |
| `ssl/cert.pem` | SSL certificate |
| `ssl/key.pem` | SSL private key |

## Security Notes

1. **Self-signed certificates** are included for development only
2. **Production deployments** should use proper SSL certificates from a trusted CA
3. **HTTP configuration** includes security headers but lacks encryption
4. **HTTPS configuration** provides full encryption and security

## Troubleshooting

### SSL Certificate Errors
If you see SSL certificate errors:
1. Ensure certificates exist in `ssl/` directory
2. Check certificate permissions
3. Verify certificate validity

### Port Conflicts
If ports are already in use:
1. Update `HTTP_PORT` and `HTTPS_PORT` in `.env.production`
2. Update port mappings in `docker-compose.yml`

### Nginx Configuration Errors
If nginx fails to start:
1. Check nginx configuration syntax: `docker exec veeam-insight-nginx nginx -t`
2. Review nginx logs: `docker logs veeam-insight-nginx`