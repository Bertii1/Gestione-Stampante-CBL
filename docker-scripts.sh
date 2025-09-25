#!/bin/bash

# ==============================================================================
# 🐳 Docker Management Scripts for Gestione Stampante
# ==============================================================================
# Collection of utility scripts for deployment, backup, and maintenance
# Converted from PowerShell to Bash for cross-platform compatibility
# ==============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emoji support check
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$TERM" == *"256color"* ]]; then
    ROCKET="🚀"
    HOURGLASS="⏳"
    CHECK="✅"
    CROSS="❌"
    PACKAGE="📦"
    GLOBE="🌐"
    WRENCH="🔧"
    EYES="👀"
    STOP="🛑"
    CLEAN="🧹"
    DATABASE="🗄️"
    BACKUP="💾"
    LOGS="📄"
    INFO="ℹ️"
    WARNING="⚠️"
else
    ROCKET="[DEPLOY]"
    HOURGLASS="[WAIT]"
    CHECK="[OK]"
    CROSS="[ERROR]"
    PACKAGE="[BACKUP]"
    GLOBE="[WEB]"
    WRENCH="[SETUP]"
    EYES="[SHOW]"
    STOP="[STOP]"
    CLEAN="[CLEAN]"
    DATABASE="[DB]"
    BACKUP="[BACKUP]"
    LOGS="[LOGS]"
    INFO="[INFO]"
    WARNING="[WARN]"
fi

# ==============================================================================
# Utility Functions
# ==============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_info() {
    echo -e "${CYAN}${INFO} $1${NC}"
}

wait_for_service() {
    local service_name="$1"
    local max_attempts="${2:-30}"
    local attempt=0
    
    echo -e "${YELLOW}${HOURGLASS} Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose ps "$service_name" | grep -q "Up"; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within expected time"
    return 1
}

check_dependencies() {
    local deps=("docker" "docker-compose" "curl" "jq")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        echo -e "${YELLOW}Please install the missing dependencies and try again.${NC}"
        return 1
    fi
    
    return 0
}

# ==============================================================================
# Main Deployment Function
# ==============================================================================

deploy_application() {
    print_header "Deploying Gestione Stampante Application"
    
    # Check dependencies
    if ! check_dependencies; then
        return 1
    fi
    
    # Stop existing containers
    print_info "Stopping existing containers..."
    docker-compose down
    
    # Build containers
    print_info "Building Docker containers..."
    if ! docker-compose build --no-cache; then
        print_error "Failed to build Docker containers"
        return 1
    fi
    
    # Start services
    print_info "Starting services..."
    if ! docker-compose up -d; then
        print_error "Failed to start services"
        return 1
    fi
    
    # Wait for database
    if ! wait_for_service "db" 60; then
        print_error "Database failed to start"
        docker-compose logs db
        return 1
    fi
    
    # Wait for application
    sleep 10
    if ! wait_for_service "app" 30; then
        print_error "Application failed to start"
        docker-compose logs app
        return 1
    fi
    
    # Health check
    echo -e "${YELLOW}${HOURGLASS} Performing health check...${NC}"
    sleep 5
    
    if curl -f http://localhost:800/health &>/dev/null; then
        local health_response
        health_response=$(curl -s http://localhost:800/health | jq -r '.status' 2>/dev/null || echo "unknown")
        
        if [ "$health_response" = "ok" ]; then
            print_success "Deployment successful!"
            echo -e "${CYAN}${GLOBE} Application available at: ${BLUE}http://localhost:800${NC}"
            echo ""
            print_info "Default credentials:"
            echo "  Admin: admin / admin123"
            echo "  Operator: operatore / test123"
        else
            print_warning "Application started but health check returned: $health_response"
        fi
    else
        print_error "Health check failed!"
        echo -e "${YELLOW}Check application logs for details:${NC}"
        docker-compose logs --tail=20 app
        return 1
    fi
    
    return 0
}

# ==============================================================================
# Database Backup Functions
# ==============================================================================

backup_database() {
    print_header "Creating Database Backup"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="./backups"
    local backup_file="$backup_dir/stampante_$timestamp.sql"
    
    # Create backup directory
    mkdir -p "$backup_dir"
    
    # Check if database container is running
    if ! docker-compose ps db | grep -q "Up"; then
        print_error "Database container is not running"
        return 1
    fi
    
    print_info "Creating database backup..."
    
    # Create backup
    if docker-compose exec -T db mysqldump \
        -u app -ppassword \
        --single-transaction \
        --routines \
        --triggers \
        --add-drop-table \
        --add-locks \
        stampante > "$backup_file"; then
        
        # Compress backup
        print_info "Compressing backup..."
        if gzip "$backup_file"; then
            backup_file="${backup_file}.gz"
            print_success "Backup created: $backup_file"
            
            # Show backup size
            local size=$(du -h "$backup_file" | cut -f1)
            print_info "Backup size: $size"
            
            # Cleanup old backups (keep last 7 days)
            print_info "Cleaning up old backups..."
            find "$backup_dir" -name "stampante_*.sql.gz" -type f -mtime +7 -delete
            
            # List remaining backups
            local backup_count=$(find "$backup_dir" -name "stampante_*.sql.gz" -type f | wc -l)
            print_info "Total backups: $backup_count"
            
        else
            print_error "Failed to compress backup"
            rm -f "$backup_file"
            return 1
        fi
    else
        print_error "Failed to create database backup"
        rm -f "$backup_file"
        return 1
    fi
    
    return 0
}

restore_database() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Usage: restore_database <backup_file>"
        echo "Available backups:"
        ls -la ./backups/stampante_*.sql.gz 2>/dev/null || echo "No backups found"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_header "Restoring Database from Backup"
    
    # Check if database container is running
    if ! docker-compose ps db | grep -q "Up"; then
        print_error "Database container is not running"
        print_info "Starting database..."
        docker-compose up -d db
        wait_for_service "db" 60
    fi
    
    print_warning "This will overwrite the current database!"
    echo -n "Are you sure you want to continue? (y/N): "
    read -r confirmation
    
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        print_info "Database restore cancelled"
        return 0
    fi
    
    print_info "Restoring database from: $backup_file"
    
    # Restore based on file extension
    if [[ "$backup_file" == *.gz ]]; then
        if gunzip -c "$backup_file" | docker-compose exec -T db mysql -u app -ppassword stampante; then
            print_success "Database restored successfully"
        else
            print_error "Failed to restore database"
            return 1
        fi
    else
        if docker-compose exec -T db mysql -u app -ppassword stampante < "$backup_file"; then
            print_success "Database restored successfully"
        else
            print_error "Failed to restore database"
            return 1
        fi
    fi
    
    # Restart application to ensure clean state
    print_info "Restarting application..."
    docker-compose restart app
    
    return 0
}

