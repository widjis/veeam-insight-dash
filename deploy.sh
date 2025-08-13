#!/bin/bash

# Veeam Insight Dashboard - Production Deployment Script
# This script automates the deployment process for production environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="veeam-insight-dashboard"
DOMAIN="localhost"
SSL_COUNTRY="US"
SSL_STATE="State"
SSL_CITY="City"
SSL_ORG="Organization"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if external Redis is accessible
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; then
            log_success "External Redis is accessible"
        else
            log_error "External Redis is not accessible at localhost:6379"
            log_error "Please ensure your Redis service is running"
            exit 1
        fi
    else
        log_warning "Redis CLI not found - cannot verify Redis connectivity"
        log_warning "Please ensure Redis is running at localhost:6379"
    fi
    
    log_success "Prerequisites check passed"
}

setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.production" ]; then
            cp .env.production .env
            log_success "Copied .env.production to .env"
        else
            log_error ".env.production template not found"
            exit 1
        fi
    else
        log_warning ".env file already exists, skipping copy"
    fi
    
    # Generate JWT secrets if not set
    if ! grep -q "your-super-secret" .env; then
        log_info "JWT secrets already configured"
    else
        log_info "Generating JWT secrets..."
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        
        sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
        sed -i.bak "s/your-super-secret-refresh-key-change-this-in-production/$JWT_REFRESH_SECRET/g" .env
        
        rm .env.bak
        log_success "JWT secrets generated and configured"
    fi
}

setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    if [ ! -d "ssl" ]; then
        mkdir -p ssl
    fi
    
    if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
        log_info "Generating self-signed SSL certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=$SSL_COUNTRY/ST=$SSL_STATE/L=$SSL_CITY/O=$SSL_ORG/CN=$DOMAIN" \
            2>/dev/null
        
        chmod 644 ssl/*.pem
        log_success "SSL certificate generated"
    else
        log_warning "SSL certificates already exist, skipping generation"
    fi
}

setup_directories() {
    log_info "Creating required directories..."
    
    # Create logs directory
    if [ ! -d "logs" ]; then
        mkdir -p logs
        chmod 755 logs
        log_success "Logs directory created"
    else
        log_warning "Logs directory already exists"
    fi
    
    # Ensure tokens.json exists
    if [ ! -f "server/tokens.json" ]; then
        echo '{}' > server/tokens.json
        log_success "Created empty tokens.json file"
    fi
}

validate_configuration() {
    log_info "Validating configuration..."
    
    # Check required environment variables
    source .env
    
    if [ -z "$VEEAM_SERVER" ] || [ "$VEEAM_SERVER" = "your-veeam-server.domain.com" ]; then
        log_error "VEEAM_SERVER not configured in .env file"
        exit 1
    fi
    
    if [ -z "$VEEAM_USERNAME" ] || [ "$VEEAM_USERNAME" = "your-veeam-username" ]; then
        log_error "VEEAM_USERNAME not configured in .env file"
        exit 1
    fi
    
    if [ -z "$VEEAM_PASSWORD" ] || [ "$VEEAM_PASSWORD" = "your-veeam-password" ]; then
        log_error "VEEAM_PASSWORD not configured in .env file"
        exit 1
    fi
    
    log_success "Configuration validation passed"
}

build_and_deploy() {
    log_info "Building and deploying application..."
    
    # Stop existing containers
    if docker-compose ps | grep -q "Up"; then
        log_info "Stopping existing containers..."
        docker-compose down
    fi
    
    # Build and start services
    log_info "Building Docker images..."
    docker-compose build --no-cache
    
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 30
    
    log_success "Application deployed successfully"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        log_error "Some containers are not running"
        docker-compose ps
        exit 1
    fi
    
    # Test health endpoints
    log_info "Testing health endpoints..."
    
    # Wait a bit more for application to fully start
    sleep 10
    
    # Test nginx health
    if curl -k -f https://localhost/health &>/dev/null; then
        log_success "Nginx health check passed"
    else
        log_warning "Nginx health check failed, but continuing..."
    fi
    
    # Test application health
    if curl -k -f https://localhost/api/health &>/dev/null; then
        log_success "Application health check passed"
    else
        log_warning "Application health check failed, checking logs..."
        docker-compose logs --tail=20 veeam-insight
    fi
    
    log_success "Deployment verification completed"
}

show_status() {
    echo
    log_info "=== Deployment Status ==="
    docker-compose ps
    echo
    log_info "=== Access URLs ==="
    echo "Dashboard: https://localhost"
    echo "API Health: https://localhost/api/health"
    echo "Nginx Health: https://localhost/health"
    echo "External Redis: localhost:6379"
    echo
    log_info "=== Useful Commands ==="
    echo "View logs: docker-compose logs -f"
    echo "Stop services: docker-compose down"
    echo "Restart services: docker-compose restart"
    echo "Update deployment: ./deploy.sh"
    echo "Redis CLI: redis-cli -h localhost -p 6379"
    echo
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove unused Docker images
    docker image prune -f
    
    log_success "Cleanup completed"
}

# Main deployment process
main() {
    echo
    log_info "=== Veeam Insight Dashboard - Production Deployment ==="
    echo
    
    check_prerequisites
    setup_environment
    setup_ssl
    setup_directories
    validate_configuration
    build_and_deploy
    verify_deployment
    cleanup
    show_status
    
    echo
    log_success "🚀 Deployment completed successfully!"
    log_info "Your Veeam Insight Dashboard is now running at: https://localhost"
    echo
}

# Handle script arguments
case "${1:-}" in
    "--help" | "-h")
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --status, -s   Show current deployment status"
        echo "  --logs, -l     Show application logs"
        echo "  --stop         Stop all services"
        echo "  --restart      Restart all services"
        exit 0
        ;;
    "--status" | "-s")
        docker-compose ps
        exit 0
        ;;
    "--logs" | "-l")
        docker-compose logs -f
        exit 0
        ;;
    "--stop")
        log_info "Stopping all services..."
        docker-compose down
        log_success "All services stopped"
        exit 0
        ;;
    "--restart")
        log_info "Restarting all services..."
        docker-compose restart
        log_success "All services restarted"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac