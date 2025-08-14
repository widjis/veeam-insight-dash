#!/bin/sh

# Copy environment files from .env.production to .env
echo "Setting up environment files..."
if [ -f "/app/.env.production" ] && [ ! -f "/app/.env" ]; then
    echo "Copying root .env.production to .env"
    cp /app/.env.production /app/.env 2>/dev/null || echo "Warning: Could not copy root .env file (using .env.production directly)"
fi

if [ -f "/app/server/.env.production" ] && [ ! -f "/app/server/.env" ]; then
    echo "Copying server .env.production to server/.env"
    cp /app/server/.env.production /app/server/.env 2>/dev/null || echo "Warning: Could not copy server .env file (using .env.production directly)"
fi

# Copy frontend build files to shared volume if they don't exist
if [ ! -f "/app/public/index.html" ]; then
    echo "Copying frontend files to shared volume..."
    cp -r /app/frontend-dist/* /app/public/
    echo "Frontend files copied successfully"
else
    echo "Frontend files already exist in shared volume"
fi

echo "Environment setup completed"

# Start the application
exec "$@"