# ==============================================================================
# Log Management Functions
# ==============================================================================

show_logs() {
    local service="$1"
    local follow="${2:-false}"
    
    if [ -z "$service" ]; then
        print_header "Showing All Container Logs"
        if [ "$follow" = "true" ]; then
            docker-compose logs -f
        else
            docker-compose logs --tail=100
        fi
    else
        print_header "Showing Logs for: $service"
        if [ "$follow" = "true" ]; then
            docker-compose logs -f "$service"
        else
            docker-compose logs --tail=100 "$service"
        fi
    fi
}

show_live_logs() {
    local service="$1"
    show_logs "$service" "true"
}

# ==============================================================================
# Monitoring and Status Functions
# ==============================================================================

show_status() {
    print_header "System Status"
    
    # Container status
    echo -e "${CYAN}${INFO} Container Status:${NC}"
    docker-compose ps
    echo ""
    
    # Resource usage
    echo -e "${CYAN}${INFO} Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo ""
    
    # Application health
    echo -e "${CYAN}${INFO} Application Health:${NC}"
    if curl -f http://localhost:800/health &>/dev/null; then
        local health_data
        health_data=$(curl -s http://localhost:800/health 2>/dev/null)
        
        if [ $? -eq 0 ] && [ -n "$health_data" ]; then
            echo "$health_data" | jq . 2>/dev/null || echo "$health_data"
        else
            print_warning "Health endpoint accessible but returned invalid data"
        fi
    else
        print_error "Application health check failed"
    fi
    
    # Disk usage
    echo ""
    echo -e "${CYAN}${INFO} Docker Disk Usage:${NC}"
    docker system df
}

# ==============================================================================
# Maintenance Functions
# ==============================================================================

update_application() {
    print_header "Updating Application"
    
    # Pull latest changes (if in git repo)
    if [ -d ".git" ]; then
        print_info "Pulling latest changes..."
        git pull origin main
    fi
    
    # Create backup before update
    print_info "Creating backup before update..."
    backup_database
    
    # Rebuild and restart
    print_info "Rebuilding application..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
    # Wait for services
    wait_for_service "db" 60
    wait_for_service "app" 30
    
    # Health check
    if curl -f http://localhost:800/health &>/dev/null; then
        print_success "Application updated successfully"
    else
        print_error "Update completed but health check failed"
        return 1
    fi
    
    return 0
}

cleanup_system() {
    print_header "System Cleanup"
    
    print_warning "This will remove unused Docker resources"
    echo -n "Continue? (y/N): "
    read -r confirmation
    
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        print_info "Cleanup cancelled"
        return 0
    fi
    
    # Stop containers
    print_info "Stopping containers..."
    docker-compose down
    
    # Remove unused images
    print_info "Removing unused Docker images..."
    docker image prune -f
    
    # Remove unused volumes (except database)
    print_info "Removing unused volumes..."
    docker volume prune -f
    
    # Remove unused networks
    print_info "Removing unused networks..."
    docker network prune -f
    
    # Show space saved
    echo ""
    echo -e "${CYAN}${INFO} Current disk usage:${NC}"
    docker system df
    
    print_success "System cleanup completed"
}

stop_application() {
    print_header "Stopping Application"
    
    print_info "Stopping all containers..."
    docker-compose down
    
    print_success "Application stopped"
}

restart_application() {
    print_header "Restarting Application"
    
    print_info "Restarting containers..."
    docker-compose restart
    
    # Wait for services
    wait_for_service "db" 30
    wait_for_service "app" 20
    
    print_success "Application restarted"
}

# ==============================================================================
# Development Functions
# ==============================================================================

dev_setup() {
    print_header "Development Environment Setup"
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        print_info "Creating .env file..."
        cat > .env << EOF
# Database Configuration
DB_HOST=db
DB_PORT=3306
DB_USER=app
DB_PASSWORD=password
DB_NAME=stampante

# Security Configuration
TOKEN_SECRET=dev-jwt-secret-change-in-production
SALT_ROUNDS=10

# Printer Configuration (update with your printer IP)
TN_HOST=10.2.12.244
TN_PORT=100

# Server Configuration
PORT=800
NODE_ENV=development

# Logging
LOG_LEVEL=debug
EOF
        print_success ".env file created"
    else
        print_info ".env file already exists"
    fi
    
    # Create uploads directory
    mkdir -p uploads
    
    # Create backups directory
    mkdir -p backups
    
    # Set permissions (Linux/macOS)
    if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "win32" ]]; then
        chmod 755 uploads backups
    fi
    
    print_success "Development environment setup completed"
}

