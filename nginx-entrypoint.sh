#!/bin/sh

# Nginx entrypoint script to substitute environment variables

echo "Processing nginx configuration with environment variables..."

# Set default values if not provided
export BACKEND_HOST=${BACKEND_HOST:-veeam-insight}
export BACKEND_PORT=${BACKEND_PORT:-3003}
export WEBSOCKET_HOST=${WEBSOCKET_HOST:-veeam-insight}
export WEBSOCKET_PORT=${WEBSOCKET_PORT:-3002}

echo "Using configuration:"
echo "  BACKEND_HOST: $BACKEND_HOST"
echo "  BACKEND_PORT: $BACKEND_PORT"
echo "  WEBSOCKET_HOST: $WEBSOCKET_HOST"
echo "  WEBSOCKET_PORT: $WEBSOCKET_PORT"

# Process the nginx configuration template
envsubst '${BACKEND_HOST} ${BACKEND_PORT} ${WEBSOCKET_HOST} ${WEBSOCKET_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "Nginx configuration processed successfully"

# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx configuration is valid"
    # Start nginx
    exec nginx -g 'daemon off;'
else
    echo "Nginx configuration is invalid"
    exit 1
fi