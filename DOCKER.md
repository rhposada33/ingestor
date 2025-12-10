# Docker Setup Guide

## Overview

The ingestor service is now fully containerized with PostgreSQL. Everything runs in Docker containers with proper networking, health checks, and volume management.

## Architecture

```
┌─────────────────────────────────┐
│   ingestor-network (bridge)     │
├─────────────────────────────────┤
│                                 │
│  ┌──────────────┐  ┌──────────┐│
│  │ ingestor-app │  │postgres  ││
│  │ (Node.js)    │→ │(PostgreSQL)│
│  └──────────────┘  └──────────┘│
│   Port 3000        Port 5432   │
│                                 │
└─────────────────────────────────┘
```

## Services

### PostgreSQL
- **Image**: postgres:16-alpine (lightweight)
- **Container**: ingestor-db
- **Port**: 5432 (exposed to localhost)
- **Credentials**: 
  - Username: postgres
  - Password: postgres
  - Database: ingestor
- **Health Check**: Automatic, 10s interval
- **Volume**: `postgres_data` (persistent)

### Ingestor
- **Build**: Multi-stage Docker build (optimized)
- **Container**: ingestor-app
- **Port**: 3000 (development)
- **Dependencies**: Waits for PostgreSQL health check
- **Volumes**: 
  - Source code mounted (for hot reload)
  - node_modules isolated
- **Command**: `npm run dev` (development mode)

## Quick Start

### 1. Build and Start Containers

```bash
# Build images and start services
docker-compose up -d

# Or with verbose output
docker-compose up
```

### 2. Verify Services Are Running

```bash
# Check containers
docker-compose ps

# Expected output:
# NAME           STATUS
# ingestor-db    Up (healthy)
# ingestor-app   Up
```

### 3. Check Application Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ingestor

# PostgreSQL logs
docker-compose logs -f postgres
```

### 4. Stop Containers

```bash
# Stop all containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Also remove volumes (deletes database!)
docker-compose down -v
```

## Database Management

### Access PostgreSQL from Host

```bash
# Using psql (if installed)
psql -h localhost -U postgres -d ingestor

# Using docker exec
docker-compose exec postgres psql -U postgres -d ingestor
```

### Run Prisma Commands in Container

```bash
# Migrate database
docker-compose exec ingestor npm run prisma:migrate

# Generate Prisma Client
docker-compose exec ingestor npm run prisma:generate

# Open Prisma Studio
docker-compose exec ingestor npm run prisma:studio
# Then open http://localhost:5555
```

### View Database Logs

```bash
# Real-time PostgreSQL logs
docker-compose logs -f postgres
```

## Development Workflow

### Edit Code and See Changes

Code is mounted into the container with hot reload:

```bash
# Make changes to src files
vim src/index.ts

# Changes are detected by nodemon
# Container automatically restarts
```

### Run Tests in Container

```bash
docker-compose exec ingestor npm run lint
docker-compose exec ingestor npm run format
docker-compose exec ingestor npm run build
```

### Access Application

- **Application**: http://localhost:3000
- **Prisma Studio**: http://localhost:5555 (after `npm run prisma:studio`)

## Troubleshooting

### Containers Won't Start

Check logs:
```bash
docker-compose logs
```

Common issues:
- Port already in use: Change port in docker-compose.yml
- Insufficient memory: Ensure Docker has enough resources

### Database Connection Fails

```bash
# Check PostgreSQL is healthy
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres
```

### Rebuild After Dependencies Change

```bash
# Rebuild images
docker-compose build

# Then restart
docker-compose up -d
```

### Reset Database

```bash
# Stop and remove everything including data
docker-compose down -v

# Restart (fresh database)
docker-compose up -d
```

## Production Deployment

The Dockerfile is production-ready with:

### Multi-Stage Build
- Reduces final image size
- Optimizes dependencies
- Only includes production code

### Health Checks
- Container health monitoring
- Automatic restart on failure
- Load balancer ready

### Security
- Non-root user can be added
- Environment variable secrets
- Alpine Linux (minimal attack surface)

### For Production

Update docker-compose.yml:

```yaml
ingestor:
  image: ingestor:1.0.0  # Use pre-built image
  restart: always        # Auto-restart
  environment:
    NODE_ENV: production
    # Add secret management (use Docker secrets or env file)
  # Remove volumes (use read-only or remove)
  # Adjust logging
```

## Docker Commands Reference

```bash
# Container Management
docker-compose up              # Start containers
docker-compose up -d           # Start in background
docker-compose down            # Stop and remove
docker-compose stop            # Stop without removing
docker-compose restart         # Restart all

# Logs & Debugging
docker-compose logs            # Show logs
docker-compose logs -f         # Follow logs
docker-compose logs ingestor   # Service-specific logs

# Execution
docker-compose exec ingestor npm run build      # Run command
docker-compose exec -it ingestor bash           # Interactive shell

# Building & Cleanup
docker-compose build           # Build images
docker-compose build --no-cache # Force rebuild
docker system prune            # Clean up unused resources

# Inspection
docker-compose ps              # List containers
docker-compose config          # Show resolved config
```

## Environment Variables

Variables in `.env` are automatically loaded by docker-compose:

```bash
# Database
POSTGRES_DB=ingestor
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_URL=postgres://postgres:postgres@postgres:5432/ingestor

# Application
NODE_ENV=development
LOG_LEVEL=info

# MQTT (internal Docker networking)
MQTT_BROKER_URL=mqtt://host.docker.internal:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

### For External Services

If your MQTT broker is on the host machine:
- Use `host.docker.internal` on macOS/Windows
- Use `172.17.0.1` on Linux (or use `--network host`)
- Or use full external IP address

## Volumes Explained

### postgres_data
- **Purpose**: Persist database files
- **Location**: Docker's internal storage
- **Cleanup**: `docker-compose down -v` removes it

### .:/app (source code)
- **Purpose**: Hot reload during development
- **Location**: Mounted from current directory
- **Note**: Removed for production

### /app/node_modules
- **Purpose**: Keep node_modules inside container
- **Benefits**: Prevents conflicts with host OS

## Network Communication

### Inside Docker Network
Containers communicate by service name:
```
ingestor → postgres:5432
```

### From Host Machine
Access services on localhost:
```
localhost:3000   (Ingestor app)
localhost:5432   (PostgreSQL)
```

### MQTT Connection
```
host.docker.internal:1883  (Host machine's MQTT)
```

## Next Steps

1. ✅ Start containers: `docker-compose up -d`
2. ✅ Verify: `docker-compose ps`
3. ✅ Check logs: `docker-compose logs -f`
4. ✅ Access app: http://localhost:3000
5. ⏳ Implement MQTT handlers

## Resource Limits (Optional)

To limit CPU/memory, add to docker-compose.yml:

```yaml
ingestor:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M
```

## Monitoring

```bash
# Real-time resource usage
docker stats

# Container events
docker events --filter type=container

# Logs with timestamps
docker-compose logs --timestamps
```

---

**Status**: ✅ Ready to use. Start with `docker-compose up -d`