# ==============================================================================
# Testing Functions
# ==============================================================================

run_tests() {
    print_header "Running Application Tests"
    
    # Check if application is running
    if ! curl -f http://localhost:800/health &>/dev/null; then
        print_error "Application is not running. Start it first with: $0 deploy"
        return 1
    fi
    
    print_info "Running basic health checks..."
    
    # Test health endpoint
    if curl -f http://localhost:800/health &>/dev/null; then
        print_success "Health endpoint: OK"
    else
        print_error "Health endpoint: FAILED"
        return 1
    fi
    
    # Test static files
    if curl -f http://localhost:800/App/login/login.html &>/dev/null; then
        print_success "Static files: OK"
    else
        print_error "Static files: FAILED"
        return 1
    fi
    
    # Test database connection
    if docker-compose exec -T db mysql -u app -ppassword stampante -e "SELECT 1" &>/dev/null; then
        print_success "Database connection: OK"
    else
        print_error "Database connection: FAILED"
        return 1
    fi
    
    # Test printer status (may fail if printer not available)
    local printer_test=$(curl -s -w "%{http_code}" http://localhost:800/printer/status -o /dev/null 2>/dev/null)
    if [ "$printer_test" = "200" ] || [ "$printer_test" = "401" ]; then
        print_success "Printer endpoint: OK (status code: $printer_test)"
    else
        print_warning "Printer endpoint: Unavailable (this is normal if printer is not configured)"
    fi
    
    print_success "Basic tests completed successfully"
}

# ==============================================================================
# Main Script Logic
# ==============================================================================

show_help() {
    cat << EOF
${ROCKET} Gestione Stampante - Docker Management Script

USAGE:
    $0 <command> [options]

COMMANDS:
    deploy              Deploy the complete application
    stop                Stop all containers
    restart             Restart all containers
    status              Show system status and health
    logs [service]      Show logs (optional: specify service name)
    live-logs [service] Show live logs (follow mode)
    
    backup              Create database backup
    restore <file>      Restore database from backup file
    
    update              Update application (git pull + rebuild)
    cleanup             Clean up unused Docker resources
    
    dev-setup           Setup development environment
    test                Run basic application tests

EXAMPLES:
    $0 deploy                           # Deploy complete stack
    $0 logs app                         # Show app container logs
    $0 live-logs db                     # Follow database logs
    $0 backup                           # Create database backup
    $0 restore backups/backup.sql.gz    # Restore from backup
    $0 status                           # Show system status

SERVICES:
    app                 Application container
    db                  Database container

For more information, check the documentation in DOCUMENTAZIONE_TECNICA.md
EOF
}

# Main execution logic
main() {
    local command="$1"
    
    case "$command" in
        "deploy")
            deploy_application
            ;;
        "stop")
            stop_application
            ;;
        "restart")
            restart_application
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "live-logs"|"follow-logs")
            show_live_logs "$2"
            ;;
        "backup")
            backup_database
            ;;
        "restore")
            restore_database "$2"
            ;;
        "update")
            update_application
            ;;
        "cleanup")
            cleanup_system
            ;;
        "dev-setup"|"setup")
            dev_setup
            ;;
        "test"|"tests")
            run_tests
            ;;
        "help"|"-h"|"--help"|"")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"