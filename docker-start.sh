#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Ingestor Docker Setup${NC}"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed${NC}"
    echo "Please install Docker from https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker daemon is not running${NC}"
    echo "Please start Docker Desktop or the Docker daemon"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed and running${NC}"
echo ""

# Offer options
echo "What would you like to do?"
echo "1) Start containers (docker-compose up -d)"
echo "2) Start containers with logs (docker-compose up)"
echo "3) Stop containers (docker-compose stop)"
echo "4) Rebuild and start (docker-compose build && docker-compose up -d)"
echo "5) View logs (docker-compose logs -f)"
echo "6) Open container shell (docker-compose exec ingestor bash)"
echo "7) Reset database (docker-compose down -v && docker-compose up -d)"
echo ""
read -p "Enter choice (1-7): " choice

case $choice in
    1)
        echo -e "${BLUE}Starting containers...${NC}"
        docker-compose up -d
        echo ""
        echo -e "${GREEN}✓ Containers started${NC}"
        echo -e "  App: http://localhost:3000"
        echo -e "  PostgreSQL: localhost:5432"
        echo ""
        echo "Check status with: docker-compose ps"
        echo "View logs with: docker-compose logs -f"
        ;;
    2)
        echo -e "${BLUE}Starting containers with logs...${NC}"
        docker-compose up
        ;;
    3)
        echo -e "${BLUE}Stopping containers...${NC}"
        docker-compose stop
        echo -e "${GREEN}✓ Containers stopped${NC}"
        ;;
    4)
        echo -e "${BLUE}Building and starting containers...${NC}"
        docker-compose build
        docker-compose up -d
        echo ""
        echo -e "${GREEN}✓ Build complete and containers started${NC}"
        echo "View logs with: docker-compose logs -f"
        ;;
    5)
        echo -e "${BLUE}Showing logs...${NC}"
        docker-compose logs -f
        ;;
    6)
        echo -e "${BLUE}Opening container shell...${NC}"
        docker-compose exec ingestor bash
        ;;
    7)
        echo -e "${YELLOW}⚠️  This will delete all database data!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo -e "${BLUE}Resetting database...${NC}"
            docker-compose down -v
            docker-compose up -d
            echo -e "${GREEN}✓ Database reset and containers started${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
