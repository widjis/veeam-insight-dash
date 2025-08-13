#!/bin/sh

# Copy frontend build files to shared volume if they don't exist
if [ ! -f "/app/public/index.html" ]; then
    echo "Copying frontend files to shared volume..."
    cp -r /app/frontend-dist/* /app/public/
    echo "Frontend files copied successfully"
else
    echo "Frontend files already exist in shared volume"
fi

# Start the application
exec "$@"